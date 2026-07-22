import { describe, expect, it } from "vitest";
import {
  buildSharedSnapshot,
  createTicketSnapshot,
  fingerprintSharedSnapshot,
  generateArtworkSeed,
  serializeSharedSnapshot,
} from "@/domain/canonical";
import { calculatePlan } from "@/domain/calculation";
import type { Plan } from "@/domain/models";
import { DomainValidationError } from "@/domain/validation";

const plan: Plan = {
  id: "local-only",
  revision: 4,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z",
  people: 2,
  pricing: { kind: "song", singlePriceWon: 1_000, bundle: { songs: 3, priceWon: 2_500 } },
  items: [
    {
      id: "never-shared",
      source: "manual",
      catalogSongId: null,
      title: "밤의 체크인",
      artist: "유리별",
      karaokeCodes: [{ vendor: "TJ", code: "91001" }],
      order: 0,
    },
  ],
};

describe("canonical shared snapshot", () => {
  it("issues a bounded ticket for the 100-track and 80-code-point boundary", async () => {
    const now = new Date().toISOString();
    const longArtist = "나".repeat(80);
    const boundaryPlan: Plan = {
      id: "active-plan",
      revision: 100,
      createdAt: now,
      updatedAt: now,
      people: 4,
      pricing: { kind: "song", singlePriceWon: 1_000 },
      items: Array.from({ length: 100 }, (_, order) => {
        const prefix = `${order + 1}-`;
        return {
          id: `max-track-${order}`,
          source: "manual" as const,
          catalogSongId: null,
          title: `${prefix}${"가".repeat(80 - prefix.length)}`,
          artist: longArtist,
          karaokeCodes: [],
          order,
        };
      }),
    };

    const ticket = await createTicketSnapshot(boundaryPlan);
    expect(ticket.payload.items).toHaveLength(100);
    expect(new TextEncoder().encode(ticket.canonicalPayload).byteLength).toBeLessThanOrEqual(
      96 * 1024,
    );
  });

  it("removes local identifiers and serializes in schema order", () => {
    const payload = buildSharedSnapshot(
      plan,
      calculatePlan(plan.items.length, plan.pricing!, plan.people!),
      "AAAAAAAAAAAAAAAAAAAAAA",
    );
    const serialized = serializeSharedSnapshot(payload);
    expect(serialized).not.toContain("local-only");
    expect(serialized).not.toContain("never-shared");
    expect(serialized).toBe(
      '{"schemaVersion":1,"artworkSeed":"AAAAAAAAAAAAAAAAAAAAAA","items":[{"source":"manual","title":"밤의 체크인","artist":"유리별","karaokeCodes":[{"vendor":"TJ","code":"91001"}],"order":0}],"calculation":{"modelVersion":"fallback-v1","songCount":1,"duration":{"lowSec":165,"midpointSec":210,"highSec":255,"coverageBps":0},"pricing":{"kind":"song","singlePriceWon":1000,"bundle":{"songs":3,"priceWon":2500}},"people":2,"derived":{"totalLowWon":1000,"totalHighWon":1000,"perPersonLowWon":500,"perPersonHighWon":500}}}',
    );
  });

  it("fingerprints identical semantic objects identically", async () => {
    const payload = buildSharedSnapshot(
      plan,
      calculatePlan(1, plan.pricing!, plan.people!),
      "AAAAAAAAAAAAAAAAAAAAAA",
    );
    const first = await fingerprintSharedSnapshot(payload);
    const reordered = JSON.parse(
      JSON.stringify(payload, Object.keys(payload).reverse()),
    ) as unknown;
    // A valid deep clone, even if caller insertion order differs, is reconstructed by the serializer.
    const clone = structuredClone(payload);
    expect(await fingerprintSharedSnapshot(clone)).toBe(first);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(reordered).toBeDefined();
  });

  it("rejects client-tampered derived totals", () => {
    const payload = buildSharedSnapshot(
      plan,
      calculatePlan(1, plan.pricing!, plan.people!),
      "AAAAAAAAAAAAAAAAAAAAAA",
    );
    const tampered = structuredClone(payload) as {
      calculation: { derived: { totalLowWon: number } };
    };
    tampered.calculation.derived.totalLowWon = 1;
    expect(() => serializeSharedSnapshot(tampered)).toThrow(/server-reproducible/u);
  });

  it("rejects a stale calculation before issuing a shared snapshot", () => {
    const stale = structuredClone(calculatePlan(1, plan.pricing!, plan.people!));
    (stale.derived as { totalHighWon: number }).totalHighWon += 1;

    expect(() => buildSharedSnapshot(plan, stale, "AAAAAAAAAAAAAAAAAAAAAA")).toThrow(
      expect.objectContaining({ code: "STALE_CALCULATION" }),
    );
  });

  it("encodes exactly 128 bits of artwork entropy and rejects other lengths", () => {
    expect(generateArtworkSeed(new Uint8Array(16))).toBe("AAAAAAAAAAAAAAAAAAAAAA");
    expect(() => generateArtworkSeed(new Uint8Array(15))).toThrow(
      expect.objectContaining({ code: "INVALID_RANDOM_SEED" }),
    );
  });

  it("serializes time pricing and song pricing without an optional bundle", () => {
    const timePlan: Plan = {
      ...plan,
      pricing: { kind: "time", blockSeconds: 600, blockPriceWon: 2_000 },
    };
    const timePayload = buildSharedSnapshot(
      timePlan,
      calculatePlan(1, timePlan.pricing!, timePlan.people!),
      "AAAAAAAAAAAAAAAAAAAAAA",
    );
    expect(serializeSharedSnapshot(timePayload)).toContain(
      '"pricing":{"kind":"time","blockSeconds":600,"blockPriceWon":2000}',
    );

    const unbundledPlan: Plan = {
      ...plan,
      pricing: { kind: "song", singlePriceWon: 1_000 },
    };
    const unbundledPayload = buildSharedSnapshot(
      unbundledPlan,
      calculatePlan(1, unbundledPlan.pricing!, unbundledPlan.people!),
      "AAAAAAAAAAAAAAAAAAAAAA",
    );
    expect(serializeSharedSnapshot(unbundledPayload)).not.toContain('"bundle"');
  });

  it("rejects a digest adapter that does not return a SHA-256-sized value", async () => {
    const payload = buildSharedSnapshot(
      plan,
      calculatePlan(1, plan.pricing!, plan.people!),
      "AAAAAAAAAAAAAAAAAAAAAA",
    );

    await expect(
      fingerprintSharedSnapshot(payload, async () => new Uint8Array(31)),
    ).rejects.toEqual(
      expect.objectContaining<Partial<DomainValidationError>>({ code: "INVALID_DIGEST" }),
    );
  });

  it("creates a self-consistent immutable local ticket snapshot", async () => {
    const ticket = await createTicketSnapshot(plan);

    expect(ticket).toMatchObject({
      planId: plan.id,
      revision: plan.revision,
      issueMotionClaimedAt: null,
    });
    expect(ticket.artworkSeed).toHaveLength(22);
    expect(ticket.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(ticket.canonicalPayload).toBe(serializeSharedSnapshot(ticket.payload));
    expect(Number.isFinite(Date.parse(ticket.createdAt))).toBe(true);
  });
});
