import { createHash } from "node:crypto";
import { z } from "zod";

export const DOMAIN_LIMITS = {
  maxTracks: 100,
  maxTextCodePoints: 80,
  maxMoneyWon: 10_000_000,
  maxPeople: 30,
  minBlockSeconds: 60,
  maxBlockSeconds: 86_400,
  maxCanonicalBytes: 96 * 1024,
} as const;

const forbiddenText = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const unpairedSurrogate = /[\uD800-\uDFFF]/u;
const asciiDigits = /^[0-9]{1,6}$/u;
const canonicalCapability = /^[A-Za-z0-9_-]{21}[AQgw]$/u;

export const SHARE_SLUG_PATTERN = canonicalCapability;
export const IDEMPOTENCY_KEY_PATTERN = canonicalCapability;
export const REVOKE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export type KaraokeCode = { vendor: "TJ" | "KY"; code: string };
export type SharedTrack = {
  source: "catalog" | "manual";
  title: string;
  artist: string;
  karaokeCodes: KaraokeCode[];
  order: number;
};

export type SongPricing = {
  kind: "song";
  singlePriceWon: number;
  bundle?: { songs: number; priceWon: number } | undefined;
};

export type TimePricing = {
  kind: "time";
  blockSeconds: number;
  blockPriceWon: number;
};

export type Pricing = SongPricing | TimePricing;

export type SharedSnapshot = {
  schemaVersion: 1;
  artworkSeed: string;
  items: SharedTrack[];
  calculation: {
    modelVersion: "fallback-v1";
    songCount: number;
    duration: {
      lowSec: number;
      midpointSec: number;
      highSec: number;
      coverageBps: 0;
    };
    pricing: Pricing;
    people: number;
    derived: {
      totalLowWon: number;
      totalHighWon: number;
      perPersonLowWon: number;
      perPersonHighWon: number;
    };
  };
};

export class DomainValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainValidationError";
  }
}

const safeInteger = z.number().int().safe();
const karaokeCodeSchema = z
  .object({ vendor: z.enum(["TJ", "KY"]), code: z.string().regex(asciiDigits) })
  .strict();
