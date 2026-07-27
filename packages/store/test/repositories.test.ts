import { describe, expect, it } from "vitest";

import { buildSharedSnapshot, calculatePlan } from "@singsong/domain";
import type { Plan, SharedSnapshot, TicketSnapshot } from "@singsong/domain/models";

import { readPlanRow, writePlanRow } from "../src/repositories/plan";
import {
  claimMotion,
  getTicketRow,
  insertTicketIfAbsent,
  listTicketRows,
} from "../src/repositories/ticket";
import { getImportBySlug, insertImport, listImportRows } from "../src/repositories/imported-share";
import {
  deleteReceipts,
  deleteSecret,
  deleteSecrets,
  deleteShare,
  getReceipt,
  getSecret,
  insertReceipt,
  insertSecret,
  listReceipts,
  putReceipt,
} from "../src/repositories/managed-share";
import { getProfileRow, upsertProfile } from "../src/repositories/profile";
import { createMigratedExecutor, FIXED_NOW_ISO } from "./helpers";

function planWith(over: Partial<Plan> = {}): Plan {
  return {
    id: "active-plan",
    revision: 3,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: FIXED_NOW_ISO,
    items: [
      {
        id: "t1",
        source: "manual",
        catalogSongId: null,
        title: "곡🎤 유니코드",
        artist: "가수",
        karaokeCodes: [{ vendor: "TJ", code: "91234" }],
        order: 0,
      },
    ],
    people: 4,
    pricing: { kind: "song", singlePriceWon: 1_000, bundle: { songs: 3, priceWon: 2_500 } },
    ...over,
  };
}

function makePayload(): SharedSnapshot {
  const plan = planWith();
  return buildSharedSnapshot(
    plan,
    calculatePlan(1, plan.pricing!, plan.people!),
    "A".repeat(21) + "A",
  );
}

function ticketWith(over: Partial<TicketSnapshot> = {}): TicketSnapshot {
  const payload = makePayload();
  return {
    planId: "active-plan",
    revision: 1,
    payload,
    canonicalPayload: JSON.stringify(payload),
    artworkSeed: payload.artworkSeed,
    fingerprint: "a".repeat(64),
    issueMotionClaimedAt: null,
    createdAt: FIXED_NOW_ISO,
    ...over,
  };
}

describe("plan repository", () => {
  it("유니코드·중첩 pricing 을 JSON 으로 무손실 왕복한다", async () => {
    const executor = await createMigratedExecutor();
    try {
      const plan = planWith();
      await writePlanRow(executor, plan);
      expect(await readPlanRow(executor, "active-plan")).toEqual(plan);
    } finally {
      await executor.close();
    }
  });

  it("people·pricing null 을 null 로 왕복한다(undefined 로 새지 않는다)", async () => {
    const executor = await createMigratedExecutor();
    try {
      const plan = planWith({ items: [], people: null, pricing: null });
      await writePlanRow(executor, plan);
      const read = await readPlanRow(executor, "active-plan");
      expect(read?.people).toBeNull();
      expect(read?.pricing).toBeNull();
    } finally {
      await executor.close();
    }
  });

  it("upsert 는 전체 치환이다(WHERE 가드 없음 — CAS 는 호출부 몫)", async () => {
    const executor = await createMigratedExecutor();
    try {
      await writePlanRow(executor, planWith({ revision: 1 }));
      await writePlanRow(executor, planWith({ revision: 2, people: 2 }));
      const read = await readPlanRow(executor, "active-plan");
      expect(read?.revision).toBe(2);
      expect(read?.people).toBe(2);
    } finally {
      await executor.close();
    }
  });

  it("없는 행은 null", async () => {
    const executor = await createMigratedExecutor();
    try {
      expect(await readPlanRow(executor, "active-plan")).toBeNull();
    } finally {
      await executor.close();
    }
  });
});

describe("ticket repository", () => {
  it("first-write-wins — 두 번째 삽입은 무시되고 첫 값을 되읽는다", async () => {
    const executor = await createMigratedExecutor();
    try {
      const first = await insertTicketIfAbsent(
        executor,
        ticketWith({ artworkSeed: "A".repeat(21) + "A" }),
      );
      const second = await insertTicketIfAbsent(
        executor,
        ticketWith({ artworkSeed: "B".repeat(21) + "A", fingerprint: "b".repeat(64) }),
      );
      expect(second).toEqual(first); // 첫 값 유지
      expect((await getTicketRow(executor, "active-plan", 1))?.artworkSeed).toBe(first.artworkSeed);
    } finally {
      await executor.close();
    }
  });

  it("claimMotion 은 처음만 true, 재청구·없는 행은 false", async () => {
    const executor = await createMigratedExecutor();
    try {
      await insertTicketIfAbsent(executor, ticketWith());
      expect(await claimMotion(executor, "active-plan", 1, FIXED_NOW_ISO)).toBe(true);
      expect(await claimMotion(executor, "active-plan", 1, FIXED_NOW_ISO)).toBe(false);
      expect(await claimMotion(executor, "active-plan", 999, FIXED_NOW_ISO)).toBe(false);
    } finally {
      await executor.close();
    }
  });

  it("listTicketRows 는 created_at desc, 동률은 plan_id asc·revision desc(SQL 정본, Dexie 와 다름)", async () => {
    const executor = await createMigratedExecutor();
    try {
      const same = "2026-07-27T00:00:00.000Z";
      for (const [planId, revision] of [
        ["a", 1],
        ["a", 2],
        ["b", 1],
      ] as const) {
        await insertTicketIfAbsent(
          executor,
          ticketWith({
            planId,
            revision,
            createdAt: same,
            fingerprint: `${planId}${revision}`.padEnd(64, "0"),
          }),
        );
      }
      const rows = await listTicketRows(executor);
      // ★ SQL 정본 = a#2 a#1 b#1 (Dexie reverse() 는 b#1 a#2 a#1, M13). 곧 삭제될 Dexie 에
      //    맞추려 인덱스 방향을 바꾸지 않는다(§2.5).
      expect(rows.map((row) => `${row.planId}#${row.revision}`)).toEqual(["a#2", "a#1", "b#1"]);
    } finally {
      await executor.close();
    }
  });
});

