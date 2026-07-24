import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { buildSharedSnapshot, createTicketSnapshot } from "@/domain/canonical";
import { calculatePlan } from "@/domain/calculation";
import { addCatalogTracks } from "@/features/plan/add-tracks";
import type { CatalogTrack } from "@/features/catalog/types";
import {
  clearLocalDataForTests,
  clearProfilePhoto,
  completeManagedShare,
  deleteManagedShare,
  getActivePlan,
  getManagedShare,
  getManagedShareReceipt,
  getProfile,
  importSharedPlan,
  listImports,
  listManagedShares,
  listTickets,
  mutateActivePlan,
  observeActivePlan,
  prepareManagedShare,
  RevisionConflictError,
  rotateManagedShare,
  saveProfile,
  saveTicket,
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

describe("device-local profile", () => {
  it("returns a neutral default before anything is saved", async () => {
    const profile = await getProfile();
    expect(profile).toMatchObject({ id: "me", nickname: "", colorId: "rose" });
    expect(profile.photo).toBeUndefined();
  });

  it("persists nickname, color, and a local photo, then clears just the photo", async () => {
    const photo = new Blob(["local-only"], { type: "image/png" });
    await saveProfile({ nickname: "지민", colorId: "teal", photo });
    const saved = await getProfile();
    expect(saved).toMatchObject({ nickname: "지민", colorId: "teal" });
    expect(saved.photo).toBeInstanceOf(Blob);

    const cleared = await clearProfilePhoto();
    expect(cleared.photo).toBeUndefined();
    expect(cleared).toMatchObject({ nickname: "지민", colorId: "teal" });
  });

  it("keeps the profile out of the shared snapshot the app can build", async () => {
    await saveProfile({ nickname: "지민", colorId: "plum" });
    const initial = await getActivePlan();
    const plan = await mutateActivePlan(initial.revision, () => ({
      people: 2,
      pricing: { kind: "song", singlePriceWon: 1_000 },
      items: [
        {
          id: "t1",
          source: "manual",
          catalogSongId: null,
          title: "곡",
          artist: "가수",
          karaokeCodes: [],
          order: 0,
        },
      ],
    }));
    const snapshot = buildSharedSnapshot(
      plan,
      calculatePlan(1, plan.pricing!, plan.people!),
      "A".repeat(21) + "A",
    );
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("지민");
    expect(serialized).not.toContain("nickname");
    expect(serialized).not.toContain("photo");
  });
});

describe("library accessors", () => {
  it("lists issued tickets newest first", async () => {
    const initial = await getActivePlan();
    const plan = await mutateActivePlan(initial.revision, () => ({
      people: 2,
      pricing: { kind: "song", singlePriceWon: 1_000 },
      items: [
        {
          id: "t1",
          source: "manual",
          catalogSongId: null,
          title: "곡",
          artist: "가수",
          karaokeCodes: [],
          order: 0,
        },
      ],
    }));
    const base = await createTicketSnapshot(plan);
    await saveTicket({
      ...base,
      revision: 1,
      createdAt: "2026-07-01T00:00:00.000Z",
      fingerprint: "a".repeat(64),
    });
    await saveTicket({
      ...base,
      revision: 2,
      createdAt: "2026-07-05T00:00:00.000Z",
      fingerprint: "b".repeat(64),
    });

    const tickets = await listTickets();
    expect(tickets.map((ticket) => ticket.revision)).toEqual([2, 1]);
    expect(tickets[0]?.payload.items.length).toBe(1);
  });

  it("lists imported shares newest first", async () => {
    const initial = await getActivePlan();
    const plan = await mutateActivePlan(initial.revision, () => ({
      people: 2,
      pricing: { kind: "song", singlePriceWon: 500 },
      items: [
        {
          id: "seed",
          source: "manual",
          catalogSongId: null,
          title: "곡",
          artist: "가수",
          karaokeCodes: [],
          order: 0,
        },
      ],
    }));
    const payload = buildSharedSnapshot(
      plan,
      calculatePlan(1, plan.pricing!, plan.people!),
      "B".repeat(21) + "A",
    );
    const first = await importSharedPlan(plan.revision, "C".repeat(21) + "A", payload);
    await importSharedPlan(first.plan.revision, "D".repeat(21) + "A", payload);

    const imports = await listImports();
    expect(imports).toHaveLength(2);
    expect(imports.every((share) => typeof share.importedAt === "string")).toBe(true);
  });
});

describe("addCatalogTracks (발견 담기)", () => {
  const track = (id: string): CatalogTrack => ({
    id,
    title: `곡 ${id}`,
    artist: "가수",
    karaokeCodes: { TJ: "91234" },
    source: "fixture",
  });

  it("appends catalog tracks and skips duplicates by catalog id", async () => {
    const first = await addCatalogTracks([track("a"), track("b")]);
    expect(first).toMatchObject({ added: 2, skippedDuplicate: 0, skippedFull: 0 });

    const again = await addCatalogTracks([track("a"), track("c")]);
    expect(again).toMatchObject({ added: 1, skippedDuplicate: 1 });

    const plan = await getActivePlan();
    expect(plan.items.map((item) => item.catalogSongId)).toEqual(["a", "b", "c"]);
    expect(plan.items.every((item) => item.source === "catalog")).toBe(true);
  });

  it("never exceeds the 100-track limit", async () => {
    const many = Array.from({ length: 130 }, (_, index) => track(`t${index}`));
    const result = await addCatalogTracks(many);
    expect(result.added).toBe(100);
    expect(result.skippedFull).toBe(30);
    expect((await getActivePlan()).items).toHaveLength(100);
  });
});
