export type TrackSource = "catalog" | "manual";

export type KaraokeVendor = "TJ" | "KY";

export interface KaraokeCode {
  readonly vendor: KaraokeVendor;
  readonly code: string;
}

/**
 * A track in the one active local plan. Local identifiers are deliberately not
 * part of a shared snapshot.
 */
export interface Track {
  readonly id: string;
  readonly source: TrackSource;
  readonly catalogSongId: string | null;
  readonly title: string;
  readonly artist: string;
  readonly karaokeCodes: readonly KaraokeCode[];
  readonly order: number;
}

export type NonEmptyTracks = readonly [Track, ...Track[]];

export interface SongBundle {
  readonly songs: number;
  readonly priceWon: number;
}

export interface SongPricingConfig {
  readonly kind: "song";
  readonly singlePriceWon: number;
  readonly bundle?: SongBundle;
}

export interface TimePricingConfig {
  readonly kind: "time";
  readonly blockSeconds: number;
  readonly blockPriceWon: number;
}

export type PricingConfig = SongPricingConfig | TimePricingConfig;

/**
 * P0 stores exactly one active plan. An empty plan and null first-use settings
 * are valid editing states; ticket/share creation requires 1..100 tracks and
 * non-null validated settings.
 */
export interface Plan {
  readonly id: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items: readonly Track[];
  readonly people: number | null;
  readonly pricing: PricingConfig | null;
}

export interface DurationRange {
  readonly lowSec: number;
  readonly midpointSec: number;
  readonly highSec: number;
  readonly coverageBps: 0;
}

export interface DurationEstimate extends DurationRange {
  readonly modelVersion: "fallback-v1";
}

export interface DisplayDurationRange {
  readonly lowMinutes: number;
  readonly highMinutes: number;
}

export interface MoneyRange {
  readonly lowWon: number;
  readonly highWon: number;
}

export interface PerPersonRange {
  readonly lowWon: number;
  readonly highWon: number;
}

export interface CalculationDerived {
  readonly totalLowWon: number;
  readonly totalHighWon: number;
  readonly perPersonLowWon: number;
  readonly perPersonHighWon: number;
}

export interface CalculationResult {
  readonly songCount: number;
  readonly duration: DurationEstimate;
  readonly displayDuration: DisplayDurationRange;
  readonly pricing: PricingConfig;
  readonly people: number;
  readonly derived: CalculationDerived;
}

export interface SharedTrack {
  readonly source: TrackSource;
  readonly title: string;
  readonly artist: string;
  readonly karaokeCodes: readonly KaraokeCode[];
  readonly order: number;
}

export interface SharedCalculation {
  readonly modelVersion: "fallback-v1";
  readonly songCount: number;
  readonly duration: DurationRange;
  readonly pricing: PricingConfig;
  readonly people: number;
  readonly derived: CalculationDerived;
}

/** Immutable, public-capability payload. It contains no plan/device/user IDs. */
export interface SharedSnapshot {
  readonly schemaVersion: 1;
  readonly artworkSeed: string;
  readonly items: readonly SharedTrack[];
  readonly calculation: SharedCalculation;
}

/** Local frozen ticket record, unique by planId + revision. */
export interface TicketSnapshot {
  readonly planId: string;
  readonly revision: number;
  readonly payload: SharedSnapshot;
  readonly canonicalPayload: string;
  readonly artworkSeed: string;
  readonly fingerprint: string;
  readonly issueMotionClaimedAt: string | null;
  readonly createdAt: string;
}

export type ReverseBudgetResult =
  | {
      readonly kind: "song";
      readonly maxSongs: number;
    }
  | {
      readonly kind: "time";
      readonly guaranteedSongs: number;
      readonly possibleSongs: number;
    };

/** A runtime-neutral SHA-256 adapter. Implementations must return 32 bytes. */
export type Sha256Digest = (bytes: Uint8Array) => Promise<Uint8Array>;
