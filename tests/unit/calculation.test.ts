import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  calculatePlan,
  calculateSongCost,
  calculateTimeCost,
  estimateDuration,
  maxAffordablePrefix,
  roundDurationOutward,
} from "@/domain/calculation";

describe("fallback-v1 duration", () => {
  it("keeps raw integer seconds separate from outward display rounding", () => {
    expect(estimateDuration(0)).toEqual({
      modelVersion: "fallback-v1",
      lowSec: 0,
      midpointSec: 0,
      highSec: 0,
      coverageBps: 0,
    });
    const duration = estimateDuration(3);
    expect(duration).toMatchObject({ lowSec: 525, midpointSec: 680, highSec: 835, coverageBps: 0 });
    expect(roundDurationOutward(duration)).toEqual({ lowMinutes: 5, highMinutes: 15 });
  });

  it("is monotonic for every supported prefix", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99 }), (count) => {
        const current = estimateDuration(count);
        const next = estimateDuration(count + 1);
        expect(next.lowSec).toBeGreaterThanOrEqual(current.lowSec);
        expect(next.midpointSec).toBeGreaterThanOrEqual(current.midpointSec);
        expect(next.highSec).toBeGreaterThanOrEqual(current.highSec);
      }),
    );
  });
});

describe("pricing", () => {
  it("enumerates bundles and never assumes an average unit price", () => {
    expect(calculateSongCost(4, { kind: "song", singlePriceWon: 1_000 })).toBe(4_000);
    expect(
      calculateSongCost(4, {
        kind: "song",
        singlePriceWon: 1_000,
        bundle: { songs: 3, priceWon: 1_800 },
      }),
    ).toBe(2_800);
    expect(
      calculateSongCost(5, {
        kind: "song",
        singlePriceWon: 1_000,
        bundle: { songs: 3, priceWon: 1_200 },
      }),
    ).toBe(2_400);
    expect(
      calculateSongCost(2, {
        kind: "song",
        singlePriceWon: 500,
        bundle: { songs: 3, priceWon: 2_000 },
      }),
    ).toBe(1_000);
  });

  it("uses raw seconds on time-block boundaries", () => {
    const pricing = { kind: "time", blockSeconds: 1_800, blockPriceWon: 10_000 } as const;
    expect(calculateTimeCost(0, pricing)).toBe(0);
    expect(calculateTimeCost(1_800, pricing)).toBe(10_000);
    expect(calculateTimeCost(1_801, pricing)).toBe(20_000);
  });

  it("rounds only the final per-person won value upward", () => {
    const result = calculatePlan(3, { kind: "song", singlePriceWon: 1_000 }, 2);
    expect(result.derived).toEqual({
      totalLowWon: 3_000,
      totalHighWon: 3_000,
      perPersonLowWon: 1_500,
      perPersonHighWon: 1_500,
    });
  });

  it("matches a brute-force bundle oracle", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 20_000 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 100_000 }),
        (count, single, songs, bundlePrice) => {
          const candidates = Array.from({ length: Math.ceil(count / songs) + 1 }, (_, bundles) =>
            Math.min(
              Number.MAX_SAFE_INTEGER,
              bundles * bundlePrice + Math.max(0, count - bundles * songs) * single,
            ),
          );
          expect(
            calculateSongCost(count, {
              kind: "song",
              singlePriceWon: single,
              bundle: { songs, priceWon: bundlePrice },
            }),
          ).toBe(Math.min(...candidates));
        },
      ),
    );
  });
});

describe("reverse budget", () => {
  it("returns the maximum current prefix through the same forward song-cost function", () => {
    const pricing = {
      kind: "song",
      singlePriceWon: 1_000,
      bundle: { songs: 3, priceWon: 2_500 },
    } as const;
    expect(maxAffordablePrefix(10, 4_499, pricing)).toEqual({ kind: "song", maxSongs: 4 });
    expect(maxAffordablePrefix(10, 4_500, pricing)).toEqual({ kind: "song", maxSongs: 5 });
  });

  it("separates guaranteed and possible time prefixes", () => {
    const result = maxAffordablePrefix(10, 10_000, {
      kind: "time",
      blockSeconds: 1_800,
      blockPriceWon: 10_000,
    });
    expect(result.kind).toBe("time");
    if (result.kind === "time") {
      expect(result.guaranteedSongs).toBeLessThanOrEqual(result.possibleSongs);
      expect(result.possibleSongs).toBeLessThanOrEqual(10);
    }
  });
});
