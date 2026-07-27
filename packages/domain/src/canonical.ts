import type {
  CalculationResult,
  Plan,
  SharedCalculation,
  SharedSnapshot,
  TicketSnapshot,
} from "./models";
import type { Sha256Digest } from "./ports";
import { calculatePlan } from "./calculation";
import { base64Url, utf8ByteLength, utf8Encode } from "./bytes";
// ★ C3 임시: digest 기본값을 유지하려고 web-ports 를 문다. C4 가 기본값을 제거하면서
//    이 import 도 사라진다. 그때까지 canonical.ts 는 모듈 그래프에 crypto 를 끌고 온다 —
//    그래서 순수성 가드(C5)는 C4 뒤에 랜딩한다(crit §A-1: 커밋 순서 의존을 코드로 제거).
import { webSha256 } from "./web-ports";
import {
  DOMAIN_LIMITS,
  DomainValidationError,
  assertValidPlan,
  parseSharedSnapshot,
} from "./validation";

export function generateArtworkSeed(random = crypto.getRandomValues(new Uint8Array(16))) {
  if (random.byteLength !== 16)
    throw new DomainValidationError("INVALID_RANDOM_SEED", "seed must be 128-bit");
  return base64Url(random);
}

export function buildSharedSnapshot(
  plan: Plan,
  calculation: CalculationResult,
  artworkSeed: string,
): SharedSnapshot {
  assertValidPlan(plan, true);
  const recomputed = calculatePlan(plan.items.length, calculation.pricing, calculation.people);
  if (JSON.stringify(recomputed) !== JSON.stringify(calculation)) {
    throw new DomainValidationError("STALE_CALCULATION", "calculation does not match the plan");
  }
  return parseSharedSnapshot({
    schemaVersion: 1,
    artworkSeed,
    items: plan.items.map((item, order) => ({
      source: item.source,
      title: item.title,
      artist: item.artist,
      karaokeCodes: item.karaokeCodes.map(({ vendor, code }) => ({ vendor, code })),
      order,
    })),
    calculation: {
      modelVersion: "fallback-v1",
      songCount: calculation.songCount,
      duration: {
        lowSec: calculation.duration.lowSec,
        midpointSec: calculation.duration.midpointSec,
        highSec: calculation.duration.highSec,
        coverageBps: 0,
      },
      pricing:
        calculation.pricing.kind === "song"
          ? {
              kind: "song",
              singlePriceWon: calculation.pricing.singlePriceWon,
              ...(calculation.pricing.bundle
                ? {
                    bundle: {
                      songs: calculation.pricing.bundle.songs,
                      priceWon: calculation.pricing.bundle.priceWon,
                    },
                  }
                : {}),
            }
          : {
              kind: "time",
              blockSeconds: calculation.pricing.blockSeconds,
              blockPriceWon: calculation.pricing.blockPriceWon,
            },
      people: calculation.people,
      derived: { ...calculation.derived },
    },
  });
}

export function canonicalizeSharedSnapshot(input: unknown): SharedSnapshot {
  const snapshot = parseSharedSnapshot(input);
  const recomputed = calculatePlan(
    snapshot.items.length,
    snapshot.calculation.pricing,
    snapshot.calculation.people,
  );
  const expected: SharedCalculation = {
    modelVersion: "fallback-v1",
    songCount: recomputed.songCount,
    duration: {
      lowSec: recomputed.duration.lowSec,
      midpointSec: recomputed.duration.midpointSec,
      highSec: recomputed.duration.highSec,
      coverageBps: 0 as const,
    },
    pricing: recomputed.pricing,
    people: recomputed.people,
    derived: recomputed.derived,
  };
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
      karaokeCodes: item.karaokeCodes.map(({ vendor, code }) => ({ vendor, code })),
      order,
    })),
    calculation: expected,
  };
}

export function assertCanonicalPayloadSize(serialized: string) {
  if (utf8ByteLength(serialized) > DOMAIN_LIMITS.maxCanonicalBytes) {
    throw new DomainValidationError("CANONICAL_TOO_LARGE", "canonical payload exceeds 96 KiB");
  }
  return serialized;
}

export function serializeSharedSnapshot(input: unknown) {
  const canonical = canonicalizeSharedSnapshot(input);
  return assertCanonicalPayloadSize(JSON.stringify(canonical));
}

export async function fingerprintSharedSnapshot(input: unknown, digest: Sha256Digest = webSha256) {
  const bytes = utf8Encode(serializeSharedSnapshot(input));
  const hash = await digest(bytes);
  if (hash.byteLength !== 32)
    throw new DomainValidationError("INVALID_DIGEST", "SHA-256 must return 32 bytes");
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createTicketSnapshot(plan: Plan): Promise<TicketSnapshot> {
  assertValidPlan(plan, true);
  const calculation = calculatePlan(plan.items.length, plan.pricing!, plan.people!);
  const artworkSeed = generateArtworkSeed();
  const payload = buildSharedSnapshot(plan, calculation, artworkSeed);
  const canonicalPayload = serializeSharedSnapshot(payload);
  return {
    planId: plan.id,
    revision: plan.revision,
    payload,
    canonicalPayload,
    artworkSeed,
    fingerprint: await fingerprintSharedSnapshot(payload),
    issueMotionClaimedAt: null,
    createdAt: new Date().toISOString(),
  };
}
