import Dexie, { type EntityTable, type Table, liveQuery } from "dexie";
import type { Plan, SharedSnapshot, TicketSnapshot } from "@/domain/models";
import { base64Url } from "@/domain/bytes";
import {
  ACTIVE_PLAN_ID,
  DEFAULT_PROFILE_COLOR,
  PROFILE_ID,
  PlanLimitError,
  RevisionConflictError,
  applyPlanMutation,
  buildImportedPlan,
  combineManagedShare,
  emptyProfile as emptyProfileAt,
  isCompleteReceipt,
  isExpired as isExpiredAt,
  isStalePending as isStalePendingAt,
  isValidCompletionReceipt,
  newManagedShare as newManagedShareAt,
  newPlan as newPlanAt,
} from "@/store/policy";

// ★ C8: 정책·상수·에러 클래스의 정본은 @/store/policy 다. Dexie 저장 기전(이 파일)은 M6 까지
//   살고, node:sqlite 판(packages/store)과 **같은 순수 정책을 공유**해 규칙이 두 벌로 갈라지지
//   않게 한다(만료 24h·정규식·100곡·revision·기본색). 아래 재-export 로 기존 소비처
//   (use-active-plan.ts:77 의 `instanceof RevisionConflictError`)를 무변경으로 유지한다.
export { ACTIVE_PLAN_ID, DEFAULT_PROFILE_COLOR, PROFILE_ID, PlanLimitError, RevisionConflictError };

const CHANNEL_NAME = "singsong-active-plan-v1";

class SingSongDatabase extends Dexie {
  plans!: EntityTable<Plan, "id">;
  tickets!: Table<TicketSnapshot, [string, number]>;
  imports!: EntityTable<ImportedShare, "slug">;
  managedShares!: EntityTable<ManagedShareReceipt, "fingerprint">;
  managedShareSecrets!: EntityTable<ManagedShareSecret, "fingerprint">;
  profile!: EntityTable<ProfileRecord, "id">;

  constructor() {
    super("singsong-session-strip");
    this.version(1).stores({
      plans: "&id,revision,updatedAt",
      tickets: "&[planId+revision],planId,revision,createdAt",
    });
    this.version(2).stores({
      plans: "&id,revision,updatedAt",
      tickets: "&[planId+revision],planId,revision,createdAt",
      imports: "&slug,importedAt,planRevision",
    });
    this.version(3).stores({
      plans: "&id,revision,updatedAt",
      tickets: "&[planId+revision],planId,revision,createdAt",
      imports: "&slug,importedAt,planRevision",
      managedShares: "&fingerprint,&slug,expiresAt",
    });
    this.version(4)
      .stores({
        plans: "&id,revision,updatedAt",
        tickets: "&[planId+revision],planId,revision,createdAt",
        imports: "&slug,importedAt,planRevision",
        managedShares: "&fingerprint,&slug,expiresAt,createdAt",
        managedShareSecrets: "&fingerprint,createdAt",
      })
      .upgrade(async (transaction) => {
        // v3 kept the public receipt and the two bearer capabilities in one
        // object. Re-putting a stripped receipt is intentional: IndexedDB
        // preserves unindexed properties unless the whole value is replaced.
        const legacyReceipts = transaction.table<LegacyManagedShare>("managedShares");
        const receipts = transaction.table<ManagedShareReceipt>("managedShares");
        const secrets = transaction.table<ManagedShareSecret>("managedShareSecrets");
        const legacyRows = await legacyReceipts.toArray();
        if (legacyRows.length === 0) return;
        await secrets.bulkPut(
          legacyRows.map(({ fingerprint, idempotencyKey, revokeToken, createdAt }) => ({
            fingerprint,
            idempotencyKey,
            revokeToken,
            createdAt,
          })),
        );
        await receipts.bulkPut(
          legacyRows.map(({ fingerprint, slug, expiresAt, createdAt }) => ({
            fingerprint,
            slug,
            expiresAt,
            createdAt,
          })),
        );
      });
    // v5 adds the device-local profile. It never leaves the browser: the profile
    // is intentionally excluded from shared snapshots, ticket PNG, and OG output.
    this.version(5).stores({
      plans: "&id,revision,updatedAt",
      tickets: "&[planId+revision],planId,revision,createdAt",
      imports: "&slug,importedAt,planRevision",
      managedShares: "&fingerprint,&slug,expiresAt,createdAt",
      managedShareSecrets: "&fingerprint,createdAt",
      profile: "&id",
    });
  }
}

export type ImportedShare = { slug: string; importedAt: string; planRevision: number };

/** Device-local identity. Never included in shared snapshots, ticket PNG, or OG. */
export type ProfileRecord = {
  id: string;
  nickname: string;
  colorId: string;
  photo?: Blob;
  updatedAt: string;
};

