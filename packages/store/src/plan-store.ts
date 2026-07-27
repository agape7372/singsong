/**
 * 공개 API. **뮤텍스 + 트랜잭션 + 통지의 유일한 소유자.**
 *
 * 층 규칙(타입이 절반을 강제한다):
 *   - repository(SqlSession 첫 인자)는 트랜잭션을 절대 안 연다 — SqlSession 에 transaction()
 *     이 없다(sql-executor.ts:43).
 *   - 여기 공개 함수는 뮤텍스 획득 → (쓰기면) sql.transaction → repository → 커밋 → notify.
 *   - **공개 함수는 공개 함수를 부르지 않는다**(비재진입 뮤텍스 = 데드락). 예: importSharedPlan
 *     은 getActivePlan 을 부르지 않고 readPlanRow(tx) 를 직접 쓴다.
 *   - 순수 읽기(getTicket 등)는 begin immediate(쓰기 락)를 피하려 트랜잭션 없이 sql 을 바로
 *     세션으로 넘긴다. 뮤텍스만 통과시켜 쓰기와 직렬화한다.
 */

import type { Plan, SharedSnapshot, TicketSnapshot } from "@singsong/domain/models";

import { base64Url } from "@singsong/domain/bytes";

import { createChangeBus, type ChangeBus, type StoreTopic } from "./change-bus";
import { MIGRATIONS } from "./migrations/index";
import { migrate } from "./migrations/run";
import { createMutex, type Mutex } from "./mutex";
import {
  ACTIVE_PLAN_ID,
  PROFILE_ID,
  RevisionConflictError,
  applyPlanMutation,
  buildImportedPlan,
  combineManagedShare,
  emptyProfile,
  isCompleteReceipt,
  isExpired,
  isStalePending,
  isValidCompletionReceipt,
  newManagedShare,
  newPlan,
  partitionObsoleteShares,
  summarizeManagedShares,
  type ImportedShare,
  type ManagedShare,
  type ManagedShareReceipt,
  type ManagedShareSummary,
} from "./policy";
import type { StorePorts } from "./ports";
import { assertRealSqlExecutor, type SqlExecutor, type SqlSession } from "./sql-executor";
import { getImportBySlug, insertImport, listImportRows } from "./repositories/imported-share";
import { readPlanRow, writePlanRow } from "./repositories/plan";
import * as shareRepo from "./repositories/managed-share";
import { getProfileRow, upsertProfile, type StoredProfile } from "./repositories/profile";
import {
  claimMotion,
  getTicketRow,
  insertTicketIfAbsent,
  listTicketRows,
} from "./repositories/ticket";

/**
 * 불투명 핸들. 공개 함수가 첫 인자로 받는다. sql·ports·mutex·bus·cache 를 품는다 —
 * 소비처는 필드를 만지지 않는다.
 */
export interface PlanStore {
  readonly sql: SqlExecutor;
  readonly ports: StorePorts;
  readonly withLock: Mutex;
  readonly bus: ChangeBus;
  /**
   * M2 의 useSyncExternalStore 용 참조 안정 스냅샷 슬롯. P3 은 여기까지만 — 재수화(openPlanStore·
   * deleteAllLocalData)와 뮤테이션이 슬롯을 갱신하되, getSnapshot 배선은 apps/app 이 워크스페이스에
   * 없어(핸드오프 Decisions) 검증 수단이 없으므로 M2 로 미룬다. 읽기는 이 슬롯에 의존하지 않는다.
   */
  cachedPlan: Plan | null;
}

/** ISO-8601 UTC. ports.now()(epoch ms)를 record 타임스탬프용 문자열로. */
function nowIso(store: PlanStore): string {
  return new Date(store.ports.now()).toISOString();
}

/** 커밋 뒤에만 부른다(change-bus 불변식 1). */
function notify(store: PlanStore, topic: StoreTopic): void {
  store.bus.emit(topic);
}

/**
 * 이미 마이그레이션된 실행기를 받는 저수준 진입점(동기). 테스트·저수준 조립용.
 * 프로덕션·테스트 대부분은 openPlanStore 를 쓴다.
 */
export function createPlanStore(sql: SqlExecutor, ports: StorePorts): PlanStore {
  return { sql, ports, withLock: createMutex(), bus: createChangeBus(), cachedPlan: null };
}

/**
 * 스토어를 여는 정본 경로. 더미 실행기 방어 → 마이그레이션 → 캐시 재수화.
 * ★ assertRealSqlExecutor 는 async 라 동기 createPlanStore 에 못 넣는다(crit §C-4). 여기서
 *    한 번 부른다 — sql-executor.ts:96-101 이 "스토어를 여는 경로에서 한 번" 이라 지시한 자리다.
 */
