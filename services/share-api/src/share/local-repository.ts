import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { CreateShareInput, CreateShareResult, ShareRecord, ShareRepository } from "./types.js";

type StoredShare = ShareRecord & {
  revokeTokenHash: string;
  revokedAt: string | null;
  idempotencyKeyHash: string;
};

type LocalRepositoryOptions = {
  secret?: Uint8Array;
  now?: () => number;
};

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeHexEqual(left: string, right: string) {
  const expected = Buffer.from(left, "hex");
  const actual = Buffer.from(right, "hex");
  return expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual);
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

/**
 * Process-local fixture repository.
 *
 * This adapter is deliberately unavailable in production. It exists for local
 * smoke tests and resets whenever the Node process restarts.
 */
export class LocalShareRepository implements ShareRepository {
  readonly #shares = new Map<string, StoredShare>();
  readonly #idempotency = new Map<string, string>();
  readonly #secret: Uint8Array;
  readonly #now: () => number;

  constructor(options: LocalRepositoryOptions = {}) {
    this.#secret = options.secret ? Uint8Array.from(options.secret) : randomBytes(32);
    this.#now = options.now ?? Date.now;
  }

  #derive(idempotencyKey: string, fingerprint: string) {
    return createHmac("sha256", this.#secret)
      .update(`slug\0${idempotencyKey}\0${fingerprint}`)
      .digest()
      .subarray(0, 16)
      .toString("base64url");
  }

  async inspect(idempotencyKey: string, fingerprint: string, revokeToken: string) {
    const priorSlug = this.#idempotency.get(hash(idempotencyKey));
    if (!priorSlug) return "missing" as const;
    const prior = this.#shares.get(priorSlug);
    if (
      prior &&
      prior.fingerprint === fingerprint &&
      safeHexEqual(prior.revokeTokenHash, hash(revokeToken)) &&
      !prior.revokedAt &&
      Date.parse(prior.expiresAt) > this.#now()
    ) {
      return "reusable" as const;
    }
    return "conflict" as const;
  }

  async create(input: CreateShareInput): Promise<CreateShareResult> {
    const idempotencyKeyHash = hash(input.idempotencyKey);
    const priorSlug = this.#idempotency.get(idempotencyKeyHash);
    const prior = priorSlug ? this.#shares.get(priorSlug) : undefined;
    if (
      prior &&
      prior.fingerprint === input.fingerprint &&
      safeHexEqual(prior.revokeTokenHash, hash(input.revokeToken)) &&
      !prior.revokedAt &&
      Date.parse(prior.expiresAt) > this.#now()
    ) {
      return {
        ...publicRecord(prior),
        revokeToken: input.revokeToken,
        isNew: false,
      };
    }

    const now = this.#now();
    const slug = this.#derive(input.idempotencyKey, input.fingerprint);
    const stored: StoredShare = {
      slug,
      payload: structuredClone(input.payload),
      fingerprint: input.fingerprint,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1_000).toISOString(),
      revokeTokenHash: hash(input.revokeToken),
      revokedAt: null,
      idempotencyKeyHash,
    };
    this.#shares.set(slug, stored);
    this.#idempotency.set(idempotencyKeyHash, slug);
    return {
      ...publicRecord(stored),
      revokeToken: input.revokeToken,
      isNew: true,
    };
  }

  async get(slug: string) {
    const stored = this.#shares.get(slug);
    if (!stored || stored.revokedAt || Date.parse(stored.expiresAt) <= this.#now()) return null;
    return publicRecord(stored);
  }

  async revoke(slug: string, token: string) {
    const stored = this.#shares.get(slug);
    if (!stored || stored.revokedAt || Date.parse(stored.expiresAt) <= this.#now()) {
      return "unavailable" as const;
    }
    if (!safeHexEqual(stored.revokeTokenHash, hash(token))) return "unavailable" as const;
    stored.revokedAt = new Date(this.#now()).toISOString();
    return "revoked" as const;
  }
}
