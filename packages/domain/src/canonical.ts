import type {
  CalculationResult,
  Plan,
  SharedCalculation,
  SharedSnapshot,
  TicketSnapshot,
} from "./models";
import type { DomainPorts, RandomBytes, Sha256Digest } from "./ports";
import { calculatePlan } from "./calculation";
import { base64Url, utf8ByteLength, utf8Encode } from "./bytes";
import {
  DOMAIN_LIMITS,
  DomainValidationError,
  assertValidPlan,
  parseSharedSnapshot,
} from "./validation";

/** 128비트 엔트로피 16바이트를 base64url 22자로. 엔트로피 생성은 하지 않는다(순수). */
export function encodeArtworkSeed(random: Uint8Array): string {
  if (random.byteLength !== 16)
    throw new DomainValidationError("INVALID_RANDOM_SEED", "seed must be 128-bit");
  return base64Url(random);
}

/** 포트에서 엔트로피를 받아 시드를 만든다. crypto 전역 대신 주입된 RandomBytes 를 쓴다. */
export function generateArtworkSeed(randomBytes: RandomBytes): string {
  return encodeArtworkSeed(randomBytes(16));
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

// digest 는 낱개 능력으로 받는다(DomainPorts 통째가 아니라). canonical.test.ts:159 가
// 이미 맨 digest 함수를 넘겨 무수정으로 살고, 서버 라우트도 webSha256 하나만 있으면 된다.
export async function fingerprintSharedSnapshot(input: unknown, digest: Sha256Digest) {
  const bytes = utf8Encode(serializeSharedSnapshot(input));
  const hash = await digest(bytes);
  if (hash.byteLength !== 32)
    throw new DomainValidationError("INVALID_DIGEST", "SHA-256 must return 32 bytes");
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// 집합 진입점은 DomainPorts 를 통째로 받는다 — randomBytes·digest·now 를 한 번에.
// new Date(ports.now()).toISOString(): toISOString 출력은 ECMA-262 고정이라 locale·tz·ICU
// 무관하고, now 만 주입하면 테스트가 createdAt 을 결정적으로 고정할 수 있다(테스트 2곳이
// 이미 이 값을 우회 중이었다 — spec §1 표).
export async function createTicketSnapshot(
  plan: Plan,
  ports: DomainPorts,
): Promise<TicketSnapshot> {
  assertValidPlan(plan, true);
  const calculation = calculatePlan(plan.items.length, plan.pricing!, plan.people!);
  const artworkSeed = generateArtworkSeed(ports.randomBytes);
  const payload = buildSharedSnapshot(plan, calculation, artworkSeed);
  const canonicalPayload = serializeSharedSnapshot(payload);
  return {
    planId: plan.id,
    revision: plan.revision,
    payload,
    canonicalPayload,
    artworkSeed,
    fingerprint: await fingerprintSharedSnapshot(payload, ports.digest),
    issueMotionClaimedAt: null,
    createdAt: new Date(ports.now()).toISOString(),
  };
}