// now 기본값을 채우는 얇은 래퍼(순수 코어는 now 필수 — 결정성). BaseProfile 은 photo 축이
// 없지만 ProfileRecord 의 photo 는 optional 이라 그대로 대입된다.
function emptyProfile(now = new Date().toISOString()): ProfileRecord {
  return emptyProfileAt(now);
}

type LegacyManagedShare = {
  fingerprint: string;
  idempotencyKey: string;
  revokeToken: string;
  slug: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type ManagedShareReceipt = {
  fingerprint: string;
  slug: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type ManagedShareSecret = {
  fingerprint: string;
  idempotencyKey: string;
  revokeToken: string;
  createdAt: string;
};

/** Combined only at the data boundary. Raw capabilities never enter the receipt table. */
export type ManagedShare = ManagedShareReceipt & ManagedShareSecret;

export type ManagedShareSummary = ManagedShareReceipt & { canRevoke: boolean };

let database: SingSongDatabase | null = null;

function db() {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is not available");
  database ??= new SingSongDatabase();
  return database;
}

// RevisionConflictError·PlanLimitError 는 @/store/policy 가 정본(상단에서 import·재-export).

function newPlan(now = new Date().toISOString()): Plan {
  return newPlanAt(now);
}

function signalRevision(revision: number) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: "plan-revision", revision });
  channel.close();
}

export async function getActivePlan(): Promise<Plan> {
  return db().transaction("rw", db().plans, async () => {
    const existing = await db().plans.get(ACTIVE_PLAN_ID);
    if (existing) return existing;
    const initial = newPlan();
    await db().plans.add(initial);
    return initial;
  });
}

export function observeActivePlan(
  onValue: (plan: Plan) => void,
  onError: (error: unknown) => void,
) {
  // Keep the observed query read-only. Creating the initial record inside a
  // liveQuery invalidates that same query before it can emit, which can leave
  // a fresh browser in an endless initialization loop.
  const subscription = liveQuery(() => db().plans.get(ACTIVE_PLAN_ID)).subscribe({
    next: (plan) => {
      if (plan) {
        onValue(plan);
        return;
      }
      void getActivePlan().then(onValue, onError);
    },
    error: onError,
  });
  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", () => {
      void getActivePlan().then(onValue, onError);
    });
  }
  return () => {
    subscription.unsubscribe();
    channel?.close();
  };
}

export async function mutateActivePlan(
  expectedRevision: number,
  mutation: (current: Plan) => Omit<Plan, "id" | "revision" | "createdAt" | "updatedAt">,
) {
  const updated = await db().transaction("rw", db().plans, async () => {
    const current = (await db().plans.get(ACTIVE_PLAN_ID)) ?? newPlan();
    if (current.revision !== expectedRevision) {
      throw new RevisionConflictError(expectedRevision, current.revision);
    }
    // CAS(위 revision 비교)는 여기 남고, 클론→뮤테이션→100곡→order 재번호→assertValidPlan 은
    // 공유 정책 applyPlanMutation 이 한다(node:sqlite 판과 규칙 한 벌).
    const next = applyPlanMutation(current, mutation, new Date().toISOString());
    await db().plans.put(next);
    return next;
  });
  signalRevision(updated.revision);
  return updated;
}

// replaceActivePlan 은 삭제했다(C8) — 리포 전체 호출자 0건(실측 grep). crypto.randomUUID 구멍
// (핸드오프 표의 plan-database.ts:244)도 이 삭제로 함께 사라진다.

export async function importSharedPlan(
  expectedRevision: number,
  slug: string,
  payload: SharedSnapshot,
) {
  const result = await db().transaction("rw", db().plans, db().imports, async () => {
    const alreadyImported = await db().imports.get(slug);
    if (alreadyImported) {
      return {
        status: "already-imported" as const,
        plan: (await db().plans.get(ACTIVE_PLAN_ID)) ?? newPlan(),
      };
    }
    const current = (await db().plans.get(ACTIVE_PLAN_ID)) ?? newPlan();
    if (current.revision !== expectedRevision) {
      throw new RevisionConflictError(expectedRevision, current.revision);
    }
    const now = new Date().toISOString();
    // 공유 스냅샷 → 로컬 플랜 투영은 공유 정책 buildImportedPlan 이 한다(항목마다 새 로컬 id).
    const plan = buildImportedPlan(current, payload, now, () => crypto.randomUUID());
    await db().plans.put(plan);
    await db().imports.add({ slug, importedAt: now, planRevision: plan.revision });
    return { status: "imported" as const, plan };
  });
  if (result.plan) signalRevision(result.plan.revision);
  return result;
}

