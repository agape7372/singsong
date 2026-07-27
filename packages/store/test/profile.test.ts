import { describe, expect, it } from "vitest";

import { buildSharedSnapshot, calculatePlan } from "@singsong/domain";

import {
  clearProfilePhoto,
  closePlanStore,
  deleteAllLocalData,
  getActivePlan,
  getProfile,
  listManagedShares,
  listTickets,
  mutateActivePlan,
  prepareManagedShare,
  saveProfile,
} from "../src/index";
import { openTestStore } from "./helpers";

describe("device-local profile", () => {
  it("T8: 저장 전 중립 기본값(photoUri null)", async () => {
    const { store } = await openTestStore();
    try {
      const profile = await getProfile(store);
      expect(profile).toMatchObject({ id: "me", nickname: "", colorId: "rose" });
      expect(profile.photoUri).toBeNull();
    } finally {
      await closePlanStore(store);
    }
  });

  it("T9': 닉/색/사진 저장 후 사진만 지우기(store 판은 photoUri 문자열)", async () => {
    const { store } = await openTestStore();
    try {
      await saveProfile(store, { nickname: "지민", colorId: "teal", photoUri: "file:///a.jpg" });
      const saved = await getProfile(store);
      expect(saved).toMatchObject({ nickname: "지민", colorId: "teal" });
      expect(saved.photoUri).toBe("file:///a.jpg");

      const cleared = await clearProfilePhoto(store);
      expect(cleared.photoUri).toBeNull();
      expect(cleared).toMatchObject({ nickname: "지민", colorId: "teal" });
    } finally {
      await closePlanStore(store);
    }
  });

  it("T10: 프로필이 공유 스냅샷에 새지 않는다", async () => {
    const { store } = await openTestStore();
    try {
      await saveProfile(store, { nickname: "지민", colorId: "plum" });
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
      const snapshot = buildSharedSnapshot(
        plan,
        calculatePlan(1, plan.pricing!, plan.people!),
        "A".repeat(21) + "A",
      );
      const serialized = JSON.stringify(snapshot);
      expect(serialized).not.toContain("지민");
      expect(serialized).not.toContain("nickname");
      expect(serialized).not.toContain("photo");
    } finally {
      await closePlanStore(store);
    }
  });
});

describe("deleteAllLocalData", () => {
  it("전 테이블을 비우고 재수화한다 — 이후 mutate(0)이 영구 conflict 없이 성공한다", async () => {
    const { store, executor } = await openTestStore();
    try {
      // 데이터를 심는다.
      const initial = await getActivePlan(store);
      const local = await mutateActivePlan(store, initial.revision, () => ({
        people: 2,
        pricing: { kind: "song", singlePriceWon: 500 },
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
      await saveProfile(store, { nickname: "지민", colorId: "teal" });
      await prepareManagedShare(store, "a".repeat(64));
      expect(local.revision).toBe(1);

      await deleteAllLocalData(store);

      // 재수화된 활성 플랜은 revision 0.
      const afterPlan = await getActivePlan(store);
      expect(afterPlan.revision).toBe(0);
      expect(afterPlan.items).toEqual([]);
      // 프로필·티켓·공유는 비었다.
      expect(await getProfile(store)).toMatchObject({ nickname: "", colorId: "rose" });
      expect(await listTickets(store)).toEqual([]);
      expect(await listManagedShares(store)).toEqual([]);
      // 전 테이블 실제로 비었는지(재수화된 plan 1행 제외).
      const planCount = await executor.get<{ n: number }>("select count(*) as n from plan");
      expect(planCount?.n).toBe(1);
      const shareCount = await executor.get<{ n: number }>(
        "select count(*) as n from managed_share_receipt",
      );
      expect(shareCount?.n).toBe(0);

      // ★ crit §C-5 의 핵심: 재수화가 없으면 여기서 영구 RevisionConflictError 가 났을 것.
      const remutated = await mutateActivePlan(store, afterPlan.revision, (current) => ({
        items: current.items,
        people: 3,
        pricing: { kind: "song", singlePriceWon: 900 },
      }));
      expect(remutated.revision).toBe(1);
    } finally {
      await closePlanStore(store);
    }
  });
});