describe("imported-share repository", () => {
  it("삽입·조회·최신순 목록", async () => {
    const executor = await createMigratedExecutor();
    try {
      await insertImport(executor, {
        slug: "S".repeat(21) + "A",
        importedAt: "2026-07-01T00:00:00.000Z",
        planRevision: 1,
      });
      await insertImport(executor, {
        slug: "T".repeat(21) + "A",
        importedAt: "2026-07-05T00:00:00.000Z",
        planRevision: 2,
      });
      expect(await getImportBySlug(executor, "S".repeat(21) + "A")).toMatchObject({
        planRevision: 1,
      });
      expect(await getImportBySlug(executor, "없음")).toBeNull();
      const list = await listImportRows(executor);
      expect(list.map((row) => row.planRevision)).toEqual([2, 1]); // 최신 먼저
    } finally {
      await executor.close();
    }
  });
});

describe("managed-share repository", () => {
  const fp = "a".repeat(64);

  it("영수증·secret 왕복 + putReceipt 완성 + deleteShare", async () => {
    const executor = await createMigratedExecutor();
    try {
      await insertReceipt(executor, {
        fingerprint: fp,
        slug: null,
        expiresAt: null,
        createdAt: FIXED_NOW_ISO,
      });
      await insertSecret(executor, {
        fingerprint: fp,
        idempotencyKey: "k",
        revokeToken: "r",
        createdAt: FIXED_NOW_ISO,
      });
      expect(await getReceipt(executor, fp)).toEqual({
        fingerprint: fp,
        slug: null,
        expiresAt: null,
        createdAt: FIXED_NOW_ISO,
      });
      expect(await getSecret(executor, fp)).toMatchObject({
        idempotencyKey: "k",
        revokeToken: "r",
      });

      await putReceipt(executor, {
        fingerprint: fp,
        slug: "S".repeat(21) + "A",
        expiresAt: "2099-01-01T00:00:00.000Z",
        createdAt: FIXED_NOW_ISO,
      });
      expect((await getReceipt(executor, fp))?.slug).toBe("S".repeat(21) + "A");

      await deleteShare(executor, fp);
      expect(await getReceipt(executor, fp)).toBeNull();
      expect(await getSecret(executor, fp)).toBeNull();
    } finally {
      await executor.close();
    }
  });

  it("deleteSecret 은 secret 만 지운다(고아 정리 경로)", async () => {
    const executor = await createMigratedExecutor();
    try {
      await insertSecret(executor, {
        fingerprint: fp,
        idempotencyKey: "k",
        revokeToken: "r",
        createdAt: FIXED_NOW_ISO,
      });
      await deleteSecret(executor, fp);
      expect(await getSecret(executor, fp)).toBeNull();
    } finally {
      await executor.close();
    }
  });

  it("listReceipts 최신순 + 일괄 삭제", async () => {
    const executor = await createMigratedExecutor();
    try {
      await insertReceipt(executor, {
        fingerprint: "a".repeat(64),
        slug: null,
        expiresAt: null,
        createdAt: "2026-07-01T00:00:00.000Z",
      });
      await insertReceipt(executor, {
        fingerprint: "b".repeat(64),
        slug: null,
        expiresAt: null,
        createdAt: "2026-07-05T00:00:00.000Z",
      });
      expect((await listReceipts(executor)).map((r) => r.fingerprint[0])).toEqual(["b", "a"]);
      await deleteReceipts(executor, ["a".repeat(64), "b".repeat(64)]);
      await deleteSecrets(executor, []);
      expect(await listReceipts(executor)).toEqual([]);
    } finally {
      await executor.close();
    }
  });
});

describe("profile repository", () => {
  it("photoUri null·문자열을 왕복하고 upsert 는 전체 치환", async () => {
    const executor = await createMigratedExecutor();
    try {
      await upsertProfile(executor, {
        id: "me",
        nickname: "지민",
        colorId: "teal",
        photoUri: null,
        updatedAt: FIXED_NOW_ISO,
      });
      expect(await getProfileRow(executor, "me")).toEqual({
        id: "me",
        nickname: "지민",
        colorId: "teal",
        photoUri: null,
        updatedAt: FIXED_NOW_ISO,
      });
      await upsertProfile(executor, {
        id: "me",
        nickname: "지민",
        colorId: "teal",
        photoUri: "file:///a.jpg",
        updatedAt: FIXED_NOW_ISO,
      });
      expect((await getProfileRow(executor, "me"))?.photoUri).toBe("file:///a.jpg");
    } finally {
      await executor.close();
    }
  });
});
