import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { canonicalizeSharedSnapshot } from "@/domain/canonical";
import {
  ShareRepositoryError,
  type CreateShareInput,
  type CreateShareResult,
  type ShareRecord,
  type ShareRepository,
} from "./types";

type RpcRow = Record<string, unknown>;

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key?.startsWith("sb_secret_")) {
    throw new Error("A current server-only Supabase secret key is required");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    db: { schema: "app_api" },
    global: { headers: { "X-Client-Info": "singsong-bff/1" } },
  });
}

function row(data: unknown): RpcRow | null {
  const candidate = Array.isArray(data) ? data[0] : data;
  return candidate && typeof candidate === "object" ? (candidate as RpcRow) : null;
}

function hash(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function bytea(hex: string) {
  if (!/^[a-f0-9]{64}$/u.test(hex)) throw new Error("Expected a 32-byte hex digest");
  return `\\x${hex}`;
}

function keyVersion() {
  const version = Number(process.env.SHARE_SLUG_ACTIVE_KEY_VERSION);
  if (!Number.isSafeInteger(version) || version < 1 || version > 32_767) {
    throw new Error("SHARE_SLUG_ACTIVE_KEY_VERSION is invalid");
  }
  return version;
}

function slugKey(version: number) {
  const value = process.env[`SHARE_SLUG_HMAC_KEY_V${version}`];
  if (!value) throw new Error(`Required share slug key version ${version} is unavailable`);
  const key = Buffer.from(value, "base64url");
  if (key.byteLength < 32) throw new Error(`Share slug key version ${version} is too short`);
  return key;
}

function deriveSlug(idempotencyKey: string, version: number) {
  const message = Buffer.concat([
    Buffer.from("singsong/share-slug/v1", "utf8"),
    Buffer.from([0]),
    Buffer.from(idempotencyKey, "utf8"),
  ]);
  return createHmac("sha256", slugKey(version))
    .update(message)
    .digest()
    .subarray(0, 16)
    .toString("base64url");
}

function fingerprintHex(value: string) {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error("Snapshot fingerprint is invalid");
  return value;
}

function databaseHex(value: unknown) {
  if (typeof value !== "string") throw new Error("Database digest is invalid");
  const normalized = value.startsWith("\\x") ? value.slice(2) : value;
  return fingerprintHex(normalized.toLowerCase());
}

function assertStoredSlugHash(idempotencyKey: string, version: number, value: unknown) {
  const derived = Buffer.from(hash(deriveSlug(idempotencyKey, version)), "hex");
  const stored = Buffer.from(databaseHex(value), "hex");
  if (derived.byteLength !== stored.byteLength || !timingSafeEqual(derived, stored)) {
    throw new ShareRepositoryError("KEY_MISMATCH");
  }
}

export class SupabaseShareRepository implements ShareRepository {
  async inspect(idempotencyKey: string, fingerprint: string, revokeToken: string) {
    const { data, error } = await client().rpc("inspect_share_snapshot_v1", {
      p_idempotency_hash: bytea(hash(idempotencyKey)),
      p_snapshot_fingerprint: bytea(fingerprintHex(fingerprint)),
      p_revoke_token_hash: bytea(hash(revokeToken)),
    });
    const result = row(data);
    if (error || !result) throw new Error("Share inspection failed");
    if (result.outcome === "reusable") {
      const version = Number(result.slug_key_version);
      assertStoredSlugHash(idempotencyKey, version, result.stored_slug_hash);
      return "reusable";
    }
    if (result.outcome === "missing" || result.outcome === "conflict") {
      return result.outcome;
    }
    throw new Error("Share inspection returned an invalid outcome");
  }

  async create(input: CreateShareInput): Promise<CreateShareResult> {
    if (!input.rateBucketHashes) throw new Error("Production share rate buckets are required");
    const activeVersion = keyVersion();
    const activeSlug = deriveSlug(input.idempotencyKey, activeVersion);
    const { data, error } = await client().rpc("create_share_snapshot_v1", {
      p_idempotency_hash: bytea(hash(input.idempotencyKey)),
      p_slug_hash: bytea(hash(activeSlug)),
      p_slug_key_version: activeVersion,
      p_snapshot_fingerprint: bytea(fingerprintHex(input.fingerprint)),
      p_payload_canonical: input.canonicalPayload,
      p_revoke_token_hash: bytea(hash(input.revokeToken)),
      p_create_hour_bucket_hash: input.rateBucketHashes.hour,
      p_create_day_bucket_hash: input.rateBucketHashes.day,
    });
    const result = row(data);
    if (error || !result) throw new Error("Share repository rejected create");
    if (result.outcome === "rate_limited") throw new ShareRepositoryError("RATE_LIMITED");
    if (result.outcome === "conflict") throw new ShareRepositoryError("CONFLICT");
    if (result.outcome !== "created" && result.outcome !== "reused") {
      throw new Error("Share create returned an invalid outcome");
    }
    const returnedVersion = Number(result.slug_key_version);
    assertStoredSlugHash(input.idempotencyKey, returnedVersion, result.stored_slug_hash);
    const expiresAt = String(result.expires_at);
    return {
      slug: deriveSlug(input.idempotencyKey, returnedVersion),
      revokeToken: input.revokeToken,
      payload: structuredClone(input.payload),
      fingerprint: input.fingerprint,
      createdAt: new Date().toISOString(),
      expiresAt,
      isNew: result.outcome === "created",
    };
  }

  async get(slug: string): Promise<ShareRecord | null> {
    const { data, error } = await client().rpc("get_share_snapshot_v1", {
      p_slug_hash: bytea(hash(slug)),
    });
    const result = row(data);
    if (error || !result) throw new Error("Share lookup failed");
    if (result.available !== true) return null;
    if (typeof result.payload_canonical !== "string") return null;
    const payload = canonicalizeSharedSnapshot(JSON.parse(result.payload_canonical) as unknown);
    return {
      slug,
      payload,
      fingerprint: databaseHex(result.snapshot_fingerprint),
      createdAt: "",
      expiresAt: String(result.expires_at),
    };
  }

  async revoke(slug: string, token: string, rateBucketHashes?: { hour: string; day: string }) {
    if (!rateBucketHashes) throw new Error("Production revoke rate buckets are required");
    const { data, error } = await client().rpc("revoke_share_snapshot_v1", {
      p_slug_hash: bytea(hash(slug)),
      p_revoke_token_hash: bytea(hash(token)),
      p_revoke_hour_bucket_hash: rateBucketHashes.hour,
      p_revoke_day_bucket_hash: rateBucketHashes.day,
    });
    const result = row(data);
    if (error || !result) throw new Error("Share revoke failed");
    if (
      result.outcome === "revoked" ||
      result.outcome === "unavailable" ||
      result.outcome === "rate_limited"
    ) {
      return result.outcome;
    }
    throw new Error("Share revoke returned an invalid outcome");
  }
}

export { assertRequiredShareKeyVersions } from "@/server/share-key-readiness";
