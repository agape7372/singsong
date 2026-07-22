import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSharedSnapshot, fingerprintSharedSnapshot } from "@/domain/canonical";
import { calculatePlan } from "@/domain/calculation";
import type { Plan, TicketSnapshot } from "@/domain/models";
import {
  claimTicketMotion,
  clearLocalDataForTests,
  getActivePlan,
  getTicket,
  importSharedPlan,
  mutateActivePlan,
  saveTicket,
} from "@/data/plan-database";

afterEach(async () => {
  vi.restoreAllMocks();
  await clearLocalDataForTests();
});

function readyPlan(revision = 1): Plan {
  return {
    id: "active-plan",
    revision,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    people: 4,
    pricing: { kind: "song", singlePriceWon: 1_000 },
    items: [
      {
        id: "track-1",
        source: "manual",
        catalogSongId: null,
        title: "Atomic Song",
        artist: "Singer",
        karaokeCodes: [],
        order: 0,
      },
    ],
  };
}

async function ticketForSeed(plan: Plan, artworkSeed: string): Promise<TicketSnapshot> {
  const calculation = calculatePlan(plan.items.length, plan.pricing!, plan.people!);
  const payload = buildSharedSnapshot(plan, calculation, artworkSeed);
  return {
    planId: plan.id,
    revision: plan.revision,
    payload,
    canonicalPayload: JSON.stringify(payload),
    artworkSeed,
    fingerprint: await fingerprintSharedSnapshot(payload),
    issueMotionClaimedAt: null,
    createdAt: "2026-07-22T00:00:00.000Z",
  };
}

describe("local database concurrency and atomicity", () => {
  it("makes concurrent ticket writers reuse one immutable seed and one motion claim", async () => {
    const plan = readyPlan();
    const candidateA = await ticketForSeed(plan, "AAAAAAAAAAAAAAAAAAAAAA");
    const candidateB = await ticketForSeed(plan, "BBBBBBBBBBBBBBBBBBBBBA");
    expect(candidateA.artworkSeed).not.toBe(candidateB.artworkSeed);

    const [resultA, resultB] = await Promise.all([saveTicket(candidateA), saveTicket(candidateB)]);
    const stored = await getTicket(plan.id, plan.revision);
    expect(resultA).toEqual(resultB);
    expect(stored).toEqual(resultA);
    expect([candidateA.artworkSeed, candidateB.artworkSeed]).toContain(stored!.artworkSeed);
    expect(stored!.canonicalPayload).toBe(resultA.canonicalPayload);
    expect(stored!.fingerprint).toBe(resultA.fingerprint);

    const claims = await Promise.all([
      claimTicketMotion(plan.id, plan.revision),
      claimTicketMotion(plan.id, plan.revision),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("rolls back the plan write when the second store fails during import", async () => {
    const initial = await getActivePlan();
    const local = await mutateActivePlan(initial.revision, () => ({
      people: 2,
      pricing: { kind: "song" as const, singlePriceWon: 500 },
      items: readyPlan().items,
    }));
    const incomingPlan = readyPlan(local.revision);
    const payload = buildSharedSnapshot(
      incomingPlan,
      calculatePlan(1, incomingPlan.pricing!, incomingPlan.people!),
      "CCCCCCCCCCCCCCCCCCCCCA",
    );
    const beforeFault = structuredClone(await getActivePlan());
    const originalAdd = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === "imports") {
        throw new DOMException("injected imports-store failure", "QuotaExceededError");
      }
      return key === undefined ? originalAdd.call(this, value) : originalAdd.call(this, value, key);
    });

    await expect(
      importSharedPlan(local.revision, "DDDDDDDDDDDDDDDDDDDDDA", payload),
    ).rejects.toThrow("injected imports-store failure");
    expect(await getActivePlan()).toEqual(beforeFault);

    vi.restoreAllMocks();
    const retry = await importSharedPlan(local.revision, "DDDDDDDDDDDDDDDDDDDDDA", payload);
    expect(retry.status).toBe("imported");
    expect(retry.plan.revision).toBe(local.revision + 1);
  });
});
