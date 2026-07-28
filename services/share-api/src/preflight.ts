import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isApprovedOgPng } from "./og-asset.js";
import { createRuntime } from "./runtime-config.js";
import {
  SupabaseShareRepository,
  requiredShareSlugKeyVersions,
} from "./share/supabase-repository.js";

type Environment = Readonly<Record<string, string | undefined>>;
type PreflightScope = "all" | "share" | "catalog" | "links";

const placeholder =
  /(?:change[-_ ]?me|placeholder|example|dummy|configured|your[-_ ]|test[-_ ]?(?:key|secret)|xxx)/iu;
const fingerprintPattern = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/u;
const requiredCatalogCapabilities = [
  "automatedFetch",
  "cache",
  "normalize",
  "display",
  "search",
  "export",
  "redistribute",
] as const;

function isPublicHttpsUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const local =
      host === "localhost" ||
      host === "::1" ||
      host.endsWith(".local") ||
      /^(?:10\.|127\.|169\.254\.|192\.168\.)/u.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./u.test(host) ||
      /(?:^|\.)example(?:\.(?:com|net|org))?$/u.test(host) ||
      /(?:^|\.)(?:test|invalid)$/u.test(host);
    return (
      url.protocol === "https:" && !url.username && !url.password && host.includes(".") && !local
    );
  } catch {
    return false;
  }
}

function isPublicHttpsOrigin(value: string | undefined) {
  if (!value || !isPublicHttpsUrl(value)) return false;
  const url = new URL(value);
  return url.pathname === "/" && !url.search && !url.hash;
}

function secretBytes(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9_-]{43,}$/u.test(value) || placeholder.test(value)) return 0;
  try {
    return Buffer.from(value, "base64url").byteLength;
  } catch {
    return 0;
  }
}

function collectShareBlockers(environment: Environment) {
  const blockers: string[] = [];
  const siteOrigin = environment.SITE_ORIGIN ?? environment.NEXT_PUBLIC_SITE_URL;
  if (!isPublicHttpsOrigin(siteOrigin)) {
    blockers.push("SITE_ORIGIN must be a credential-free public HTTPS origin");
  }
  if (!isPublicHttpsOrigin(environment.SUPABASE_URL)) {
    blockers.push("SUPABASE_URL must be a credential-free public HTTPS origin");
  }
  if (!environment.SUPABASE_SECRET_KEY?.startsWith("sb_secret_")) {
    blockers.push("SUPABASE_SECRET_KEY must be a current server-only secret key");
  }
  const activeVersion = Number(environment.SHARE_SLUG_ACTIVE_KEY_VERSION);
  if (!Number.isSafeInteger(activeVersion) || activeVersion < 1 || activeVersion > 32_767) {
    blockers.push("SHARE_SLUG_ACTIVE_KEY_VERSION must be an integer from 1 to 32767");
  } else if (secretBytes(environment[`SHARE_SLUG_HMAC_KEY_V${activeVersion}`]) < 32) {
    blockers.push(`SHARE_SLUG_HMAC_KEY_V${activeVersion} must contain at least 32 random bytes`);
  }
  if (secretBytes(environment.RATE_LIMIT_IP_HMAC_KEY_V1) < 32) {
    blockers.push("RATE_LIMIT_IP_HMAC_KEY_V1 must contain at least 32 random bytes");
  }
  if (!isPublicHttpsOrigin(environment.RATE_LIMIT_REDIS_URL)) {
    blockers.push("RATE_LIMIT_REDIS_URL must be a credential-free public HTTPS origin");
  }
  if (
    !environment.RATE_LIMIT_REDIS_TOKEN ||
    environment.RATE_LIMIT_REDIS_TOKEN.length < 16 ||
    placeholder.test(environment.RATE_LIMIT_REDIS_TOKEN)
  ) {
    blockers.push("RATE_LIMIT_REDIS_TOKEN must be a non-placeholder server-only token");
  }
  if (environment.VERCEL !== "1") {
    blockers.push("VERCEL=1 is required for the trusted proxy header contract");
  }
  return blockers;
}

function collectCatalogBlockers(environment: Environment) {
  const blockers: string[] = [];
  if (!isPublicHttpsUrl(environment.CATALOG_PROVIDER_URL)) {
    blockers.push("CATALOG_PROVIDER_URL must be a credential-free public HTTPS URL");
  }
  if (
    !environment.CATALOG_PROVIDER_API_KEY ||
    environment.CATALOG_PROVIDER_API_KEY.length < 16 ||
    placeholder.test(environment.CATALOG_PROVIDER_API_KEY)
  ) {
    blockers.push("CATALOG_PROVIDER_API_KEY must be a non-placeholder server-only key");
  }
  if (!environment.CATALOG_RIGHTS_MANIFEST_PATH) {
    blockers.push("CATALOG_RIGHTS_MANIFEST_PATH is required");
  }
  if (!/^[a-fA-F0-9]{64}$/u.test(environment.CATALOG_RIGHTS_MANIFEST_SHA256 ?? "")) {
    blockers.push("CATALOG_RIGHTS_MANIFEST_SHA256 must be a SHA-256 hex digest");
  }
  return blockers;
}

