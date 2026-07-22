import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { buildSharedSnapshot } from "@/domain/canonical";
import { calculatePlan } from "@/domain/calculation";
import {
  clearLocalDataForTests,
  completeManagedShare,
  deleteManagedShare,
  getActivePlan,
  getManagedShare,
  getManagedShareReceipt,
  importSharedPlan,
  listManagedShares,
  mutateActivePlan,
  observeActivePlan,
  prepareManagedShare,
  RevisionConflictError,
  rotateManagedShare,
} from "@/data/plan-database";

const DATABASE_NAME = "singsong-session-strip";

function readRawStore(storeName: string, key: IDBValidKey): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE_NAME);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const connection = opening.result;
      const transaction = connection.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      transaction.oncomplete = () => connection.close();
    };
  });
}

function writeRawStore(storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE_NAME);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const connection = opening.result;
      const transaction = connection.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(value);
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        connection.close();
        resolve();
      };
    };
  });
}

afterEach(async () => {
  await clearLocalDataForTests();
});

describe("single active plan CAS", () => {
  it("emits the initial plan instead of invalidating its own live query", async () => {
    const firstPlan = new Promise<Awaited<ReturnType<typeof getActivePlan>>>((resolve, reject) => {
      const stop = observeActivePlan((plan) => {
        stop();
        resolve(plan);
      }, reject);
    });

    await expect(firstPlan).resolves.toMatchObject({ id: "active-plan", revision: 0 });
  });

  it("commits one expected revision and rejects stale writers", async () => {
    const initial = await getActivePlan();
    const committed = await mutateActivePlan(initial.revision, (current) => ({
      items: current.items,
      people: 3,
      pricing: { kind: "song", singlePriceWon: 1_000 },
    }));
    expect(committed.revision).toBe(1);
    await expect(
      mutateActivePlan(initial.revision, (current) => ({
        items: current.items,
        people: 4,
        pricing: current.pricing,
      })),
    ).rejects.toBeInstanceOf(RevisionConflictError);
    expect((await getActivePlan()).people).toBe(3);
  });

  it("imports exactly once and replaces rather than silently merging", async () => {
    const initial = await getActivePlan();
    const local = await mutateActivePlan(initial.revision, () => ({
      people: 2,
      pricing: { kind: "song", singlePriceWon: 500 },
      items: [
        {
          id: "old",
          source: "manual",
          catalogSongId: null,
          title: "기존 곡",
          artist: "기존 가수",
          karaokeCodes: [],
          order: 0,
        },
      ],
    }));
    const payload = buildSharedSnapshot(
      local,
      calculatePlan(1, local.pricing!, local.people!),
      "GGGGGGGGGGGGGGGGGGGGGA",
    );
    const imported = await importSharedPlan(local.revision, "HHHHHHHHHHHHHHHHHHHHHA", payload);
    expect(imported.status).toBe("imported");
    const duplicate = await importSharedPlan(
      imported.plan.revision,
      "HHHHHHHHHHHHHHHHHHHHHA",
      payload,
    );
    expect(duplicate.status).toBe("already-imported");
    expect((await getActivePlan()).items).toHaveLength(1);
  });

  it("keeps management capabilities in a separate local-only table and deletes them on revoke", async () => {
    const fingerprint = "a".repeat(64);
    const pending = await prepareManagedShare(fingerprint);
    expect(pending.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{21}[AQgw]$/u);
    expect(pending.revokeToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(await getManagedShare(fingerprint)).toBeNull();
    expect(await readRawStore("managedShares", fingerprint)).toEqual({
      fingerprint,
      slug: null,
      expiresAt: null,
      createdAt: pending.createdAt,
    });
    expect(await readRawStore("managedShareSecrets", fingerprint)).toEqual({
      fingerprint,
      idempotencyKey: pending.idempotencyKey,
      revokeToken: pending.revokeToken,
      createdAt: pending.createdAt,
    });

    const active = await completeManagedShare(fingerprint, {
      slug: `${"S".repeat(21)}A`,
      revokeToken: pending.revokeToken,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(await getManagedShare(fingerprint)).toEqual(active);
    const [summary] = await listManagedShares();
    expect(summary).toEqual({
      fingerprint,
      slug: active.slug,
      expiresAt: active.expiresAt,
      createdAt: active.createdAt,
      canRevoke: true,
    });
    expect(summary).not.toHaveProperty("idempotencyKey");
    expect(summary).not.toHaveProperty("revokeToken");

    await deleteManagedShare(fingerprint);
    expect(await getManagedShare(fingerprint)).toBeNull();
    expect(await readRawStore("managedShares", fingerprint)).toBeUndefined();
    expect(await readRawStore("managedShareSecrets", fingerprint)).toBeUndefined();
  });

  it("losslessly upgrades v3 rows while stripping raw capabilities from public receipts", async () => {
    const fingerprint = "b".repeat(64);
    const createdAt = "2026-07-21T00:00:00.000Z";
    const expiresAt = "2099-07-21T00:00:00.000Z";
    const legacy = new Dexie(DATABASE_NAME);
    legacy.version(3).stores({
      plans: "&id,revision,updatedAt",
      tickets: "&[planId+revision],planId,revision,createdAt",
      imports: "&slug,importedAt,planRevision",
      managedShares: "&fingerprint,&slug,expiresAt",
    });
    await legacy.open();
    await legacy.table("managedShares").put({
      fingerprint,
      idempotencyKey: `${"I".repeat(21)}A`,
      revokeToken: "R".repeat(43),
      slug: `${"M".repeat(21)}A`,
      expiresAt,
      createdAt,
    });
    legacy.close();

    const migrated = await getManagedShare(fingerprint);
    expect(migrated).toEqual({
      fingerprint,
      idempotencyKey: `${"I".repeat(21)}A`,
      revokeToken: "R".repeat(43),
      slug: `${"M".repeat(21)}A`,
      expiresAt,
      createdAt,
    });
    expect(await readRawStore("managedShares", fingerprint)).toEqual({
      fingerprint,
      slug: `${"M".repeat(21)}A`,
      expiresAt,
      createdAt,
    });
    expect(await readRawStore("managedShareSecrets", fingerprint)).toEqual({
      fingerprint,
      idempotencyKey: `${"I".repeat(21)}A`,
      revokeToken: "R".repeat(43),
      createdAt,
    });
  });

  it("rotates both pending capabilities and removes expired receipts from both stores", async () => {
    const fingerprint = "c".repeat(64);
    const first = await prepareManagedShare(fingerprint);
    const rotated = await rotateManagedShare(fingerprint);
    expect(rotated.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(rotated.revokeToken).not.toBe(first.revokeToken);

    await completeManagedShare(fingerprint, {
      slug: `${"E".repeat(21)}A`,
      revokeToken: rotated.revokeToken,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
    expect(await listManagedShares()).toEqual([]);
    expect(await getManagedShareReceipt(fingerprint)).toBeNull();
    expect(await readRawStore("managedShares", fingerprint)).toBeUndefined();
    expect(await readRawStore("managedShareSecrets", fingerprint)).toBeUndefined();
  });

  it("purges abandoned pending capabilities after the bounded retry window", async () => {
    const fingerprint = "d".repeat(64);
    const pending = await prepareManagedShare(fingerprint);
    await writeRawStore("managedShares", {
      fingerprint,
      slug: null,
      expiresAt: null,
      createdAt: "2000-01-01T00:00:00.000Z",
    });
    await writeRawStore("managedShareSecrets", {
      fingerprint,
      idempotencyKey: pending.idempotencyKey,
      revokeToken: pending.revokeToken,
      createdAt: "2000-01-01T00:00:00.000Z",
    });

    expect(await listManagedShares()).toEqual([]);
    expect(await readRawStore("managedShares", fingerprint)).toBeUndefined();
    expect(await readRawStore("managedShareSecrets", fingerprint)).toBeUndefined();
  });
});
