import { z } from "zod";
import type { Plan, PricingConfig, SharedSnapshot, Track } from "./models";

export const DOMAIN_LIMITS = {
  maxTracks: 100,
  maxTextCodePoints: 80,
  maxMoneyWon: 10_000_000,
  maxBudgetWon: 100_000_000,
  maxPeople: 30,
  minBlockSeconds: 60,
  maxBlockSeconds: 86_400,
  maxCanonicalBytes: 96 * 1024,
} as const;

const FORBIDDEN_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const UNPAIRED_SURROGATE = /[\uD800-\uDFFF]/u;
const ASCII_DIGITS = /^[0-9]{1,6}$/u;
// Canonical unpadded base64url for exactly 16 bytes: the final 4 padding bits are zero.
const ARTWORK_SEED = /^[A-Za-z0-9_-]{21}[AQgw]$/u;

export class DomainValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainValidationError";
  }
}

export function unicodeCodePointLength(value: string) {
  return Array.from(value).length;
}

export function normalizeTrackText(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function assertValidTrackText(value: string, field: "title" | "artist") {
  if (typeof value !== "string" || FORBIDDEN_TEXT.test(value) || UNPAIRED_SURROGATE.test(value)) {
    throw new DomainValidationError("INVALID_TEXT", `${field} contains forbidden characters`);
  }
  if (normalizeTrackText(value) !== value) {
    throw new DomainValidationError("NON_CANONICAL_TEXT", `${field} must be NFC and single-line`);
  }
  const length = unicodeCodePointLength(value);
  const minimum = field === "title" ? 1 : 0;
  if (length < minimum || length > DOMAIN_LIMITS.maxTextCodePoints) {
    throw new DomainValidationError("TEXT_LENGTH", `${field} has an invalid length`);
  }
}

export function assertValidKaraokeCode(value: string) {
  if (!ASCII_DIGITS.test(value)) {
    throw new DomainValidationError(
      "INVALID_KARAOKE_CODE",
      "karaoke code must be 1..6 ASCII digits",
    );
  }
}

function assertSafeInteger(value: number, min: number, max: number, code: string) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new DomainValidationError(code, `${code} is outside its integer range`);
  }
}

export function assertValidPeople(people: number) {
  assertSafeInteger(people, 1, DOMAIN_LIMITS.maxPeople, "INVALID_PEOPLE");
}

export function assertValidPricingConfig(pricing: PricingConfig) {
  if (pricing.kind === "song") {
    assertSafeInteger(pricing.singlePriceWon, 1, DOMAIN_LIMITS.maxMoneyWon, "INVALID_SINGLE_PRICE");
    if (pricing.bundle) {
      assertSafeInteger(pricing.bundle.songs, 1, DOMAIN_LIMITS.maxTracks, "INVALID_BUNDLE_SONGS");
      assertSafeInteger(
        pricing.bundle.priceWon,
        1,
        DOMAIN_LIMITS.maxMoneyWon,
        "INVALID_BUNDLE_PRICE",
      );
    }
    return;
  }
  if (pricing.kind !== "time") {
    throw new DomainValidationError("INVALID_PRICING_KIND", "pricing kind is unsupported");
  }
  assertSafeInteger(
    pricing.blockSeconds,
    DOMAIN_LIMITS.minBlockSeconds,
    DOMAIN_LIMITS.maxBlockSeconds,
    "INVALID_BLOCK_SECONDS",
  );
  assertSafeInteger(pricing.blockPriceWon, 1, DOMAIN_LIMITS.maxMoneyWon, "INVALID_BLOCK_PRICE");
}

export function assertValidTrack(track: Track) {
  if (!track.id || typeof track.id !== "string") {
    throw new DomainValidationError("INVALID_TRACK_ID", "local track id is required");
  }
  if (track.source !== "catalog" && track.source !== "manual") {
    throw new DomainValidationError("INVALID_TRACK_SOURCE", "track source is unsupported");
  }
  assertValidTrackText(track.title, "title");
  assertValidTrackText(track.artist, "artist");
  assertSafeInteger(track.order, 0, DOMAIN_LIMITS.maxTracks - 1, "INVALID_TRACK_ORDER");
  const vendors = new Set<string>();
  for (const code of track.karaokeCodes) {
    if (code.vendor !== "TJ" && code.vendor !== "KY") {
      throw new DomainValidationError("INVALID_VENDOR", "karaoke vendor is unsupported");
    }
    assertValidKaraokeCode(code.code);
    if (vendors.has(code.vendor)) {
      throw new DomainValidationError("DUPLICATE_VENDOR", "one code per vendor is allowed");
    }
    vendors.add(code.vendor);
  }
}

