import { describe, expect, it } from "vitest";

import {
  completeManagedShare,
  closePlanStore,
  deleteManagedShare,
  getManagedShare,
  getManagedShareReceipt,
  listManagedShares,
  prepareManagedShare,
  rotateManagedShare,
} from "../src/index";
import { FIXED_NOW_ISO, openTestStore } from "./helpers";

const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z"; // FIXED_NOW(2026-07-22) 이전 → 만료/stale

describe("managed share 공개 API", () => {
  it("T4: capability 를 별도 로컬 테이블에 두고 revoke 시 지운다", async () => {
    const { store, executor } = await openTestStore();
    try {
      const fingerprint = "a".repeat(64);

      // ★ SQL 에서는 raw capability 가 영수증 테이블에 컬럼으로 **존재조차 불가능**하다.
      const columns = await executor.all<{ name: string }>(
        "pragma table_info(managed_share_receipt)",
      );
      expect(columns.map((column) => column.name).sort()).toEqual([
        "created_at",
        "expires_at",
        "fingerprint",
        "slug",
      ]);

      const pending = await prepareManagedShare(store, fingerprint);
      expect(pending.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{21}[AQgw]$/u);
      expect(pending.revokeToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      expect(await getManagedShare(store, fingerprint)).toBeNull(); // pending 은 미완성

      // 영수증 행에 raw capability 가 없다(값 대조).
      expect(
        await executor.get("select * from managed_share_receipt where fingerprint = ?", [
          fingerprint,
        ]),
      ).toEqual({ fingerprint, slug: null, expires_at: null, created_at: pending.createdAt });

      const active = await completeManagedShare(store, fingerprint, {
        slug: `${"S".repeat(21)}A`,
        revokeToken: pending.revokeToken,
        expiresAt: FUTURE,
      });
      expect(await getManagedShare(store, fingerprint)).toEqual(active);

      const [summary] = await listManagedShares(store);
      expect(summary).toEqual({
        fingerprint,
        slug: active.slug,
        expiresAt: active.expiresAt,
        createdAt: active.createdAt,
        canRevoke: true,
      });
      expect(summary).not.toHaveProperty("idempotencyKey");
      expect(summary).not.toHaveProperty("revokeToken");

      await deleteManagedShare(store, fingerprint);
      expect(await getManagedShare(store, fingerprint)).toBeNull();
      expect(
        await executor.get("select * from managed_share_receipt where fingerprint = ?", [
          fingerprint,
        ]),
      ).toBeNull();
      expect(
        await executor.get("select * from managed_share_secret where fingerprint = ?", [
          fingerprint,
        ]),
      ).toBeNull();
    } finally {
      await closePlanStore(store);
    }
  });

  it("T6: rotate 가 두 토큰을 갈고 만료 영수증은 양쪽 테이블에서 사라진다", async () => {
    const { store, executor } = await openTestStore();
    try {
      const fingerprint = "c".repeat(64);
      const first = await prepareManagedShare(store, fingerprint);
      const rotated = await rotateManagedShare(store, fingerprint);
      expect(rotated.idempotencyKey).not.toBe(first.idempotencyKey);
      expect(rotated.revokeToken).not.toBe(first.revokeToken);

      await completeManagedShare(store, fingerprint, {
        slug: `${"E".repeat(21)}A`,
        revokeToken: rotated.revokeToken,
        expiresAt: PAST, // 만료 → listManagedShares 청소가 양쪽에서 지운다
      });
      expect(await listManagedShares(store)).toEqual([]);
      expect(await getManagedShareReceipt(store, fingerprint)).toBeNull();
      expect(
        await executor.get("select * from managed_share_receipt where fingerprint = ?", [
          fingerprint,
        ]),
      ).toBeNull();
      expect(
        await executor.get("select * from managed_share_secret where fingerprint = ?", [
          fingerprint,
        ]),
      ).toBeNull();
    } finally {
      await closePlanStore(store);
    }
  });

  it("T7: 24h 지난 pending 은 청소된다", async () => {
    const { store, executor } = await openTestStore();
    try {
      const fingerprint = "d".repeat(64);
      await prepareManagedShare(store, fingerprint);
      // createdAt 을 과거로 직접 민다(원본 writeRawStore 등가) → slug 없는 pending 이 stale.
      await executor.run("update managed_share_receipt set created_at = ? where fingerprint = ?", [
        PAST,
        fingerprint,
      ]);
      await executor.run("update managed_share_secret set created_at = ? where fingerprint = ?", [
        PAST,
        fingerprint,
      ]);
      expect(await listManagedShares(store)).toEqual([]);
      expect(
        await executor.get("select * from managed_share_receipt where fingerprint = ?", [
          fingerprint,
        ]),
      ).toBeNull();
      expect(
        await executor.get("select * from managed_share_secret where fingerprint = ?", [
          fingerprint,
        ]),
      ).toBeNull();
    } finally {
      await closePlanStore(store);
    }
  });

  it("살아있는 쌍이면 prepare 가 재사용한다", async () => {
    const { store } = await openTestStore();
    try {
      const fingerprint = "a".repeat(64);
      const first = await prepareManagedShare(store, fingerprint);
      const again = await prepareManagedShare(store, fingerprint);
      expect(again).toEqual(first); // 같은 토큰 재사용
    } finally {
      await closePlanStore(store);
    }
  });

  it("영수증만 있고 철회 키(secret)가 없으면 한국어로 거절한다", async () => {
    const { store, executor } = await openTestStore();
    try {
      const fingerprint = "b".repeat(64);
      // 완성 영수증만 직접 심는다(secret 유실 시나리오).
      await executor.run(
        "insert into managed_share_receipt (fingerprint, slug, expires_at, created_at) values (?, ?, ?, ?)",
        [fingerprint, `${"S".repeat(21)}A`, FUTURE, FIXED_NOW_ISO],
      );
      await expect(prepareManagedShare(store, fingerprint)).rejects.toThrow("철회 키");
    } finally {
      await closePlanStore(store);
    }
  });
});

/**
 * 고아 secret(영수증 없는 secret) 정리 2경로. **FK 를 걸지 않은 결정(0001_initial.ts:61-64)의
 * tripwire** — 아래 두 INSERT 는 부모 없는 자식이라, 누군가 managed_share_secret 에 FK CASCADE 를
 * 넣는 순간 **INSERT 단계에서** 실패한다. 그러면 결정이 조용히 통과하지 못하고 여기서 잡힌다(§2.6).
 */
describe("고아 secret 정리 (FK 없음 tripwire)", () => {
  const insertOrphanSecret = (
    executor: Awaited<ReturnType<typeof openTestStore>>["executor"],
    fingerprint: string,
  ) =>
    executor.run(
      "insert into managed_share_secret (fingerprint, idempotency_key, revoke_token, created_at) values (?, ?, ?, ?)",
      [fingerprint, "k", "r", FIXED_NOW_ISO],
    );

  it("경로 ①: listManagedShares 청소가 영수증 없는 secret 을 지운다", async () => {
    const { store, executor } = await openTestStore();
    try {
      const fingerprint = "e".repeat(64);
      await insertOrphanSecret(executor, fingerprint);
      await listManagedShares(store);
      expect(
        await executor.get("select * from managed_share_secret where fingerprint = ?", [
          fingerprint,
        ]),
      ).toBeNull();
    } finally {
      await closePlanStore(store);
    }
  });

  it("경로 ②: getManagedShare 가 영수증 없는 secret 을 지운다", async () => {
    const { store, executor } = await openTestStore();
    try {
      const fingerprint = "f".repeat(64);
      await insertOrphanSecret(executor, fingerprint);
      expect(await getManagedShare(store, fingerprint)).toBeNull();
      expect(
        await executor.get("select * from managed_share_secret where fingerprint = ?", [
          fingerprint,
        ]),
      ).toBeNull();
    } finally {
      await closePlanStore(store);
    }
  });
});