export async function saveTicket(ticket: TicketSnapshot) {
  return db().transaction("rw", db().tickets, async () => {
    const key: [string, number] = [ticket.planId, ticket.revision];
    const existing = await db().tickets.get(key);
    if (existing) return existing;
    await db().tickets.add(ticket);
    return ticket;
  });
}

export async function getTicket(planId: string, revision: number) {
  return db().tickets.get([planId, revision]);
}

export async function claimTicketMotion(planId: string, revision: number) {
  return db().transaction("rw", db().tickets, async () => {
    const key: [string, number] = [planId, revision];
    const ticket = await db().tickets.get(key);
    if (!ticket || ticket.issueMotionClaimedAt) return false;
    await db().tickets.put({ ...ticket, issueMotionClaimedAt: new Date().toISOString() });
    return true;
  });
}

// bearer capability 토큰. btoa+정규식 replace 대신 도메인의 순수 base64Url(트랙 A, bytes.ts:40)
// 을 쓴다 — canonical.ts 의 중복을 접은 것과 같은 정리(트랙 A 인계). 16→22자(끝 [AQgw])·32→43자로
// 바이트 동일하다(M15 실측, completeManagedShare 정규식 통과).
function capabilityToken(bytes: number) {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

// isExpired·isStalePending·isCompleteReceipt·combineManagedShare 는 @/store/policy 가 정본
// (상단 import). 여기서는 now 기본값만 채우는 얇은 래퍼로 감싼다(24h 상수도 policy 로 이동).
function isExpired(record: ManagedShareReceipt, now = Date.now()) {
  return isExpiredAt(record, now);
}

function isStalePending(record: ManagedShareReceipt, now = Date.now()) {
  return isStalePendingAt(record, now);
}

function newManagedShare(fingerprint: string, now = new Date().toISOString()) {
  return newManagedShareAt(fingerprint, now, capabilityToken);
}

async function deleteManagedShareInTransaction(fingerprint: string) {
  await Promise.all([
    db().managedShares.delete(fingerprint),
    db().managedShareSecrets.delete(fingerprint),
  ]);
}

async function removeExpiredAndStaleManagedShares(now = Date.now()) {
  const [receipts, secrets] = await Promise.all([
    db().managedShares.toArray(),
    db().managedShareSecrets.toArray(),
  ]);
  const receiptFingerprints = new Set(receipts.map(({ fingerprint }) => fingerprint));
  const obsolete = receipts
    .filter((receipt) => isExpired(receipt, now) || isStalePending(receipt, now))
    .map(({ fingerprint }) => fingerprint);
  const orphanSecrets = secrets
    .filter(({ fingerprint }) => !receiptFingerprints.has(fingerprint))
    .map(({ fingerprint }) => fingerprint);
  await Promise.all([
    db().managedShares.bulkDelete(obsolete),
    db().managedShareSecrets.bulkDelete([...obsolete, ...orphanSecrets]),
  ]);
}

export async function prepareManagedShare(fingerprint: string): Promise<ManagedShare> {
  return db().transaction("rw", db().managedShares, db().managedShareSecrets, async () => {
    const [receipt, secret] = await Promise.all([
      db().managedShares.get(fingerprint),
      db().managedShareSecrets.get(fingerprint),
    ]);
    if (receipt && !isExpired(receipt) && !isStalePending(receipt) && secret) {
      return combineManagedShare(receipt, secret);
    }
    if (receipt && isCompleteReceipt(receipt) && !isExpired(receipt) && !secret) {
      throw new Error(
        "이 링크의 철회 키를 이 브라우저에서 찾을 수 없습니다. 기존 링크는 만료 전까지 철회할 수 없습니다.",
      );
    }
    await deleteManagedShareInTransaction(fingerprint);
    const pending = newManagedShare(fingerprint);
    await Promise.all([
      db().managedShares.add(pending.receipt),
      db().managedShareSecrets.add(pending.secret),
    ]);
    return pending.combined;
  });
}

/** Replace both bearer capabilities after an idempotency conflict. */
export async function rotateManagedShare(fingerprint: string): Promise<ManagedShare> {
  return db().transaction("rw", db().managedShares, db().managedShareSecrets, async () => {
    await deleteManagedShareInTransaction(fingerprint);
    const pending = newManagedShare(fingerprint);
    await Promise.all([
      db().managedShares.add(pending.receipt),
      db().managedShareSecrets.add(pending.secret),
    ]);
    return pending.combined;
  });
}

export async function completeManagedShare(
  fingerprint: string,
  receipt: { slug: string; revokeToken: string; expiresAt: string },
): Promise<ManagedShare> {
  // 형태 검증(정규식 2개 + Date.parse)은 공유 정책 isValidCompletionReceipt 가 정본이다.
  if (!isValidCompletionReceipt(receipt)) {
    throw new Error("Managed share receipt is invalid");
  }
  return db().transaction("rw", db().managedShares, db().managedShareSecrets, async () => {
    const [pending, secret] = await Promise.all([
      db().managedShares.get(fingerprint),
      db().managedShareSecrets.get(fingerprint),
    ]);
    if (!pending || !secret || secret.revokeToken !== receipt.revokeToken) {
      throw new Error("Managed share capability changed during creation");
    }
    const active: ManagedShareReceipt = {
      ...pending,
      slug: receipt.slug,
      expiresAt: receipt.expiresAt,
    };
    await db().managedShares.put(active);
    return combineManagedShare(active, secret);
  });
}

export async function getManagedShareReceipt(
  fingerprint: string,
): Promise<ManagedShareSummary | null> {
  return db().transaction("rw", db().managedShares, db().managedShareSecrets, async () => {
    const receipt = await db().managedShares.get(fingerprint);
    if (!receipt) return null;
    if (isExpired(receipt) || isStalePending(receipt)) {
      await deleteManagedShareInTransaction(fingerprint);
      return null;
    }
    if (!isCompleteReceipt(receipt)) return null;
    return {
      ...receipt,
      canRevoke: (await db().managedShareSecrets.get(fingerprint)) !== undefined,
    };
  });
}

export async function getManagedShare(fingerprint: string): Promise<ManagedShare | null> {
  return db().transaction("rw", db().managedShares, db().managedShareSecrets, async () => {
    const [receipt, secret] = await Promise.all([
      db().managedShares.get(fingerprint),
      db().managedShareSecrets.get(fingerprint),
    ]);
    if (!receipt) {
      if (secret) await db().managedShareSecrets.delete(fingerprint);
      return null;
    }
    if (isExpired(receipt) || isStalePending(receipt)) {
      await deleteManagedShareInTransaction(fingerprint);
      return null;
    }
    return isCompleteReceipt(receipt) && secret ? combineManagedShare(receipt, secret) : null;
  });
}

export async function listManagedShares(): Promise<ManagedShareSummary[]> {
  return db().transaction("rw", db().managedShares, db().managedShareSecrets, async () => {
    await removeExpiredAndStaleManagedShares();
    const [receipts, secrets] = await Promise.all([
      db().managedShares.toArray(),
      db().managedShareSecrets.toArray(),
    ]);
    const secretFingerprints = new Set(secrets.map(({ fingerprint }) => fingerprint));
    return receipts
      .filter(isCompleteReceipt)
      .map((receipt) => ({
        ...receipt,
        canRevoke: secretFingerprints.has(receipt.fingerprint),
      }))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  });
}

export async function deleteManagedShare(fingerprint: string) {
  await db().transaction("rw", db().managedShares, db().managedShareSecrets, () =>
    deleteManagedShareInTransaction(fingerprint),
  );
}

export async function listTickets(): Promise<TicketSnapshot[]> {
  return db().tickets.orderBy("createdAt").reverse().toArray();
}

export async function listImports(): Promise<ImportedShare[]> {
  return db().imports.orderBy("importedAt").reverse().toArray();
}

export async function getProfile(): Promise<ProfileRecord> {
  return (await db().profile.get(PROFILE_ID)) ?? emptyProfile();
}

export function observeProfile(
  onValue: (profile: ProfileRecord) => void,
  onError: (error: unknown) => void,
) {
  const subscription = liveQuery(() => db().profile.get(PROFILE_ID)).subscribe({
    next: (profile) => onValue(profile ?? emptyProfile()),
    error: onError,
  });
  return () => subscription.unsubscribe();
}

export async function saveProfile(
  patch: Partial<Pick<ProfileRecord, "nickname" | "colorId" | "photo">>,
): Promise<ProfileRecord> {
  return db().transaction("rw", db().profile, async () => {
    const current = (await db().profile.get(PROFILE_ID)) ?? emptyProfile();
    const next: ProfileRecord = {
      ...current,
      ...patch,
      id: PROFILE_ID,
      updatedAt: new Date().toISOString(),
    };
    await db().profile.put(next);
    return next;
  });
}

export async function clearProfilePhoto(): Promise<ProfileRecord> {
  return db().transaction("rw", db().profile, async () => {
    const current = (await db().profile.get(PROFILE_ID)) ?? emptyProfile();
    const next: ProfileRecord = {
      id: PROFILE_ID,
      nickname: current.nickname,
      colorId: current.colorId,
      updatedAt: new Date().toISOString(),
    };
    await db().profile.put(next);
    return next;
  });
}

export async function clearLocalDataForTests() {
  await db().delete();
  database = null;
}
