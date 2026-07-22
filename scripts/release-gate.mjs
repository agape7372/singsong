import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { RELEASE_REQUIRED_ENV } from "./release-env-contract.mjs";

export { RELEASE_REQUIRED_ENV };

const RIGHTS_CAPABILITIES = Object.freeze([
  "automatedFetch",
  "cache",
  "rawRetention",
  "normalize",
  "display",
  "search",
  "export",
  "redistribute",
]);

const REQUIRED_RIGHTS_CAPABILITIES = Object.freeze([
  "automatedFetch",
  "cache",
  "normalize",
  "display",
  "search",
  "export",
  "redistribute",
]);

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

const FORBIDDEN_BYPASS_ENV = Object.freeze([
  "ALLOW_FIXTURE",
  "CATALOG_USE_FIXTURE",
  "TURNSTILE_BYPASS",
  "SINGSONG_TEST_BYPASS",
  "PLAYWRIGHT_TEST",
]);

const PLACEHOLDER =
  /(?:change[-_ ]?me|placeholder|example|dummy|configured|your[-_ ]|test[-_ ]?(?:key|secret)|xxx)/iu;
const MAX_MANIFEST_BYTES = 64 * 1024;

export class ReleaseGateError extends Error {
  constructor(blockers) {
    super(`BLOCK_EXTERNAL: ${[...new Set(blockers)].join("; ")}`);
    this.name = "ReleaseGateError";
    this.code = "BLOCK_EXTERNAL";
    this.blockers = Object.freeze([...new Set(blockers)]);
  }
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function nonPlaceholder(value, minimumLength = 1) {
  return (
    typeof value === "string" &&
    value.trim().length >= minimumLength &&
    !PLACEHOLDER.test(value.trim())
  );
}

function publicHttpsUrl(value, label, blockers) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const privateIpv4 =
      /^(?:10\.|127\.|169\.254\.|192\.168\.)/u.test(hostname) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname);
    const reserved =
      /(?:^|\.)example(?:\.(?:com|net|org))?$/u.test(hostname) ||
      /(?:^|\.)(?:test|invalid)$/u.test(hostname);
    const local =
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local") ||
      privateIpv4 ||
      reserved;
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      local ||
      !hostname.includes(".")
    ) {
      throw new Error("not a public HTTPS URL");
    }
    return parsed;
  } catch {
    blockers.push(`${label} must be a credential-free public HTTPS URL`);
    return null;
  }
}

function decodeBase64UrlSecret(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43,}$/u.test(value)) return 0;
  try {
    return Buffer.from(value, "base64url").byteLength;
  } catch {
    return 0;
  }
}

function stringArray(value) {
  return Array.isArray(value) && value.every((entry) => nonPlaceholder(entry));
}

function validateRightsManifest(manifest, now, blockers) {
  const value = record(manifest);
  if (!value) {
    blockers.push("catalog rights manifest must be a JSON object");
    return;
  }

  for (const key of [
    "manifestId",
    "manifestVersion",
    "sourceId",
    "providerLegalName",
    "integrationChannel",
    "evidenceRef",
    "credentialRef",
    "takedownRouteRef",
  ]) {
    if (!nonPlaceholder(value[key])) blockers.push(`catalog rights manifest ${key} is required`);
  }

  if (value.status !== "approved") {
    blockers.push("catalog rights manifest status must be approved");
  }

  const effectiveAt = Date.parse(typeof value.effectiveAt === "string" ? value.effectiveAt : "");
  const expiresAt = Date.parse(typeof value.expiresAt === "string" ? value.expiresAt : "");
  if (!Number.isFinite(effectiveAt) || effectiveAt > now.getTime()) {
    blockers.push("catalog rights manifest is not yet effective");
  }
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    blockers.push("catalog rights manifest is expired or has no future expiry");
  }

  if (!stringArray(value.environments) || !value.environments.includes("release")) {
    blockers.push("catalog rights manifest environments must explicitly include release");
  }
  if (!stringArray(value.territories) || value.territories.length === 0) {
    blockers.push("catalog rights manifest territories must be explicit");
  }
  if (!stringArray(value.fieldScope) || value.fieldScope.length === 0) {
    blockers.push("catalog rights manifest fieldScope must be explicit");
  }
  if (!stringArray(value.approvalRefs) || new Set(value.approvalRefs).size < 2) {
    blockers.push(
      "catalog rights manifest needs distinct Product Operations and Legal approval refs",
    );
  }

  const capabilities = record(value.capabilities);
  if (!capabilities) {
    blockers.push("catalog rights manifest capabilities are required");
  } else {
    for (const capability of RIGHTS_CAPABILITIES) {
      if (typeof capabilities[capability] !== "boolean") {
        blockers.push(`catalog rights capability ${capability} must be explicit`);
      }
    }
    for (const capability of REQUIRED_RIGHTS_CAPABILITIES) {
      if (capabilities[capability] !== true) {
        blockers.push(`catalog rights capability ${capability} is not approved`);
      }
    }
  }
}