export async function openPlanStore(sql: SqlExecutor, ports: StorePorts): Promise<PlanStore> {
  await assertRealSqlExecutor(sql);
  await migrate(sql, MIGRATIONS);
  const store = createPlanStore(sql, ports);
  // 재수화: 활성 플랜을 한 번 읽어 캐시 슬롯을 채운다(없으면 만든다).
  store.cachedPlan = await getActivePlan(store);
  return store;
}

/** 테스트 teardown 관례(try/finally + close). 실행기를 닫는다. */
export async function closePlanStore(store: PlanStore): Promise<void> {
  await store.sql.close();
}

/* ──────────────────────────────── 플랜 ─────────────────────────────────── */

/**
 * 활성 플랜. 없으면 revision 0 으로 **삽입하고** 반환한다(읽기처럼 보이는 쓰기).
 * ★ 통지하지 않는다(change-bus 불변식 2). 초기 삽입이 emit 하면 observeActivePlan →
 *    getActivePlan → emit → … 무한루프다(plan-database.ts:184-186 함정의 재출현).
 */
export function getActivePlan(store: PlanStore): Promise<Plan> {
  return store.withLock(async () => {
    const plan = await store.sql.transaction(async (tx) => {
      const existing = await readPlanRow(tx, ACTIVE_PLAN_ID);
      if (existing) return existing;
      const initial = newPlan(nowIso(store));
      await writePlanRow(tx, initial);
      return initial;
    });
    store.cachedPlan = plan; // 커밋 후에만
    return plan;
  });
}

export function mutateActivePlan(
  store: PlanStore,
  expectedRevision: number,
  mutation: (current: Plan) => Omit<Plan, "id" | "revision" | "createdAt" | "updatedAt">,
): Promise<Plan> {
  return store.withLock(async () => {
    const next = await store.sql.transaction(async (tx) => {
      const row = await readPlanRow(tx, ACTIVE_PLAN_ID);
      const current = row ?? newPlan(nowIso(store)); // ★ 부재 = revision 0(빈 DB 에서 expected=0 성공)
      if (current.revision !== expectedRevision) {
        throw new RevisionConflictError(expectedRevision, current.revision);
      }
      const nextPlan = applyPlanMutation(current, mutation, nowIso(store));
      await writePlanRow(tx, nextPlan);
      return nextPlan;
    });
    store.cachedPlan = next;
    notify(store, "plan"); // 커밋 후에만
    return next;
  });
}

export function importSharedPlan(
  store: PlanStore,
  expectedRevision: number,
  slug: string,
  payload: SharedSnapshot,
): Promise<{ status: "imported" | "already-imported"; plan: Plan }> {
  return store.withLock(async () => {
    const result = await store.sql.transaction(async (tx) => {
      const alreadyImported = await getImportBySlug(tx, slug);
      if (alreadyImported) {
        const row = await readPlanRow(tx, ACTIVE_PLAN_ID);
        // ★ already-imported 는 **삽입하지 않는다**(crit §N-6). 부재면 ephemeral newPlan 을
        //    낼 뿐 쓰지 않는다(Dexie 판 plan-database.ts:260 이 `?? newPlan()` 로 읽기만 한 것과 등가).
        return { status: "already-imported" as const, plan: row ?? newPlan(nowIso(store)) };
      }
      const row = await readPlanRow(tx, ACTIVE_PLAN_ID);
      const current = row ?? newPlan(nowIso(store));
      if (current.revision !== expectedRevision) {
        throw new RevisionConflictError(expectedRevision, current.revision);
      }
      const plan = buildImportedPlan(current, payload, nowIso(store), store.ports.randomId);
      await writePlanRow(tx, plan);
      await insertImport(tx, {
        slug,
        importedAt: nowIso(store),
        planRevision: plan.revision,
      } satisfies ImportedShare);
      return { status: "imported" as const, plan };
    });
    // ★ 통지는 실제 변경(imported)에만. already-imported 는 사실상 읽기라 불변식 2 를 따른다.
    //   (Dexie 판은 already-imported 에도 signalRevision 했으나 그건 같은 revision 재방송이라
    //    새 설계의 "읽기는 통지 안 함" 규칙으로 정리한다 — 이 변화에 의존하는 테스트는 없다.)
    if (result.status === "imported") {
      store.cachedPlan = result.plan;
      notify(store, "plan");
    }
    return result;
  });
}

