import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSharedSnapshot, fingerprintSharedSnapshot } from "@/domain/canonical";
import { calculatePlan } from "@/domain/calculation";
import type { Plan } from "@/domain/models";
import { LocalShareRepository } from "@/features/share/local-repository.server";
import type { CreateShareInput } from "@/features/share/types";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc }),
}));

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function deriveSlug(idempotencyKey: string, key: Buffer) {
  return createHmac("sha256", key)
    .update(
      Buffer.concat([
        Buffer.from("singsong/share-slug/v1", "utf8"),
        Buffer.from([0]),
        Buffer.from(idempotencyKey, "utf8"),
      ]),
    )
    .digest()
    .subarray(0, 16)
    .toString("base64url");
}

async function createInput(): Promise<CreateShareInput> {
  const plan: Plan = {
    id: "active-plan",
    revision: 3,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    people: 2,
    pricing: { kind: "song", singlePriceWon: 1_000 },
    items: [
      {
        id: "track-1",
        source: "manual",
        catalogSongId: null,
        title: "Retry Song",
        artist: "Singer",
        karaokeCodes: [],
        order: 0,
      },
    ],
  };
  const payload = buildSharedSnapshot(
    plan,
    calculatePlan(plan.items.length, plan.pricing!, plan.people!),
    "EEEEEEEEEEEEEEEEEEEEEA",
  );
  return {
    idempotencyKey: "FFFFFFFFFFFFFFFFFFFFFA",
    revokeToken: "G".repeat(43),
    payload,
    canonicalPayload: JSON.stringify(payload),
    fingerprint: await fingerprintSharedSnapshot(payload),
    rateBucketHashes: { hour: `\\x${"1".repeat(64)}`, day: `\\x${"2".repeat(64)}` },
  };
}

beforeEach(() => {
  rpc.mockReset();
  globalThis.__singsongLocalShares = undefined;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("share retry and slug-key rotation resilience", () => {
  it("recovers the committed snapshot after the first HTTP response is lost", async () => {
    const repository = new LocalShareRepository();
    const input = await createInput();

    const committedBeforeResponseLoss = await repository.create(input);
    expect(committedBeforeResponseLoss.isNew).toBe(true);
    await expect(
      repository.inspect(input.idempotencyKey, input.fingerprint, input.revokeToken),
    ).resolves.toBe("reusable");

    const retry = await repository.create(input);
    expect(retry.isNew).toBe(false);
    expect(retry.slug).toBe(committedBeforeResponseLoss.slug);
    expect(retry.fingerprint).toBe(input.fingerprint);
  });

  it("returns a version-1 slug after rotation to version 2 when the DB reuses the old row", async () => {
    const keyV1 = Buffer.alloc(32, 1);
    const keyV2 = Buffer.alloc(32, 2);
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", `sb_secret_${"x".repeat(32)}`);
    vi.stubEnv("SHARE_SLUG_ACTIVE_KEY_VERSION", "2");
    vi.stubEnv("SHARE_SLUG_HMAC_KEY_V1", keyV1.toString("base64url"));
    vi.stubEnv("SHARE_SLUG_HMAC_KEY_V2", keyV2.toString("base64url"));
    const input = await createInput();
    const oldSlug = deriveSlug(input.idempotencyKey, keyV1);
    const activeSlug = deriveSlug(input.idempotencyKey, keyV2);
    expect(oldSlug).not.toBe(activeSlug);

    rpc.mockImplementation(async (name: string) => {
      if (name === "inspect_share_snapshot_v1") {
        return {
          data: [
            {
              outcome: "reusable",
              slug_key_version: 1,
              stored_slug_hash: `\\x${sha256(oldSlug)}`,
            },
          ],
          error: null,
        };
      }
      if (name === "create_share_snapshot_v1") {
        return {
          data: [
            {
              outcome: "reused",
              slug_key_version: 1,
              stored_slug_hash: `\\x${sha256(oldSlug)}`,
              expires_at: "2026-08-21T00:00:00.000Z",
            },
          ],
          error: null,
        };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });

    const { SupabaseShareRepository } = await import("@/features/share/supabase-repository.server");
    const repository = new SupabaseShareRepository();
    await expect(
      repository.inspect(input.idempotencyKey, input.fingerprint, input.revokeToken),
    ).resolves.toBe("reusable");
    const retried = await repository.create(input);
    expect(retried.slug).toBe(oldSlug);
    expect(retried.slug).not.toBe(activeSlug);
    expect(retried.isNew).toBe(false);

    expect(rpc).toHaveBeenCalledWith(
      "create_share_snapshot_v1",
      expect.objectContaining({
        p_slug_key_version: 2,
        p_slug_hash: `\\x${sha256(activeSlug)}`,
      }),
    );
  });

  it("fails closed if a reused row references a retired key that is unavailable", async () => {
    const keyV1 = Buffer.alloc(32, 1);
    const keyV2 = Buffer.alloc(32, 2);
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", `sb_secret_${"x".repeat(32)}`);
    vi.stubEnv("SHARE_SLUG_ACTIVE_KEY_VERSION", "2");
    vi.stubEnv("SHARE_SLUG_HMAC_KEY_V2", keyV2.toString("base64url"));
    vi.stubEnv("SHARE_SLUG_HMAC_KEY_V1", "");
    const input = await createInput();
    const oldSlug = deriveSlug(input.idempotencyKey, keyV1);
    rpc.mockResolvedValue({
      data: [
        {
          outcome: "reused",
          slug_key_version: 1,
          stored_slug_hash: `\\x${sha256(oldSlug)}`,
          expires_at: "2026-08-21T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const { SupabaseShareRepository } = await import("@/features/share/supabase-repository.server");
    await expect(new SupabaseShareRepository().create(input)).rejects.toThrow(
      "Required share slug key version 1 is unavailable",
    );
  });
});
