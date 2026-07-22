import { describe, expect, it } from "vitest";
import {
  assertCanonicalPayloadSize,
  buildSharedSnapshot,
  fingerprintSharedSnapshot,
  serializeSharedSnapshot,
} from "@/domain/canonical";
import { calculatePlan } from "@/domain/calculation";
import type { Plan, Track } from "@/domain/models";
import { DOMAIN_LIMITS, DomainValidationError } from "@/domain/validation";

const encoder = new TextEncoder();
const seed = "AAAAAAAAAAAAAAAAAAAAAA";

function planWithText(titleByIndex: readonly string[], artistByIndex: readonly string[]): Plan {
  const items: Track[] = Array.from({ length: 100 }, (_, order) => ({
    id: `track-${order}`,
    source: "manual",
    catalogSongId: null,
    title: titleByIndex[order] ?? "A",
    artist: artistByIndex[order] ?? "",
    karaokeCodes: [
      { vendor: "TJ", code: "999999" },
      { vendor: "KY", code: "999999" },
    ],
    order,
  }));
  return {
    id: "active-plan",
    revision: 9,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    people: 30,
    pricing: {
      kind: "song",
      singlePriceWon: 10_000_000,
      bundle: { songs: 100, priceWon: 10_000_000 },
    },
    items,
  };
}

function snapshotForPlan(plan: Plan) {
  return buildSharedSnapshot(
    plan,
    calculatePlan(plan.items.length, plan.pricing!, plan.people!),
    seed,
  );
}

describe("shared snapshot byte boundaries", () => {
  it("keeps the 100-song, 80-code-point, four-byte Unicode golden vector under 96 KiB", async () => {
    const fourByteText = "😀".repeat(DOMAIN_LIMITS.maxTextCodePoints);
    const payload = snapshotForPlan(
      planWithText(Array(100).fill(fourByteText), Array(100).fill(fourByteText)),
    );
    const canonical = serializeSharedSnapshot(payload);
    const byteLength = encoder.encode(canonical).byteLength;

    expect(payload.items).toHaveLength(100);
    expect(Array.from(payload.items[0]!.title)).toHaveLength(80);
    expect(byteLength).toBe(77_916);
    expect(byteLength).toBeLessThanOrEqual(DOMAIN_LIMITS.maxCanonicalBytes);
    await expect(fingerprintSharedSnapshot(payload)).resolves.toBe(
      "81e8445ee06770c7d0111eaecb71c673f8b80d251ddca7b419b05360629bf6f5",
    );
  });

  it("accepts exactly 96 KiB and rejects the next canonical UTF-8 byte", () => {
    const atLimit = "x".repeat(DOMAIN_LIMITS.maxCanonicalBytes);
    expect(assertCanonicalPayloadSize(atLimit)).toBe(atLimit);

    try {
      assertCanonicalPayloadSize(`${atLimit}x`);
      throw new Error("Expected canonical byte limit rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).code).toBe("CANONICAL_TOO_LARGE");
    }
  });

  it("rejects lone UTF-16 surrogates instead of serializing replacement escapes", () => {
    const plan = planWithText(["A\ud800"], [""]);
    expect(() => snapshotForPlan(plan)).toThrowError(DomainValidationError);
  });
});