/**
 * liveQuery 대체. 구독 즉시 첫 값을 한 번 쏘고(불변식 4), 이후 "plan" 통지마다 재조회한다.
 * ★ 초기 읽기(getActivePlan)는 통지하지 않으므로(불변식 2) 이 호출이 리스너를 되부르지 않는다.
 */
export function observeActivePlan(
  store: PlanStore,
  onValue: (plan: Plan) => void,
  onError: (error: unknown) => void,
): () => void {
  void getActivePlan(store).then(onValue, onError);
  return store.bus.subscribe("plan", () => {
    void getActivePlan(store).then(onValue, onError);
  });
}

/* ──────────────────────────────── 티켓 ─────────────────────────────────── */

export function saveTicket(store: PlanStore, ticket: TicketSnapshot): Promise<TicketSnapshot> {
  return store.withLock(async () => {
    const stored = await store.sql.transaction((tx) => insertTicketIfAbsent(tx, ticket));
    notify(store, "ticket");
    return stored;
  });
}

export function getTicket(
  store: PlanStore,
  planId: string,
  revision: number,
): Promise<TicketSnapshot | null> {
  // 순수 읽기 — 트랜잭션(begin immediate) 없이 sql 을 세션으로. 뮤텍스로 쓰기와 직렬화만 한다.
  return store.withLock(() => getTicketRow(store.sql, planId, revision));
}

export function claimTicketMotion(
  store: PlanStore,
  planId: string,
  revision: number,
): Promise<boolean> {
  return store.withLock(async () => {
    const claimed = await store.sql.transaction((tx) =>
      claimMotion(tx, planId, revision, nowIso(store)),
    );
    if (claimed) notify(store, "ticket");
    return claimed;
  });
}

export function listTickets(store: PlanStore): Promise<TicketSnapshot[]> {
  return store.withLock(() => listTicketRows(store.sql));
}

export function listImports(store: PlanStore): Promise<ImportedShare[]> {
  return store.withLock(() => listImportRows(store.sql));
}

/* ─────────────────────────────── 공유 링크 ─────────────────────────────── */

/**
 * ★ 보안 임계. bearer capability 토큰. 도메인의 순수 base64Url(트랙 A, bytes.ts:40)로 인코딩한다 —
 *    plan-database.ts:318-323 의 `btoa`+replace 중복을 store 에서는 만들지 않는다(트랙 A 인계).
 *    16바이트 → 22자(끝 [AQgw]), 32바이트 → 43자(M15 실측, completeManagedShare 정규식 통과).
 */
function capabilityToken(store: PlanStore, byteLength: number): string {
  return base64Url(store.ports.randomBytes(byteLength));
}

/**
 * 만료·stale 영수증(obsolete)과 고아 secret 을 한꺼번에 청소한다(repository 레벨, tx 안).
 * plan-database.ts:372-388 등가. 공개 함수가 아니다 — 공개 함수가 공개 함수를 부르면 데드락이라
 * listManagedShares 는 이 tx 헬퍼를 부른다.
 */
async function removeExpiredAndStale(tx: SqlSession, nowMs: number): Promise<void> {
  const receipts = await shareRepo.listReceipts(tx);
  const secrets = await shareRepo.listSecrets(tx);
  const { obsolete, orphanSecrets } = partitionObsoleteShares(receipts, secrets, nowMs);
  await shareRepo.deleteReceipts(tx, obsolete);
  await shareRepo.deleteSecrets(tx, [...obsolete, ...orphanSecrets]);
}

// ★ 공유 링크 연산은 "managed-share" topic 으로 통지하지 않는다 — P3 에 구독자가 없고,
//    Dexie 판도 managed share 를 signal 하지 않았다(BroadcastChannel 은 plan revision 전용).
//    UI 옵저버가 생기는 M2 에서 배선한다.

export function prepareManagedShare(store: PlanStore, fingerprint: string): Promise<ManagedShare> {
  return store.withLock(() =>
    store.sql.transaction(async (tx) => {
      const receipt = await shareRepo.getReceipt(tx, fingerprint);
      const secret = await shareRepo.getSecret(tx, fingerprint);
      const nowMs = store.ports.now();
      if (receipt && !isExpired(receipt, nowMs) && !isStalePending(receipt, nowMs) && secret) {
        return combineManagedShare(receipt, secret); // 살아있는 쌍이면 재사용
      }
      if (receipt && isCompleteReceipt(receipt) && !isExpired(receipt, nowMs) && !secret) {
        // ★ 사용자 대면 한국어 문구 — plan-database.ts:400-402 원문 유지.
        throw new Error(
          "이 링크의 철회 키를 이 브라우저에서 찾을 수 없습니다. 기존 링크는 만료 전까지 철회할 수 없습니다.",
        );
      }
      await shareRepo.deleteShare(tx, fingerprint);
      const pending = newManagedShare(fingerprint, nowIso(store), (n) => capabilityToken(store, n));
      await shareRepo.insertReceipt(tx, pending.receipt);
      await shareRepo.insertSecret(tx, pending.secret);
      return pending.combined;
    }),
  );
}

