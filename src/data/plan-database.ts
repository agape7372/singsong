import Dexie, { type EntityTable, type Table, liveQuery } from "dexie";
import type { Plan, SharedSnapshot, TicketSnapshot, Track } from "@/domain/models";
import { assertValidPlan } from "@/domain/validation";

export const ACTIVE_PLAN_ID = "active-plan";
const CHANNEL_NAME = "singsong-active-plan-v1";

class SingSongDatabase extends Dexie {
  plans!: EntityTable<Plan, "id">;
  tickets!: Table<TicketSnapshot, [string, number]>;
  imports!: EntityTable<ImportedShare, "slug">;
  managedShares!: EntityTable<ManagedShareReceipt, "fingerprint">;
  managedShareSecrets!: EntityTable<ManagedShareSecret, "fingerprint">;

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
  }
}

type ImportedShare = { slug: string; importedAt: string; planRevision: number };

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

export class RevisionConflictError extends Error {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`Plan revision changed: expected ${expected}, actual ${actual}`);
    this.name = "RevisionConflictError";
  }
}

export class PlanLimitError extends Error {
  constructor() {
    super("A plan can contain at most 100 tracks");
    this.name = "PlanLimitError";
  }
}

function newPlan(now = new Date().toISOString()): Plan {
  return {
    id: ACTIVE_PLAN_ID,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    items: [],
    people: null,
    pricing: null,
  };
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
    const mutable = mutation(structuredClone(current));
    if (mutable.items.length > 100) throw new PlanLimitError();
    const next: Plan = {
      ...mutable,
      id: ACTIVE_PLAN_ID,
      revision: current.revision + 1,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      items: mutable.items.map((item, order) => ({ ...item, order })),
    };
    assertValidPlan(next);
    await db().plans.put(next);
    return next;
  });
  signalRevision(updated.revision);
  return updated;
}

export async function replaceActivePlan(
  expectedRevision: number,
  items: readonly Track[],
  people: number | null = null,
  pricing: Plan["pricing"] = null,
) {
  return mutateActivePlan(expectedRevision, () => ({
    items: items.map((item, order) => ({ ...item, id: crypto.randomUUID(), order })),
    people,
    pricing,
  }));
}

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
    const plan: Plan = {
      id: ACTIVE_PLAN_ID,
      revision: current.revision + 1,
      createdAt: current.createdAt,
      updatedAt: now,
      items: payload.items.map((item, order) => ({
        id: crypto.randomUUID(),
        source: item.source,
        catalogSongId: null,
        title: item.title,
        artist: item.artist,
        karaokeCodes: item.karaokeCodes.map(({ vendor, code }) => ({ vendor, code })),
        order,
      })),
      people: payload.calculation.people,
      pricing: payload.calculation.pricing,
    };
    assertValidPlan(plan);
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

function capabilityToken(bytes: number) {
  const random = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  random.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

const PENDING_SHARE_RETENTION_MS = 24 * 60 * 60 * 1000;

function isExpired(record: ManagedShareReceipt, now = Date.now()) {
  return record.expiresAt !== null && Date.parse(record.expiresAt) <= now;
}

function isStalePending(record: ManagedShareReceipt, now = Date.now()) {
  return (
    record.slug === null &&
    (!Number.isFinite(Date.parse(record.createdAt)) ||
      Date.parse(record.createdAt) <= now - PENDING_SHARE_RETENTION_MS)
  );
}

function isCompleteReceipt(
  receipt: ManagedShareReceipt,
): receipt is ManagedShareReceipt & { slug: string; expiresAt: string } {
  return receipt.slug !== null && receipt.expiresAt !== null;
}

function combineManagedShare(receipt: ManagedShareReceipt, secret: ManagedShareSecret) {
  return { ...receipt, ...secret } satisfies ManagedShare;
}

function newManagedShare(fingerprint: string, now = new Date().toISOString()) {
  const receipt: ManagedShareReceipt = {
    fingerprint,
    slug: null,
    expiresAt: null,
    createdAt: now,
  };
  const secret: ManagedShareSecret = {
    fingerprint,
    idempotencyKey: capabilityToken(16),
    revokeToken: capabilityToken(32),
    createdAt: now,
  };
  return { receipt, secret, combined: combineManagedShare(receipt, secret) };
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
  if (
    !/^[A-Za-z0-9_-]{21}[AQgw]$/u.test(receipt.slug) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(receipt.revokeToken) ||
    !Number.isFinite(Date.parse(receipt.expiresAt))
  ) {
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

export async function clearLocalDataForTests() {
  await db().delete();
  database = null;
}
