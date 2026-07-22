import "server-only";
import { RELEASE_REQUIRED_ENV } from "../../scripts/release-env-contract.mjs";
import { assertConfiguredShareKeyVersions } from "@/server/share-key-readiness";

const TURNSTILE_TEST_KEYS = new Set([
  "1x00000000000000000000AA",
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

const PLACEHOLDER =
  /(?:change[-_ ]?me|placeholder|example|dummy|configured|your[-_ ]|test[-_ ]?(?:key|secret)|xxx)/iu;

function decodedBase64UrlBytes(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9_-]{43,}$/u.test(value)) return 0;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    return atob(`${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`).length;
  } catch {
    return 0;
  }
}

function publicHttpsUrl(value: string | undefined, label: string, blockers: string[]) {
  try {
    const parsed = new URL(value ?? "");
    const hostname = parsed.hostname.toLowerCase();
    const privateIpv4 =
      /^(?:10\.|127\.|169\.254\.|192\.168\.)/u.test(hostname) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname);
    const reserved =
      /(?:^|\.)example(?:\.(?:com|net|org))?$/u.test(hostname) ||
      /(?:^|\.)(?:test|invalid)$/u.test(hostname);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !hostname.includes(".") ||
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local") ||
      privateIpv4 ||
      reserved
    ) {
      throw new Error("not public HTTPS");
    }
    return parsed;
  } catch {
    blockers.push(`${label} must be a credential-free public HTTPS URL`);
    return null;
  }
}

function runtimeReleaseBlockers(environment: Readonly<Record<string, string | undefined>>) {
  const blockers: string[] = [];
  if (!["release", "production"].includes(environment.APP_PROFILE ?? "")) {
    blockers.push("APP_PROFILE must be release");
  }
  if (!["release", "production"].includes(environment.NEXT_PUBLIC_APP_PROFILE ?? "")) {
    blockers.push("NEXT_PUBLIC_APP_PROFILE must be release");
  }

  const missing = RELEASE_REQUIRED_ENV.filter((key) => !environment[key]?.trim());
  if (missing.length > 0) blockers.push(`missing release configuration: ${missing.join(", ")}`);

  const siteUrl = publicHttpsUrl(
    environment.NEXT_PUBLIC_SITE_URL,
    "NEXT_PUBLIC_SITE_URL",
    blockers,
  );
  if (siteUrl && (siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash)) {
    blockers.push("NEXT_PUBLIC_SITE_URL must be an origin without path, query, or fragment");
  }
  publicHttpsUrl(environment.SUPABASE_URL, "SUPABASE_URL", blockers);
  publicHttpsUrl(environment.CATALOG_PROVIDER_URL, "CATALOG_PROVIDER_URL", blockers);

  if (!environment.SUPABASE_SECRET_KEY?.startsWith("sb_secret_")) {
    blockers.push("SUPABASE_SECRET_KEY must be a current sb_secret_ server key");
  }
  if (decodedBase64UrlBytes(environment.RATE_LIMIT_IP_HMAC_KEY_V1) < 32) {
    blockers.push("RATE_LIMIT_IP_HMAC_KEY_V1 must contain at least 32 random bytes");
  }
  if (!/^[a-fA-F0-9]{64}$/u.test(environment.CATALOG_RIGHTS_MANIFEST_SHA256 ?? "")) {
    blockers.push("CATALOG_RIGHTS_MANIFEST_SHA256 must be a SHA-256 hex digest");
  }
  for (const key of [
    "SUPABASE_SECRET_KEY",
    "TURNSTILE_SECRET_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "CATALOG_PROVIDER_API_KEY",
  ] as const) {
    const value = environment[key]?.trim() ?? "";
    if (value.length < 16 || PLACEHOLDER.test(value) || value.toLowerCase() === "fixture") {
      blockers.push(`${key} is a placeholder or test value`);
    }
  }
  if (TURNSTILE_TEST_KEYS.has(environment.TURNSTILE_SECRET_KEY ?? "")) {
    blockers.push("Cloudflare Turnstile test keys are forbidden");
  }
  if (TURNSTILE_TEST_KEYS.has(environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "")) {
    blockers.push("Cloudflare Turnstile test keys are forbidden");
  }

  const hosts = (environment.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase());
  if (
    hosts.some(
      (host) =>
        !host ||
        host.includes("://") ||
        host.includes("/") ||
        host.includes("*") ||
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.endsWith(".local"),
    )
  ) {
    blockers.push("TURNSTILE_ALLOWED_HOSTNAMES must contain exact public hostnames");
  }
  if (siteUrl && !hosts.includes(siteUrl.hostname.toLowerCase())) {
    blockers.push("TURNSTILE_ALLOWED_HOSTNAMES must include the canonical site hostname");
  }

  try {
    assertConfiguredShareKeyVersions([], environment);
  } catch (error) {
    blockers.push(
      error instanceof Error ? error.message : "Share slug key configuration is invalid",
    );
  }
  return Object.freeze([...new Set(blockers)]);
}

export function assertRuntimeReleaseEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const blockers = runtimeReleaseBlockers(environment);
  if (blockers.length > 0) throw new Error(`BLOCK_EXTERNAL: ${blockers.join("; ")}`);
}
