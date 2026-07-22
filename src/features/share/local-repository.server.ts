import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { CreateShareInput, CreateShareResult, ShareRecord, ShareRepository } from "./types";

type StoredShare = ShareRecord & {
  revokeTokenHash: string;
  revokedAt: string | null;
  idempotencyKeyHash: string;
};

type LocalShareState = {
  shares: Map<string, StoredShare>;
  idempotency: Map<string, string>;
  secret: Uint8Array;
};

declare global {
  var __singsongLocalShares: LocalShareState | undefined;
}

function state() {
  globalThis.__singsongLocalShares ??= {
    shares: new Map(),
    idempotency: new Map(),
    secret: randomBytes(32),
  };
  return globalThis.__singsongLocalShares;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function derive(
  kind: "slug" | "revoke",
  idempotencyKey: string,
  fingerprint: string,
  bytes: number,
) {
  return createHmac("sha256", state().secret)
    .update(`${kind}\0${idempotencyKey}\0${fingerprint}`)
    .digest()
    .subarray(0, bytes)
    .toString("base64url");
}

function publicRecord(stored: StoredShare): ShareRecord {
  return {
    slug: stored.slug,
    payload: structuredClone(stored.payload),
    fingerprint: stored.fingerprint,
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
  };
}

export class LocalShareRepository implements ShareRepository {
  async create(input: CreateShareInput): Promise<CreateShareResult> {
    const idempotencyHash = hash(input.idempotencyKey);
    const priorSlug = state().idempotency.get(idempotencyHash);
    const revokeToken = input.revokeToken;
    if (priorSlug) {
      const prior = state().shares.get(priorSlug);
      if (prior && prior.fingerprint === input.fingerprint && !prior.revokedAt) {
        return { ...publicRecord(prior), revokeToken, isNew: false };
      }
    }

    const now = new Date();
    const slug = derive("slug", input.idempotencyKey, input.fingerprint, 16);
    const stored: StoredShare = {
      slug,
      payload: structuredClone(input.payload),
      fingerprint: input.fingerprint,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      revokeTokenHash: hash(revokeToken),
      revokedAt: null,
      idempotencyKeyHash: idempotencyHash,
    };
    state().shares.set(slug, stored);
    state().idempotency.set(idempotencyHash, slug);
    return { ...publicRecord(stored), revokeToken, isNew: true };
  }

  async inspect(idempotencyKey: string, fingerprint: string, revokeToken: string) {
    const priorSlug = state().idempotency.get(hash(idempotencyKey));
    if (!priorSlug) return "missing" as const;
    const prior = state().shares.get(priorSlug);
    if (
      prior &&
      prior.fingerprint === fingerprint &&
      prior.revokeTokenHash === hash(revokeToken) &&
      !prior.revokedAt &&
      Date.parse(prior.expiresAt) > Date.now()
    ) {
      return "reusable" as const;
    }
    return "conflict" as const;
  }

  async get(slug: string) {
    const stored = state().shares.get(slug);
    if (!stored || stored.revokedAt || Date.parse(stored.expiresAt) <= Date.now()) return null;
    return publicRecord(stored);
  }

  async revoke(slug: string, token: string) {
    const stored = state().shares.get(slug);
    if (!stored || stored.revokedAt || Date.parse(stored.expiresAt) <= Date.now())
      return "unavailable" as const;
    const expected = Buffer.from(stored.revokeTokenHash, "hex");
    const actual = Buffer.from(hash(token), "hex");
    if (expected.byteLength !== actual.byteLength || !timingSafeEqual(expected, actual)) {
      return "unavailable" as const;
    }
    stored.revokedAt = new Date().toISOString();
    return "revoked" as const;
  }
}
