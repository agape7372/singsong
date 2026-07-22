import "server-only";
import { createHmac } from "node:crypto";
import { getRuntimeProfile } from "./runtime-profile";

type Bucket = { count: number; resetsAt: number };

declare global {
  var __singsongRateLimits: Map<string, Bucket> | undefined;
}

const buckets = globalThis.__singsongRateLimits ?? new Map<string, Bucket>();
globalThis.__singsongRateLimits = buckets;

async function anonymousKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const input = new TextEncoder().encode(`${scope}:${forwarded}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest).slice(0, 12), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function takeRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
) {
  const key = await anonymousKey(request, scope);
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetsAt <= now) {
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetsAt - now) / 1000)),
  };
}

export function productionRateBucketHashes(request: Request, scope: "create" | "revoke") {
  if (getRuntimeProfile() === "fixture") return undefined;
  const secret = process.env.RATE_LIMIT_IP_HMAC_KEY_V1;
  if (!secret) throw new Error("RATE_LIMIT_IP_HMAC_KEY_V1 is required in production");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!forwarded) throw new Error("Trusted proxy identity is unavailable");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const derive = (windowSeconds: number) => {
    const window = Math.floor(nowSeconds / windowSeconds);
    const digest = createHmac("sha256", secret)
      .update(`singsong/rate/${scope}/v1\0${forwarded}\0${windowSeconds}\0${window}`)
      .digest("hex");
    return `\\x${digest}`;
  };
  return { hour: derive(3_600), day: derive(86_400) };
}