function collectLinkBlockers(environment: Environment) {
  const blockers: string[] = [];
  const fingerprints = (environment.ANDROID_APP_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (fingerprints.length === 0 || fingerprints.some((value) => !fingerprintPattern.test(value))) {
    blockers.push("ANDROID_APP_SHA256_CERT_FINGERPRINTS must contain release certificate hashes");
  }
  if (!/^[A-Z0-9]{10}\.com\.singsong\.app$/u.test(environment.IOS_APP_ID ?? "")) {
    blockers.push("IOS_APP_ID must be the Apple team ID plus com.singsong.app");
  }
  return blockers;
}

function validateCatalogRightsManifest(environment: Environment, cwd: string, now: Date): string[] {
  const path = environment.CATALOG_RIGHTS_MANIFEST_PATH;
  const expectedDigest = environment.CATALOG_RIGHTS_MANIFEST_SHA256;
  if (!path || !expectedDigest || !/^[a-fA-F0-9]{64}$/u.test(expectedDigest)) return [];
  let bytes: Buffer;
  try {
    const fullPath = resolve(cwd, path);
    const stats = statSync(fullPath);
    if (!stats.isFile() || stats.size < 1 || stats.size > 64 * 1024) {
      return ["catalog rights manifest must be a 1..65536 byte file"];
    }
    bytes = readFileSync(fullPath);
  } catch {
    return ["catalog rights manifest file is unavailable"];
  }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual.toLowerCase() !== expectedDigest.toLowerCase()) {
    return ["catalog rights manifest SHA-256 does not match"];
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    return ["catalog rights manifest is not valid JSON"];
  }
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["catalog rights manifest must be a JSON object"];
  }
  const record = manifest as Record<string, unknown>;
  const blockers: string[] = [];
  if (record.status !== "approved")
    blockers.push("catalog rights manifest status must be approved");
  const expiresAt = Date.parse(typeof record.expiresAt === "string" ? record.expiresAt : "");
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    blockers.push("catalog rights manifest must have a future expiry");
  }
  const capabilities =
    record.capabilities !== null &&
    typeof record.capabilities === "object" &&
    !Array.isArray(record.capabilities)
      ? (record.capabilities as Record<string, unknown>)
      : null;
  if (
    !capabilities ||
    requiredCatalogCapabilities.some((capability) => capabilities[capability] !== true)
  ) {
    blockers.push("catalog rights manifest lacks required release capabilities");
  }
  return blockers;
}

function validateOgAsset() {
  const candidates = [
    new URL("../public/og/ticket-1200x630.png", import.meta.url),
    new URL("../../../public/og/ticket-1200x630.png", import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const bytes = readFileSync(candidate);
      if (isApprovedOgPng(bytes)) return [];
    } catch {
      // Continue to the next approved asset location.
    }
  }
  return ["approved static OG PNG is unavailable"];
}

export function collectProductionBlockers(
  environment: Environment = process.env,
  scope: PreflightScope = "all",
  options: { cwd?: string; now?: Date } = {},
) {
  const blockers: string[] = [];
  if (environment.APP_PROFILE !== "production" && environment.APP_PROFILE !== "release") {
    blockers.push("APP_PROFILE must be production or release");
  }
  if (environment.NODE_ENV && environment.NODE_ENV !== "production") {
    blockers.push("NODE_ENV must be production when set");
  }
  if (scope === "all" || scope === "share") {
    blockers.push(...collectShareBlockers(environment), ...validateOgAsset());
  }
  if (scope === "all" || scope === "catalog") {
    blockers.push(...collectCatalogBlockers(environment));
    blockers.push(
      ...validateCatalogRightsManifest(
        environment,
        options.cwd ?? process.cwd(),
        options.now ?? new Date(),
      ),
    );
  }
  if (scope === "all" || scope === "links") {
    blockers.push(...collectLinkBlockers(environment));
  }
  return [...new Set(blockers)].sort();
}

export async function runProductionPreflight(
  environment: Environment = process.env,
  scope: PreflightScope = "all",
) {
  const blockers = collectProductionBlockers(environment, scope);
  if (blockers.length > 0) return { ok: false as const, blockers };
  if (scope === "all" || scope === "share") {
    try {
      const runtime = createRuntime(environment);
      if (!(runtime.repository instanceof SupabaseShareRepository)) {
        throw new Error("Production share repository is unavailable");
      }
      await requiredShareSlugKeyVersions(runtime.repository.config);
    } catch {
      return {
        ok: false as const,
        blockers: ["unable to verify active and historical share slug keys"],
      };
    }
  }
  return { ok: true as const, blockers: [] };
}

async function main() {
  const rawScope = process.argv.find((argument) => argument.startsWith("--scope="))?.slice(8);
  const scope: PreflightScope =
    rawScope === "share" || rawScope === "catalog" || rawScope === "links" ? rawScope : "all";
  const result = await runProductionPreflight(process.env, scope);
  process.stdout.write(
    `${JSON.stringify(
      result.ok
        ? { status: "PASS", scope }
        : { status: "BLOCKED_EXTERNAL", scope, blockers: result.blockers },
    )}\n`,
  );
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
