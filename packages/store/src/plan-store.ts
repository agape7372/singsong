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

import { createChangeBus, type ChangeBus, type StoreTopic } from "./change-bus";
import { MIGRATIONS } from "./migrations/index";
import { migrate } from "./migrations/run";
import { createMutex, type Mutex } from "./mutex";
import {
  ACTIVE_PLAN_ID,
  RevisionConflictError,
  applyPlanMutation,
  buildImportedPlan,
  newPlan,
} from "./policy";
import type { StorePorts } from "./ports";
import { assertRealSqlExecutor, type SqlExecutor } from "./sql-executor";
import { getImportBySlug, insertImport, listImportRows } from "./repositories/imported-share";
import type { ImportedShare } from "./policy";
import { readPlanRow, writePlanRow } from "./repositories/plan";
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
