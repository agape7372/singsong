import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { RateBucketHashes } from "./share/types.js";

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export interface RateLimiter {
  take(
    request: Request,
    scope: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitDecision>;
}

type MemoryBucket = { count: number; resetsAt: number };

export class MemoryRateLimiter implements RateLimiter {
  readonly #buckets = new Map<string, MemoryBucket>();

  constructor(
    readonly now: () => number = Date.now,
    readonly identity: (request: Request) => string = (request) =>
      request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "local",
  ) {}

  async take(request: Request, scope: string, limit: number, windowSeconds: number) {
    const now = this.now();
    const key = `${scope}:${this.identity(request)}`;
    const current = this.#buckets.get(key);
    if (!current || current.resetsAt <= now) {
      this.#buckets.set(key, { count: 1, resetsAt: now + windowSeconds * 1_000 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    current.count += 1;
    return {
      allowed: current.count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetsAt - now) / 1_000)),
    };
  }
}

export class AllowAllRateLimiter implements RateLimiter {
  async take() {
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export type ServerlessRateLimitConfig = {
  redisUrl: URL;
  redisToken: string;
  ipHmacKey: Uint8Array;
};

type RedisResult = { result?: unknown; error?: unknown };

/**
 * Returns the public client address that Vercel injected.
 *
 * `x-forwarded-for` is intentionally ignored here. A caller can supply it
 * before a platform boundary, while Vercel documents
 * `x-vercel-forwarded-for` as its canonical copy. `x-vercel-id` is required so
 * a directly exposed Node process cannot silently claim the Vercel contract.
 */
export function trustedVercelClientIp(request: Request) {
  if (!request.headers.get("x-vercel-id")) {
    throw new Error("Trusted Vercel request identity is unavailable");
  }
  const value = request.headers.get("x-vercel-forwarded-for")?.trim() ?? "";
  if (!value || value.includes(",") || value.includes("%") || isIP(value) === 0) {
    throw new Error("Trusted Vercel client IP is unavailable");
  }
  return value;
}

function hmacHex(secret: Uint8Array, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

async function readRedisResults(response: Response) {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Distributed rate limit is unavailable");
  }
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (!Number.isSafeInteger(size) || size < 0 || size > 8 * 1024) {
      throw new Error("Distributed rate limit is unavailable");
    }
  }
  if (!response.body) throw new Error("Distributed rate limit is unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024) {
        await reader.cancel();
        throw new Error("Distributed rate limit is unavailable");
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
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Distributed rate limit is unavailable");
  }
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Distributed rate limit is unavailable");
  }
  if (
    !Array.isArray(data) ||
    data.length !== 3 ||
    data.some(
      (entry) =>
        entry === null || typeof entry !== "object" || Array.isArray(entry) || "error" in entry,
    )
  ) {
    throw new Error("Distributed rate limit is unavailable");
  }
  return data as RedisResult[];
}

/**
 * Fixed-window limiter backed by an Upstash-compatible Redis REST pipeline.
 *
 * Every request attempts `EXPIRE ... NX`; only the first wins, so interleaved
 * pipelines cannot turn the counter into a permanent key.
 */
export class ServerlessRateLimiter implements RateLimiter {
  constructor(readonly config: ServerlessRateLimitConfig) {}

  async take(request: Request, scope: string, limit: number, windowSeconds: number) {
    const ip = trustedVercelClientIp(request);
    const identity = hmacHex(this.config.ipHmacKey, `singsong/edge-rate/v1\0${ip}`).slice(0, 32);
    const window = Math.floor(Date.now() / (windowSeconds * 1_000));
    const key = `singsong:rate:${scope}:${windowSeconds}:${window}:${identity}`;
    let response: Response;
    try {
      response = await fetch(new URL("/pipeline", this.config.redisUrl), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.config.redisToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, windowSeconds, "NX"],
          ["TTL", key],
        ]),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(3_000),
      });
    } catch {
      throw new Error("Distributed rate limit is unavailable");
    }
    const results = await readRedisResults(response);
    const count = Number(results[0]?.result);
    const ttl = Number(results[2]?.result);
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error("Distributed rate limit is unavailable");
    }
    return {
      allowed: count <= limit,
      retryAfterSeconds:
        count <= limit ? 0 : Number.isSafeInteger(ttl) && ttl > 0 ? ttl : windowSeconds,
    };
  }
}

export function productionRateBucketHashes(
  request: Request,
  scope: "create" | "revoke",
  secret: Uint8Array,
  now = Date.now(),
): RateBucketHashes {
  const ip = trustedVercelClientIp(request);
  const nowSeconds = Math.floor(now / 1_000);
  const derive = (windowSeconds: number) => {
    const window = Math.floor(nowSeconds / windowSeconds);
    return `\\x${hmacHex(secret, `singsong/rate/${scope}/v1\0${ip}\0${windowSeconds}\0${window}`)}`;
  };
  return { hour: derive(3_600), day: derive(86_400) };
}