/** 멱등성 충돌 뒤 두 bearer capability 를 모두 갈아치운다. plan-database.ts:415-425. */
export function rotateManagedShare(store: PlanStore, fingerprint: string): Promise<ManagedShare> {
  return store.withLock(() =>
    store.sql.transaction(async (tx) => {
      await shareRepo.deleteShare(tx, fingerprint);
      const pending = newManagedShare(fingerprint, nowIso(store), (n) => capabilityToken(store, n));
      await shareRepo.insertReceipt(tx, pending.receipt);
      await shareRepo.insertSecret(tx, pending.secret);
      return pending.combined;
    }),
  );
}

export function completeManagedShare(
  store: PlanStore,
  fingerprint: string,
  receipt: { slug: string; revokeToken: string; expiresAt: string },
): Promise<ManagedShare> {
  // ★ 형태 검증은 트랜잭션 **밖**에서(plan-database.ts:431-436 순서 유지) — 실패 시 불필요한 BEGIN 을 안 연다.
  if (!isValidCompletionReceipt(receipt)) {
    throw new Error("Managed share receipt is invalid");
  }
  return store.withLock(() =>
    store.sql.transaction(async (tx) => {
      const pending = await shareRepo.getReceipt(tx, fingerprint);
      const secret = await shareRepo.getSecret(tx, fingerprint);
      if (!pending || !secret || secret.revokeToken !== receipt.revokeToken) {
        throw new Error("Managed share capability changed during creation");
      }
      const active: ManagedShareReceipt = {
        ...pending,
        slug: receipt.slug,
        expiresAt: receipt.expiresAt,
      };
      await shareRepo.putReceipt(tx, active);
      return combineManagedShare(active, secret);
    }),
  );
}

export function getManagedShareReceipt(
  store: PlanStore,
  fingerprint: string,
): Promise<ManagedShareSummary | null> {
  return store.withLock(() =>
    store.sql.transaction(async (tx) => {
      const receipt = await shareRepo.getReceipt(tx, fingerprint);
      if (!receipt) return null;
      const nowMs = store.ports.now();
      if (isExpired(receipt, nowMs) || isStalePending(receipt, nowMs)) {
        await shareRepo.deleteShare(tx, fingerprint); // 읽기처럼 보이는 쓰기(만료 청소)
        return null;
      }
      if (!isCompleteReceipt(receipt)) return null;
      const secret = await shareRepo.getSecret(tx, fingerprint);
      return { ...receipt, canRevoke: secret !== null };
    }),
  );
}

export function getManagedShare(
  store: PlanStore,
  fingerprint: string,
): Promise<ManagedShare | null> {
  return store.withLock(() =>
    store.sql.transaction(async (tx) => {
      const receipt = await shareRepo.getReceipt(tx, fingerprint);
      const secret = await shareRepo.getSecret(tx, fingerprint);
      if (!receipt) {
        // ★ 고아 secret 정리 경로 ② — 영수증 없는 secret 을 지운다(§2.6).
        if (secret) await shareRepo.deleteSecret(tx, fingerprint);
        return null;
      }
      const nowMs = store.ports.now();
      if (isExpired(receipt, nowMs) || isStalePending(receipt, nowMs)) {
        await shareRepo.deleteShare(tx, fingerprint);
        return null;
      }
      return isCompleteReceipt(receipt) && secret ? combineManagedShare(receipt, secret) : null;
    }),
  );
}

export function listManagedShares(store: PlanStore): Promise<ManagedShareSummary[]> {
  return store.withLock(() =>
    store.sql.transaction(async (tx) => {
      await removeExpiredAndStale(tx, store.ports.now()); // ★ 고아 secret 정리 경로 ①(§2.6)
      const receipts = await shareRepo.listReceipts(tx); // 이미 created_at desc, fingerprint
      const secrets = await shareRepo.listSecrets(tx);
      return summarizeManagedShares(receipts, secrets);
    }),
  );
}