const sharedTrackSchema = z
  .object({
    source: z.enum(["catalog", "manual"]),
    title: z.string(),
    artist: z.string(),
    karaokeCodes: z.array(karaokeCodeSchema).max(2),
    order: safeInteger.min(0).max(DOMAIN_LIMITS.maxTracks - 1),
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

const sharedSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    artworkSeed: z.string().regex(canonicalCapability),
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

function normalizeTrackText(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function assertTrackText(value: string, field: "title" | "artist") {
  if (forbiddenText.test(value) || unpairedSurrogate.test(value)) {
    throw new DomainValidationError("INVALID_TEXT", `${field} contains forbidden characters`);
  }
  if (normalizeTrackText(value) !== value) {
    throw new DomainValidationError("NON_CANONICAL_TEXT", `${field} must be NFC and single-line`);
  }
  const length = Array.from(value).length;
  if (length < (field === "title" ? 1 : 0) || length > DOMAIN_LIMITS.maxTextCodePoints) {
    throw new DomainValidationError("TEXT_LENGTH", `${field} has an invalid length`);
  }
}

function assertPricing(pricing: Pricing) {
  if (pricing.kind === "song") {
    if (
      !Number.isSafeInteger(pricing.singlePriceWon) ||
      pricing.singlePriceWon < 1 ||
      pricing.singlePriceWon > DOMAIN_LIMITS.maxMoneyWon
    ) {
      throw new DomainValidationError("INVALID_SINGLE_PRICE", "song price is invalid");
    }
    return;
  }
  if (
    !Number.isSafeInteger(pricing.blockSeconds) ||
    pricing.blockSeconds < DOMAIN_LIMITS.minBlockSeconds ||
    pricing.blockSeconds > DOMAIN_LIMITS.maxBlockSeconds ||
    !Number.isSafeInteger(pricing.blockPriceWon) ||
    pricing.blockPriceWon < 1 ||
    pricing.blockPriceWon > DOMAIN_LIMITS.maxMoneyWon
  ) {
    throw new DomainValidationError("INVALID_TIME_PRICE", "time price is invalid");
  }
}

function assertNonNegativeSafe(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError("CALCULATION_OVERFLOW", "calculation result is invalid");
  }
  return value;
}

function estimateDuration(songCount: number) {
  const gaps = Math.max(0, songCount - 1);
  return {
    lowSec: assertNonNegativeSafe(songCount * 165 + gaps * 15),
    midpointSec: assertNonNegativeSafe(songCount * 210 + gaps * 25),
    highSec: assertNonNegativeSafe(songCount * 255 + gaps * 35),
    coverageBps: 0 as const,
  };
}

function songCost(songCount: number, pricing: SongPricing) {
  if (!pricing.bundle) return assertNonNegativeSafe(songCount * pricing.singlePriceWon);
  const maximumBundles = Math.ceil(songCount / pricing.bundle.songs);
  let cheapest = Number.MAX_SAFE_INTEGER;
  for (let bundles = 0; bundles <= maximumBundles; bundles += 1) {
    const remaining = Math.max(0, songCount - bundles * pricing.bundle.songs);
    cheapest = Math.min(
      cheapest,
      assertNonNegativeSafe(bundles * pricing.bundle.priceWon + remaining * pricing.singlePriceWon),
    );
  }
  return cheapest;
}

function calculateExpected(songCount: number, pricing: Pricing, people: number) {
  assertPricing(pricing);
  if (!Number.isSafeInteger(people) || people < 1 || people > DOMAIN_LIMITS.maxPeople) {
    throw new DomainValidationError("INVALID_PEOPLE", "people is invalid");
  }
  const duration = estimateDuration(songCount);
  const totalLowWon =
    pricing.kind === "song"
      ? songCost(songCount, pricing)
      : assertNonNegativeSafe(
          Math.ceil(duration.lowSec / pricing.blockSeconds) * pricing.blockPriceWon,
        );
  const totalHighWon =
    pricing.kind === "song"
      ? totalLowWon
      : assertNonNegativeSafe(
          Math.ceil(duration.highSec / pricing.blockSeconds) * pricing.blockPriceWon,
        );
  return {
    modelVersion: "fallback-v1" as const,
    songCount,
    duration,
    pricing,
    people,
    derived: {
      totalLowWon,
      totalHighWon,
      perPersonLowWon: Math.ceil(totalLowWon / people),
      perPersonHighWon: Math.ceil(totalHighWon / people),
    },
  };
}

export function canonicalizeSharedSnapshot(input: unknown): SharedSnapshot {
  const parsed = sharedSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainValidationError("INVALID_SHARED_SCHEMA", "shared snapshot schema is invalid");
  }
  const snapshot = parsed.data;
  snapshot.items.forEach((item, index) => {
    assertTrackText(item.title, "title");
    assertTrackText(item.artist, "artist");
    if (item.order !== index) {
      throw new DomainValidationError("NON_CONTIGUOUS_ORDER", "shared order is invalid");
    }
    if (new Set(item.karaokeCodes.map((code) => code.vendor)).size !== item.karaokeCodes.length) {
      throw new DomainValidationError("DUPLICATE_VENDOR", "duplicate vendor code");
    }
  });
  const expected = calculateExpected(
    snapshot.items.length,
    snapshot.calculation.pricing,
    snapshot.calculation.people,
  );
  if (JSON.stringify(snapshot.calculation) !== JSON.stringify(expected)) {
    throw new DomainValidationError(
      "CALCULATION_MISMATCH",
      "shared calculation must be server-reproducible",
    );
  }
  return {
    schemaVersion: 1,
    artworkSeed: snapshot.artworkSeed,
    items: snapshot.items.map((item, order) => ({
      source: item.source,
      title: item.title,
      artist: item.artist,
      karaokeCodes: item.karaokeCodes.map((code) => ({ ...code })),
      order,
    })),
    calculation: {
      ...expected,
      pricing:
        expected.pricing.kind === "song"
          ? {
              kind: "song",
              singlePriceWon: expected.pricing.singlePriceWon,
              ...(expected.pricing.bundle ? { bundle: { ...expected.pricing.bundle } } : {}),
            }
          : { ...expected.pricing },
    },
  };
}

export function serializeSharedSnapshot(input: unknown) {
  const serialized = JSON.stringify(canonicalizeSharedSnapshot(input));
  if (Buffer.byteLength(serialized, "utf8") > DOMAIN_LIMITS.maxCanonicalBytes) {
    throw new DomainValidationError("CANONICAL_TOO_LARGE", "canonical payload exceeds 96 KiB");
  }
  return serialized;
}

export function fingerprintSharedSnapshot(input: unknown) {
  return createHash("sha256").update(serializeSharedSnapshot(input), "utf8").digest("hex");
}

export function isValidShareSlug(value: string) {
  return SHARE_SLUG_PATTERN.test(value);
}

export function fixtureSnapshot(title = "밤의 체크인"): SharedSnapshot {
  return canonicalizeSharedSnapshot({
    schemaVersion: 1,
    artworkSeed: "AAAAAAAAAAAAAAAAAAAAAA",
    items: [
      {
        source: "manual",
        title,
        artist: "유리별",
        karaokeCodes: [{ vendor: "TJ", code: "91001" }],
        order: 0,
      },
    ],
    calculation: {
      modelVersion: "fallback-v1",
      songCount: 1,
      duration: { lowSec: 165, midpointSec: 210, highSec: 255, coverageBps: 0 },
      pricing: { kind: "song", singlePriceWon: 1_000 },
      people: 2,
      derived: {
        totalLowWon: 1_000,
        totalHighWon: 1_000,
        perPersonLowWon: 500,
        perPersonHighWon: 500,
      },
    },
  });
}
