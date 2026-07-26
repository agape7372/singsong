import type {
  CalculationResult,
  DurationEstimate,
  PerPersonRange,
  PricingConfig,
  ReverseBudgetResult,
} from "./models";
import {
  DOMAIN_LIMITS,
  DomainValidationError,
  assertValidPeople,
  assertValidPricingConfig,
} from "./validation";

function assertCount(songCount: number) {
  if (!Number.isSafeInteger(songCount) || songCount < 0 || songCount > DOMAIN_LIMITS.maxTracks) {
    throw new DomainValidationError(
      "INVALID_SONG_COUNT",
      "song count must be a safe integer from 0 to 100",
    );
  }
}

function assertSafeResult(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError(
      "CALCULATION_OVERFLOW",
      "calculation did not produce a safe integer",
    );
  }
  return value;
}

export function estimateDuration(songCount: number): DurationEstimate {
  assertCount(songCount);
  const gaps = Math.max(0, songCount - 1);
  return {
    modelVersion: "fallback-v1",
    lowSec: assertSafeResult(songCount * 165 + gaps * 15),
    midpointSec: assertSafeResult(songCount * 210 + gaps * 25),
    highSec: assertSafeResult(songCount * 255 + gaps * 35),
    coverageBps: 0,
  };
}

export function roundDurationOutward(duration: Pick<DurationEstimate, "lowSec" | "highSec">) {
  if (duration.lowSec === 0 && duration.highSec === 0) return { lowMinutes: 0, highMinutes: 0 };
  return {
    lowMinutes: Math.floor(duration.lowSec / 300) * 5,
    highMinutes: Math.ceil(duration.highSec / 300) * 5,
  };
}

export function calculateSongCost(
  songCount: number,
  pricing: Extract<PricingConfig, { kind: "song" }>,
) {
  assertCount(songCount);
  assertValidPricingConfig(pricing);
  if (songCount === 0) return 0;
  if (!pricing.bundle) return assertSafeResult(songCount * pricing.singlePriceWon);
  const maximumBundles = Math.ceil(songCount / pricing.bundle.songs);
  let cheapest = Number.MAX_SAFE_INTEGER;
  for (let bundles = 0; bundles <= maximumBundles; bundles += 1) {
    const remaining = Math.max(0, songCount - bundles * pricing.bundle.songs);
    const candidate = bundles * pricing.bundle.priceWon + remaining * pricing.singlePriceWon;
    cheapest = Math.min(cheapest, assertSafeResult(candidate));
  }
  return cheapest;
}

export function calculateTimeCost(
  seconds: number,
  pricing: Extract<PricingConfig, { kind: "time" }>,
) {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new DomainValidationError(
      "INVALID_SECONDS",
      "seconds must be a non-negative safe integer",
    );
  }
  assertValidPricingConfig(pricing);
  return assertSafeResult(Math.ceil(seconds / pricing.blockSeconds) * pricing.blockPriceWon);
}

export function calculateCostRange(songCount: number, pricing: PricingConfig) {
  const duration = estimateDuration(songCount);
  if (pricing.kind === "song") {
    const total = calculateSongCost(songCount, pricing);
    return { lowWon: total, highWon: total };
  }
  return {
    lowWon: calculateTimeCost(duration.lowSec, pricing),
    highWon: calculateTimeCost(duration.highSec, pricing),
  };
}

export function calculatePerPersonRange(
  totals: { lowWon: number; highWon: number },
  people: number,
): PerPersonRange {
  assertValidPeople(people);
  return {
    lowWon: assertSafeResult(Math.ceil(totals.lowWon / people)),
    highWon: assertSafeResult(Math.ceil(totals.highWon / people)),
  };
}

export function calculatePlan(
  songCount: number,
  pricing: PricingConfig,
  people: number,
): CalculationResult {
  assertCount(songCount);
  if (songCount === 0)
    throw new DomainValidationError("EMPTY_TICKET", "at least one song is required");
  assertValidPricingConfig(pricing);
  assertValidPeople(people);
  const duration = estimateDuration(songCount);
  const totals = calculateCostRange(songCount, pricing);
  const perPerson = calculatePerPersonRange(totals, people);
  return {
    songCount,
    duration,
    displayDuration: roundDurationOutward(duration),
    pricing,
    people,
    derived: {
      totalLowWon: totals.lowWon,
      totalHighWon: totals.highWon,
      perPersonLowWon: perPerson.lowWon,
      perPersonHighWon: perPerson.highWon,
    },
  };
}

export function maxAffordablePrefix(
  cap: number,
  budgetWon: number,
  pricing: PricingConfig,
): ReverseBudgetResult {
  assertCount(cap);
  if (!Number.isSafeInteger(budgetWon) || budgetWon < 0 || budgetWon > DOMAIN_LIMITS.maxBudgetWon) {
    throw new DomainValidationError("INVALID_BUDGET", "budget must be a safe integer within range");
  }
  assertValidPricingConfig(pricing);
  if (pricing.kind === "song") {
    let maxSongs = 0;
    for (let count = 1; count <= cap; count += 1) {
      if (calculateSongCost(count, pricing) <= budgetWon) maxSongs = count;
    }
    return { kind: "song", maxSongs };
  }

  const blocks = Math.floor(budgetWon / pricing.blockPriceWon);
  const availableSec = blocks * pricing.blockSeconds;
  let guaranteedSongs = 0;
  let possibleSongs = 0;
  for (let count = 1; count <= cap; count += 1) {
    const duration = estimateDuration(count);
    if (duration.highSec <= availableSec) guaranteedSongs = count;
    if (duration.lowSec <= availableSec) possibleSongs = count;
  }
  return { kind: "time", guaranteedSongs, possibleSongs };
}
