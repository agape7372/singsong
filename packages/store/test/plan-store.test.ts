import { describe, expect, it } from "vitest";

import {
  buildSharedSnapshot,
  calculatePlan,
  createTicketSnapshot,
  fingerprintSharedSnapshot,
} from "@singsong/domain";
import type { Plan, TicketSnapshot } from "@singsong/domain/models";
import { webSha256 } from "@singsong/domain/web-ports";

import {
  claimTicketMotion,
  closePlanStore,
  getActivePlan,
  getTicket,
  importSharedPlan,
  listImports,
  listTickets,
  mutateActivePlan,
  observeActivePlan,
  openPlanStore,
  RevisionConflictError,
  saveTicket,
} from "../src/index";
import { createNodeSqlExecutor } from "./node-sql-executor";
import { faultyExecutor } from "./faulty-executor";
import { FIXED_NOW_ISO, openTestStore, testDomainPorts, testStorePorts } from "./helpers";

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
    fingerprint: await fingerprintSharedSnapshot(payload, webSha256),
    issueMotionClaimedAt: null,
    createdAt: FIXED_NOW_ISO,
  };
}

describe("single active plan CAS", () => {
  it("T1: 옵저버가 자기 쿼리를 무효화하지 않고 초기 플랜(revision 0)을 낸다", async () => {
    const { store } = await openTestStore();
    try {
      let calls = 0;
      const firstPlan = new Promise<Plan>((resolve, reject) => {
        const stop = observeActivePlan(
          store,
          (plan) => {
            calls += 1;
            stop();
            resolve(plan);
          },
          reject,
        );
      });
      await expect(firstPlan).resolves.toMatchObject({ id: "active-plan", revision: 0 });
      // 초기 읽기는 통지하지 않으므로(change-bus 불변식 2) 리스너가 되불리지 않는다.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(calls).toBe(1);
    } finally {
      await closePlanStore(store);
    }
  });

  it("T2: 한 revision 만 커밋하고 stale writer 는 RevisionConflictError", async () => {
    const { store } = await openTestStore();
    try {
      const initial = await getActivePlan(store);
      const committed = await mutateActivePlan(store, initial.revision, (current) => ({
        items: current.items,
        people: 3,
        pricing: { kind: "song", singlePriceWon: 1_000 },
      }));
      expect(committed.revision).toBe(1);
      await expect(
        mutateActivePlan(store, initial.revision, (current) => ({
          items: current.items,
          people: 4,
          pricing: current.pricing,
        })),
      ).rejects.toBeInstanceOf(RevisionConflictError);
      expect((await getActivePlan(store)).people).toBe(3);
    } finally {
      await closePlanStore(store);
    }
  });

  it("T3: import 는 정확히 1회, 병합이 아니라 치환", async () => {
    const { store } = await openTestStore();
    try {
      const initial = await getActivePlan(store);
      const local = await mutateActivePlan(store, initial.revision, () => ({
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
      const imported = await importSharedPlan(
        store,
        local.revision,
        "HHHHHHHHHHHHHHHHHHHHHA",
        payload,
      );
      expect(imported.status).toBe("imported");
      const duplicate = await importSharedPlan(
        store,
        imported.plan.revision,
        "HHHHHHHHHHHHHHHHHHHHHA",
        payload,
      );
      expect(duplicate.status).toBe("already-imported");
      expect((await getActivePlan(store)).items).toHaveLength(1);
    } finally {
      await closePlanStore(store);
    }
  });
});

describe("library accessors", () => {
  it("T11: 발권 티켓이 최신순", async () => {
    const { store } = await openTestStore();
    try {
      const initial = await getActivePlan(store);
      const plan = await mutateActivePlan(store, initial.revision, () => ({
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
      const base = await createTicketSnapshot(plan, testDomainPorts);
      // ★ createdAt 을 서로 다르게 준다(07-01 / 07-05) — 동률 정렬은 쓰지 않는다(§2.5, M13).
      await saveTicket(store, {
        ...base,
        revision: 1,
        createdAt: "2026-07-01T00:00:00.000Z",
        fingerprint: "a".repeat(64),
      });
      await saveTicket(store, {
        ...base,
        revision: 2,
        createdAt: "2026-07-05T00:00:00.000Z",
        fingerprint: "b".repeat(64),
      });
      const tickets = await listTickets(store);
      expect(tickets.map((ticket) => ticket.revision)).toEqual([2, 1]);
      expect(tickets[0]?.payload.items.length).toBe(1);
    } finally {
      await closePlanStore(store);
    }
  });

  it("T12: import 목록이 최신순", async () => {
    const { store } = await openTestStore();
    try {
      const initial = await getActivePlan(store);
      const plan = await mutateActivePlan(store, initial.revision, () => ({
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
      const first = await importSharedPlan(store, plan.revision, "C".repeat(21) + "A", payload);
      await importSharedPlan(store, first.plan.revision, "D".repeat(21) + "A", payload);
      const imports = await listImports(store);
      expect(imports).toHaveLength(2);
      expect(imports.every((share) => typeof share.importedAt === "string")).toBe(true);
    } finally {
      await closePlanStore(store);
    }
  });
});

describe("concurrency and atomicity", () => {
  it("T15: 동시 티켓 writer 가 하나의 불변 seed 를 공유하고 motion claim 은 정확히 1회", async () => {
    // ★ 이 테스트가 뮤텍스의 유일한 증명이다. 뮤텍스 없으면 Promise.all([transaction,transaction])
    //    → `cannot start a transaction within a transaction`(M5). 있으면 원본 어서션 그대로(M6). §3.3.
    const { store } = await openTestStore();
    try {
      const plan = readyPlan();
      const candidateA = await ticketForSeed(plan, "AAAAAAAAAAAAAAAAAAAAAA");
      const candidateB = await ticketForSeed(plan, "BBBBBBBBBBBBBBBBBBBBBA");
      expect(candidateA.artworkSeed).not.toBe(candidateB.artworkSeed);

      const [resultA, resultB] = await Promise.all([
        saveTicket(store, candidateA),
        saveTicket(store, candidateB),
      ]);
      const stored = await getTicket(store, plan.id, plan.revision);
      expect(resultA).toEqual(resultB);
      expect(stored).toEqual(resultA);
      expect([candidateA.artworkSeed, candidateB.artworkSeed]).toContain(stored!.artworkSeed);
      expect(stored!.canonicalPayload).toBe(resultA.canonicalPayload);
      expect(stored!.fingerprint).toBe(resultA.fingerprint);

      const claims = await Promise.all([
        claimTicketMotion(store, plan.id, plan.revision),
        claimTicketMotion(store, plan.id, plan.revision),
      ]);
      expect(claims.filter(Boolean)).toHaveLength(1);
    } finally {
      await closePlanStore(store);
    }
  });

  it("T16: import 중 두 번째 저장이 실패하면 플랜 쓰기도 롤백되고 재시도는 성공", async () => {
    const inner = createNodeSqlExecutor();
    let failing = true;
    // ★ tx 까지 감싼 실행기가 imported_share 삽입에서만 던진다(crit §C-6). 최상위만 감쌌다면
    //    이 주입은 절대 발화하지 않고 이 테스트는 무음 green 이 됐을 것 — firedCount 로 방지.
    const faulty = faultyExecutor(
      inner,
      (sql) => failing && /insert into imported_share/i.test(sql),
    );
    const store = await openPlanStore(faulty, testStorePorts);
    try {
      const initial = await getActivePlan(store);
      const local = await mutateActivePlan(store, initial.revision, () => ({
        people: 2,
        pricing: { kind: "song", singlePriceWon: 500 },
        items: readyPlan().items,
      }));
      const incomingPlan = readyPlan(local.revision);
      const payload = buildSharedSnapshot(
        incomingPlan,
        calculatePlan(1, incomingPlan.pricing!, incomingPlan.people!),
        "CCCCCCCCCCCCCCCCCCCCCA",
      );
      const beforeFault = await getActivePlan(store);

      await expect(
        importSharedPlan(store, local.revision, "DDDDDDDDDDDDDDDDDDDDDA", payload),
      ).rejects.toThrow(/injected/);
      expect(faulty.firedCount()).toBeGreaterThan(0); // 주입이 실제로 발화했다
      expect(await getActivePlan(store)).toEqual(beforeFault); // 롤백

      failing = false; // vi.restoreAllMocks 등가
      const retry = await importSharedPlan(
        store,
        local.revision,
        "DDDDDDDDDDDDDDDDDDDDDA",
        payload,
      );
      expect(retry.status).toBe("imported");
      expect(retry.plan.revision).toBe(local.revision + 1);
    } finally {
      await closePlanStore(store);
    }
  });
});
