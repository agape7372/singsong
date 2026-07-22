import "server-only";
import { getRuntimeProfile } from "./runtime-profile";

const TEST_SECRET_KEYS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

function loopbackRequest(request: Request) {
  try {
    const hostname = new URL(request.url).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

async function sha256(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", copy.buffer));
}

export async function deriveTurnstileAttemptId(idempotencyKey: string, token: string) {
  const prefix = new TextEncoder().encode("singsong/turnstile-attempt/v1");
  const idempotencyHash = await sha256(idempotencyKey);
  const tokenHash = await sha256(token);
  const input = new Uint8Array(prefix.length + 1 + idempotencyHash.length + 1 + tokenHash.length);
  input.set(prefix, 0);
  input.set(idempotencyHash, prefix.length + 1);
  input.set(tokenHash, prefix.length + 1 + idempotencyHash.length + 1);
  const digest = await sha256(input);
  const uuid = digest.slice(0, 16);
  uuid[6] = ((uuid[6] ?? 0) & 0x0f) | 0x40;
  uuid[8] = ((uuid[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(uuid, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function allowedHostnames() {
  return new Set(
    (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function verifyHuman(
  token: string | undefined,
  request: Request,
  idempotencyKey: string,
) {
  if (process.env.NODE_ENV === "test") return true;
  if (getRuntimeProfile() === "fixture") return loopbackRequest(request);
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || TEST_SECRET_KEYS.has(secret) || !token || token.length > 2048) return false;
  const hosts = allowedHostnames();
  if (hosts.size === 0) return false;
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  form.set("idempotency_key", await deriveTurnstileAttemptId(idempotencyKey, token));
  const remote = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (remote) form.set("remoteip", remote);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
      challenge_ts?: string;
    };
    const challengedAt = Date.parse(result.challenge_ts ?? "");
    const ageMs = Date.now() - challengedAt;
    return (
      result.success === true &&
      result.action === "create_share" &&
      typeof result.hostname === "string" &&
      hosts.has(result.hostname.toLowerCase()) &&
      Number.isFinite(challengedAt) &&
      ageMs >= -30_000 &&
      ageMs <= 300_000
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