function verifyRightsFile(env, cwd, now, blockers) {
  const configuredPath = env.CATALOG_RIGHTS_MANIFEST_PATH;
  const configuredDigest = env.CATALOG_RIGHTS_MANIFEST_SHA256;
  if (!configuredPath || !configuredDigest) return;
  if (!/^[a-fA-F0-9]{64}$/u.test(configuredDigest)) {
    blockers.push("CATALOG_RIGHTS_MANIFEST_SHA256 must be a SHA-256 hex digest");
    return;
  }

  try {
    const manifestPath = resolve(cwd, configuredPath);
    const stats = statSync(manifestPath);
    if (!stats.isFile() || stats.size === 0 || stats.size > MAX_MANIFEST_BYTES) {
      blockers.push("catalog rights manifest file must be 1..65536 bytes");
      return;
    }
    const bytes = readFileSync(manifestPath);
    const actual = Buffer.from(createHash("sha256").update(bytes).digest("hex"), "hex");
    const expected = Buffer.from(configuredDigest, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      blockers.push("catalog rights manifest SHA-256 does not match");
      return;
    }
    validateRightsManifest(JSON.parse(bytes.toString("utf8")), now, blockers);
  } catch (error) {
    if (error instanceof SyntaxError) {
      blockers.push("catalog rights manifest is not valid JSON");
    } else {
      blockers.push("catalog rights manifest file is unavailable");
    }
  }
}

export function collectReleaseBlockers(env = process.env, options = {}) {
  const blockers = [];
  const now = options.now ?? new Date();
  const cwd = options.cwd ?? process.cwd();
  const profile = env.APP_PROFILE;
  if (profile !== "release" && profile !== "production") {
    blockers.push("APP_PROFILE must be release");
  }
  if (
    env.NEXT_PUBLIC_APP_PROFILE &&
    !["release", "production"].includes(env.NEXT_PUBLIC_APP_PROFILE)
  ) {
    blockers.push("NEXT_PUBLIC_APP_PROFILE must be release");
  }
  if (env.NODE_ENV && env.NODE_ENV !== "production") {
    blockers.push("NODE_ENV test/development bypass is forbidden");
  }
  for (const key of FORBIDDEN_BYPASS_ENV) {
    if (env[key] && !/^(?:0|false|off|no)$/iu.test(env[key])) {
      blockers.push(`${key} bypass is forbidden`);
    }
  }

  const missing = RELEASE_REQUIRED_ENV.filter((key) => !env[key]?.trim());
  if (missing.length > 0) blockers.push(`missing release configuration: ${missing.join(", ")}`);

  const siteUrl = env.NEXT_PUBLIC_SITE_URL
    ? publicHttpsUrl(env.NEXT_PUBLIC_SITE_URL, "NEXT_PUBLIC_SITE_URL", blockers)
    : null;
  if (siteUrl && (siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash)) {
    blockers.push("NEXT_PUBLIC_SITE_URL must be an origin without path, query, or fragment");
  }
  if (env.SUPABASE_URL) publicHttpsUrl(env.SUPABASE_URL, "SUPABASE_URL", blockers);
  if (env.CATALOG_PROVIDER_URL) {
    publicHttpsUrl(env.CATALOG_PROVIDER_URL, "CATALOG_PROVIDER_URL", blockers);
  }

  if (env.SUPABASE_SECRET_KEY && !env.SUPABASE_SECRET_KEY.startsWith("sb_secret_")) {
    blockers.push("SUPABASE_SECRET_KEY must be a current sb_secret_ server key");
  }
  if (env.SHARE_SLUG_ACTIVE_KEY_VERSION) {
    const version = Number(env.SHARE_SLUG_ACTIVE_KEY_VERSION);
    if (!Number.isSafeInteger(version) || version < 1 || version > 32_767) {
      blockers.push("SHARE_SLUG_ACTIVE_KEY_VERSION is invalid");
    } else {
      const activeKey = env[`SHARE_SLUG_HMAC_KEY_V${version}`];
      if (!activeKey)
        blockers.push(`missing release configuration: SHARE_SLUG_HMAC_KEY_V${version}`);
      else if (decodeBase64UrlSecret(activeKey) < 32) {
        blockers.push(`SHARE_SLUG_HMAC_KEY_V${version} must contain at least 32 random bytes`);
      }
    }
  }
  if (env.RATE_LIMIT_IP_HMAC_KEY_V1 && decodeBase64UrlSecret(env.RATE_LIMIT_IP_HMAC_KEY_V1) < 32) {
    blockers.push("RATE_LIMIT_IP_HMAC_KEY_V1 must contain at least 32 random bytes");
  }

  if (env.TURNSTILE_SECRET_KEY && TURNSTILE_TEST_KEYS.has(env.TURNSTILE_SECRET_KEY)) {
    blockers.push("Cloudflare Turnstile test keys are forbidden");
  }
  if (
    env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
    TURNSTILE_TEST_KEYS.has(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  ) {
    blockers.push("Cloudflare Turnstile test keys are forbidden");
  }
  for (const key of [
    "SUPABASE_SECRET_KEY",
    "TURNSTILE_SECRET_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "CATALOG_PROVIDER_API_KEY",
  ]) {
    if (
      env[key] &&
      (!nonPlaceholder(env[key], 16) || env[key].trim().toLowerCase() === "fixture")
    ) {
      blockers.push(`${key} is a placeholder or test value`);
    }
  }

  if (env.TURNSTILE_ALLOWED_HOSTNAMES) {
    const hosts = env.TURNSTILE_ALLOWED_HOSTNAMES.split(",").map((value) =>
      value.trim().toLowerCase(),
    );
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
  }

  verifyRightsFile(env, cwd, now, blockers);
  return Object.freeze([...new Set(blockers)]);
}

export function assertReleaseEnvironment(env = process.env, options = {}) {
  const blockers = collectReleaseBlockers(env, options);
  if (blockers.length > 0) throw new ReleaseGateError(blockers);
}
