import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { canonicalizeSharedSnapshot } from "../domain.js";
import {
  ShareRepositoryError,
  type CreateShareInput,
  type CreateShareResult,
  type RateBucketHashes,
  type ShareRecord,
  type ShareRepository,
} from "./types.js";

const MAX_RPC_RESPONSE_BYTES = 128 * 1024;
const RPC_TIMEOUT_MS = 5_000;

export type SupabaseShareConfig = {
  url: URL;
  secretKey: string;
  activeSlugKeyVersion: number;
  slugKeys: ReadonlyMap<number, Uint8Array>;
};

type RpcRow = Record<string, unknown>;

function hash(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function bytea(hex: string) {
  if (!/^[a-f0-9]{64}$/u.test(hex)) throw new Error("Expected a 32-byte hex digest");
  return `\\x${hex}`;
}

function row(data: unknown): RpcRow | null {
  const candidate = Array.isArray(data) ? data[0] : data;
  return candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)
    ? (candidate as RpcRow)
    : null;
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

async function readBoundedJson(response: Response) {
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_RPC_RESPONSE_BYTES) {
      throw new Error("Supabase RPC response is invalid");
    }
  }
  if (!response.body) throw new Error("Supabase RPC response is invalid");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RPC_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Supabase RPC response is invalid");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error("Supabase RPC response is invalid");
  }
}

async function rpc(config: SupabaseShareConfig, functionName: string, body: object) {
  const endpoint = new URL(`/rest/v1/rpc/${functionName}`, config.url);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        apikey: config.secretKey,
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/json; charset=utf-8",
        "Accept-Profile": "app_api",
        "Content-Profile": "app_api",
        "X-Client-Info": "singsong-share-api/1",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Supabase RPC request failed");
  }
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Supabase RPC request failed");
  }
  return readBoundedJson(response);
}

function slugKey(config: SupabaseShareConfig, version: number) {
  const key = config.slugKeys.get(version);
  if (!key || key.byteLength < 32) {
    throw new Error(`Required share slug key version ${version} is unavailable`);
  }
  return key;
}

function deriveSlug(config: SupabaseShareConfig, idempotencyKey: string, version: number) {
  const message = Buffer.concat([
    Buffer.from("singsong/share-slug/v1", "utf8"),
    Buffer.from([0]),
    Buffer.from(idempotencyKey, "utf8"),
  ]);
  return createHmac("sha256", slugKey(config, version))
    .update(message)
    .digest()
    .subarray(0, 16)
    .toString("base64url");
}

function assertStoredSlugHash(
  config: SupabaseShareConfig,
  idempotencyKey: string,
  version: number,
  value: unknown,
) {
  const derived = Buffer.from(hash(deriveSlug(config, idempotencyKey, version)), "hex");
  const stored = Buffer.from(databaseHex(value), "hex");
  if (derived.byteLength !== stored.byteLength || !timingSafeEqual(derived, stored)) {
    throw new ShareRepositoryError("KEY_MISMATCH");
  }
}

export class SupabaseShareRepository implements ShareRepository {
  constructor(readonly config: SupabaseShareConfig) {}

  async inspect(idempotencyKey: string, fingerprint: string, revokeToken: string) {
    const result = row(
      await rpc(this.config, "inspect_share_snapshot_v1", {
        p_idempotency_hash: bytea(hash(idempotencyKey)),
        p_snapshot_fingerprint: bytea(fingerprintHex(fingerprint)),
        p_revoke_token_hash: bytea(hash(revokeToken)),
      }),
    );
    if (!result) throw new Error("Share inspection failed");
    if (result.outcome === "reusable") {
      const version = Number(result.slug_key_version);
      assertStoredSlugHash(this.config, idempotencyKey, version, result.stored_slug_hash);
      return "reusable" as const;
    }
    if (result.outcome === "missing" || result.outcome === "conflict") {
      return result.outcome;
    }
    throw new Error("Share inspection returned an invalid outcome");
  }

  async create(input: CreateShareInput): Promise<CreateShareResult> {
    if (!input.rateBucketHashes) throw new Error("Production share rate buckets are required");
    const activeVersion = this.config.activeSlugKeyVersion;
    const activeSlug = deriveSlug(this.config, input.idempotencyKey, activeVersion);
    const result = row(
      await rpc(this.config, "create_share_snapshot_v1", {
        p_idempotency_hash: bytea(hash(input.idempotencyKey)),
        p_slug_hash: bytea(hash(activeSlug)),
        p_slug_key_version: activeVersion,
        p_snapshot_fingerprint: bytea(fingerprintHex(input.fingerprint)),
        p_payload_canonical: input.canonicalPayload,
        p_revoke_token_hash: bytea(hash(input.revokeToken)),
        p_create_hour_bucket_hash: input.rateBucketHashes.hour,
        p_create_day_bucket_hash: input.rateBucketHashes.day,
      }),
    );
    if (!result) throw new Error("Share repository rejected create");
    if (result.outcome === "rate_limited") throw new ShareRepositoryError("RATE_LIMITED");
    if (result.outcome === "conflict") throw new ShareRepositoryError("CONFLICT");
    if (result.outcome !== "created" && result.outcome !== "reused") {
      throw new Error("Share create returned an invalid outcome");
    }
    const returnedVersion = Number(result.slug_key_version);
    assertStoredSlugHash(
      this.config,
      input.idempotencyKey,
      returnedVersion,
      result.stored_slug_hash,
    );
    return {
      slug: deriveSlug(this.config, input.idempotencyKey, returnedVersion),
      revokeToken: input.revokeToken,
      payload: structuredClone(input.payload),
      fingerprint: input.fingerprint,
      createdAt: new Date().toISOString(),
      expiresAt: String(result.expires_at),
      isNew: result.outcome === "created",
    };
  }

  async get(slug: string): Promise<ShareRecord | null> {
    const result = row(
      await rpc(this.config, "get_share_snapshot_v1", {
        p_slug_hash: bytea(hash(slug)),
      }),
    );
    if (!result) throw new Error("Share lookup failed");
    if (result.available !== true || typeof result.payload_canonical !== "string") return null;
    return {
      slug,
      payload: canonicalizeSharedSnapshot(JSON.parse(result.payload_canonical) as unknown),
      fingerprint: databaseHex(result.snapshot_fingerprint),
      createdAt: "",
      expiresAt: String(result.expires_at),
    };
  }

  async revoke(slug: string, token: string, rateBucketHashes?: RateBucketHashes) {
    if (!rateBucketHashes) throw new Error("Production revoke rate buckets are required");
    const result = row(
      await rpc(this.config, "revoke_share_snapshot_v1", {
        p_slug_hash: bytea(hash(slug)),
        p_revoke_token_hash: bytea(hash(token)),
        p_revoke_hour_bucket_hash: rateBucketHashes.hour,
        p_revoke_day_bucket_hash: rateBucketHashes.day,
      }),
    );
    if (!result) throw new Error("Share revoke failed");
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

export async function requiredShareSlugKeyVersions(config: SupabaseShareConfig) {
  const body = await rpc(config, "required_share_slug_key_versions_v1", {});
  if (!Array.isArray(body)) throw new Error("Required share key version response is invalid");
  const versions = new Set([config.activeSlugKeyVersion]);
  for (const entry of body) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Required share key version response is invalid");
    }
    const version = Number((entry as RpcRow).slug_key_version);
    if (!Number.isSafeInteger(version) || version < 1 || version > 32_767) {
      throw new Error("Database returned an invalid share slug key version");
    }
    versions.add(version);
  }
  for (const version of versions) slugKey(config, version);
  return [...versions].sort((left, right) => left - right);
}