export function assertValidTracks(items: readonly Track[], allowEmpty = true) {
  if (
    !Array.isArray(items) ||
    items.length > DOMAIN_LIMITS.maxTracks ||
    (!allowEmpty && items.length === 0)
  ) {
    throw new DomainValidationError(
      "INVALID_TRACK_COUNT",
      "track count must be within the plan limit",
    );
  }
  const ids = new Set<string>();
  items.forEach((item, index) => {
    assertValidTrack(item);
    if (item.order !== index)
      throw new DomainValidationError("NON_CONTIGUOUS_ORDER", "track order must be contiguous");
    if (ids.has(item.id))
      throw new DomainValidationError("DUPLICATE_TRACK_ID", "track ids must be unique");
    ids.add(item.id);
  });
}

export function assertValidPlan(plan: Plan, ticketReady = false) {
  assertValidTracks(plan.items, !ticketReady);
  assertSafeInteger(plan.revision, 0, Number.MAX_SAFE_INTEGER, "INVALID_REVISION");
  if (ticketReady && (plan.people === null || plan.pricing === null)) {
    throw new DomainValidationError(
      "PLAN_NOT_READY",
      "people and pricing are required to issue a ticket",
    );
  }
  if (plan.people !== null) assertValidPeople(plan.people);
  if (plan.pricing !== null) assertValidPricingConfig(plan.pricing);
}

export function isCanonicalArtworkSeed(value: string) {
  return ARTWORK_SEED.test(value);
}

const safeInteger = z.number().int().safe();
const karaokeCodeSchema = z
  .object({ vendor: z.enum(["TJ", "KY"]), code: z.string().regex(ASCII_DIGITS) })
  .strict();
const sharedTrackSchema = z
  .object({
    source: z.enum(["catalog", "manual"]),
    title: z.string(),
    artist: z.string(),
    karaokeCodes: z.array(karaokeCodeSchema).max(2),
    order: safeInteger.min(0).max(99),
  })
  .strict();
const songPricingSchema = z
  .object({
    kind: z.literal("song"),
    singlePriceWon: safeInteger.min(1).max(DOMAIN_LIMITS.maxMoneyWon),
    bundle: z
      .object({
        songs: safeInteger.min(1).max(DOMAIN_LIMITS.maxTracks),
        priceWon: safeInteger.min(1).max(DOMAIN_LIMITS.maxMoneyWon),
      })
      .strict()
      .optional(),
  })
  .strict();
const timePricingSchema = z
  .object({
    kind: z.literal("time"),
    blockSeconds: safeInteger.min(DOMAIN_LIMITS.minBlockSeconds).max(DOMAIN_LIMITS.maxBlockSeconds),
    blockPriceWon: safeInteger.min(1).max(DOMAIN_LIMITS.maxMoneyWon),
  })
  .strict();
const durationSchema = z
  .object({
    lowSec: safeInteger.nonnegative(),
    midpointSec: safeInteger.nonnegative(),
    highSec: safeInteger.nonnegative(),
    coverageBps: z.literal(0),
  })
  .strict();
const derivedSchema = z
  .object({
    totalLowWon: safeInteger.nonnegative(),
    totalHighWon: safeInteger.nonnegative(),
    perPersonLowWon: safeInteger.nonnegative(),
    perPersonHighWon: safeInteger.nonnegative(),
  })
  .strict();

export const sharedSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    artworkSeed: z.string().regex(ARTWORK_SEED),
    items: z.array(sharedTrackSchema).min(1).max(DOMAIN_LIMITS.maxTracks),
    calculation: z
      .object({
        modelVersion: z.literal("fallback-v1"),
        songCount: safeInteger.min(1).max(DOMAIN_LIMITS.maxTracks),
        duration: durationSchema,
        pricing: z.discriminatedUnion("kind", [songPricingSchema, timePricingSchema]),
        people: safeInteger.min(1).max(DOMAIN_LIMITS.maxPeople),
        derived: derivedSchema,
      })
      .strict(),
  })
  .strict();

export function parseSharedSnapshot(input: unknown): SharedSnapshot {
  const parsed = sharedSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainValidationError("INVALID_SHARED_SCHEMA", "shared snapshot schema is invalid");
  }
  const snapshot = parsed.data as SharedSnapshot;
  snapshot.items.forEach((item, index) => {
    assertValidTrackText(item.title, "title");
    assertValidTrackText(item.artist, "artist");
    if (item.order !== index)
      throw new DomainValidationError("NON_CONTIGUOUS_ORDER", "shared order is invalid");
    const vendors = new Set<string>();
    item.karaokeCodes.forEach((code) => {
      assertValidKaraokeCode(code.code);
      if (vendors.has(code.vendor))
        throw new DomainValidationError("DUPLICATE_VENDOR", "duplicate vendor code");
      vendors.add(code.vendor);
    });
  });
  assertValidPricingConfig(snapshot.calculation.pricing);
  assertValidPeople(snapshot.calculation.people);
  return snapshot;
}