export function deleteManagedShare(store: PlanStore, fingerprint: string): Promise<void> {
  return store.withLock(() =>
    store.sql.transaction((tx) => shareRepo.deleteShare(tx, fingerprint)),
  );
}

/* ──────────────────────────────── 프로필 ───────────────────────────────── */

/** 기본값(emptyProfile)에 photoUri:null 을 채운다 — StoredProfile 은 photoUri 를 요구한다(crit §N-8). */
function defaultStoredProfile(store: PlanStore): StoredProfile {
  return { ...emptyProfile(nowIso(store)), photoUri: null };
}

/** getActivePlan 과 달리 없으면 **삽입하지 않는다**(순수 기본값 반환) — 원본의 비대칭 유지(:524-526). */
export function getProfile(store: PlanStore): Promise<StoredProfile> {
  return store.withLock(async () => {
    const row = await getProfileRow(store.sql, PROFILE_ID);
    return row ?? defaultStoredProfile(store);
  });
}

export function observeProfile(
  store: PlanStore,
  onValue: (profile: StoredProfile) => void,
  onError: (error: unknown) => void,
): () => void {
  void getProfile(store).then(onValue, onError);
  return store.bus.subscribe("profile", () => {
    void getProfile(store).then(onValue, onError);
  });
}

export function saveProfile(
  store: PlanStore,
  patch: Partial<Pick<StoredProfile, "nickname" | "colorId" | "photoUri">>,
): Promise<StoredProfile> {
  return store.withLock(async () => {
    const next = await store.sql.transaction(async (tx) => {
      const current = (await getProfileRow(tx, PROFILE_ID)) ?? defaultStoredProfile(store);
      const merged: StoredProfile = {
        ...current,
        ...patch,
        id: PROFILE_ID,
        updatedAt: nowIso(store),
      };
      await upsertProfile(tx, merged);
      return merged;
    });
    notify(store, "profile");
    return next;
  });
}

/**
 * photo 만 지운다. Dexie 판은 photo 키를 생략했지만(exactOptionalPropertyTypes), SQL 은
 * `photo_uri = null` 이다 — 표현이 달라도 계약(사진 제거)은 같다(§2.4).
 */
export function clearProfilePhoto(store: PlanStore): Promise<StoredProfile> {
  return store.withLock(async () => {
    const next = await store.sql.transaction(async (tx) => {
      const current = (await getProfileRow(tx, PROFILE_ID)) ?? defaultStoredProfile(store);
      const cleared: StoredProfile = {
        ...current,
        photoUri: null,
        id: PROFILE_ID,
        updatedAt: nowIso(store),
      };
      await upsertProfile(tx, cleared);
      return cleared;
    });
    notify(store, "profile");
    return next;
  });
}

/* ──────────────────────────────── 전역 ─────────────────────────────────── */

// deleteAllLocalData 가 비우는 전 테이블. 사용자 입력이 아니라 고정 목록이라 문자열 보간이 안전하다.
const ALL_TABLES = [
  "plan",
  "ticket",
  "imported_share",
  "managed_share_receipt",
  "managed_share_secret",
  "profile",
] as const;

/**
 * clearLocalDataForTests 개명(계획 §3.4). 이름과 달리 settings-screen.tsx:70 이 프로덕션
 * "데이터 지우기" 로 쓴다(src/ 쪽 이름은 M6 까지 clearLocalDataForTests 로 남는다).
 *
 * 뮤텍스 1회 획득 안에서 전 테이블 DELETE → 싱글턴(cachedPlan) 리셋 → **재수화** → 통지를
 * 한 단위로. ★ 재수화가 필수다(crit §C-5, 계획 §3.4) — 빼면 싱글턴이 옛 revision 을 들고 있다가
 * 다음 mutate 가 영구 RevisionConflictError 가 된다. 여기서 새 활성 플랜 1행을 만들어 다음
 * mutate(0) 이 성공하게 한다.
 */
export function deleteAllLocalData(store: PlanStore): Promise<void> {
  return store.withLock(async () => {
    const rehydrated = await store.sql.transaction(async (tx) => {
      for (const table of ALL_TABLES) await tx.run(`delete from ${table}`);
      const fresh = newPlan(nowIso(store));
      await writePlanRow(tx, fresh); // 재수화: 새 활성 플랜(revision 0)
      return fresh;
    });
    store.cachedPlan = rehydrated;
    // 옵저버가 재조회하도록 통지한다. 프로필도 비웠으니 함께 알린다(Dexie 는 DB 삭제 → liveQuery
    // 재발화였지만 SQL 은 명시 통지가 필요하다).
    notify(store, "plan");
    notify(store, "profile");
  });
}
