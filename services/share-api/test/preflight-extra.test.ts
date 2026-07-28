import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectProductionBlockers, runProductionPreflight } from "../src/preflight.js";

const ALL_CAPABILITIES = {
  automatedFetch: true,
  cache: true,
  normalize: true,
  display: true,
  search: true,
  export: true,
  redistribute: true,
} as const;
const RELEASE_FINGERPRINT = Array.from({ length: 32 }, () => "AB").join(":");
const ACTIVE_KEY = Buffer.alloc(32, 7).toString("base64url");
const HISTORICAL_KEY = Buffer.alloc(32, 8).toString("base64url");
const RATE_KEY = Buffer.alloc(32, 9).toString("base64url");

let tempRoot = "";
let manifestSequence = 0;

function sha256(bytes: string | Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeManifest(contents: string | Uint8Array) {
  manifestSequence += 1;
  const path = join(tempRoot, `rights-${manifestSequence}.json`);
  writeFileSync(path, contents);
  return {
    CATALOG_RIGHTS_MANIFEST_PATH: path,
    CATALOG_RIGHTS_MANIFEST_SHA256: sha256(contents),
  };
}

function approvedManifest(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    status: "approved",
    expiresAt: "2027-07-28T00:00:00.000Z",
    capabilities: ALL_CAPABILITIES,
    ...overrides,
  });
}

function validShareEnvironment() {
  return {
    APP_PROFILE: "production",
    NODE_ENV: "production",
    SITE_ORIGIN: "https://share.singsong.app",
    SUPABASE_URL: "https://singsong-prod.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_server_only_production",
    SHARE_SLUG_ACTIVE_KEY_VERSION: "2",
    SHARE_SLUG_HMAC_KEY_V1: HISTORICAL_KEY,
    SHARE_SLUG_HMAC_KEY_V2: ACTIVE_KEY,
    RATE_LIMIT_IP_HMAC_KEY_V1: RATE_KEY,
    RATE_LIMIT_REDIS_URL: "https://singsong-redis.vendor.co",
    RATE_LIMIT_REDIS_TOKEN: "redis-production-token-12345",
    VERCEL: "1",
    ANDROID_APP_SHA256_CERT_FINGERPRINTS: RELEASE_FINGERPRINT,
    IOS_APP_ID: "A1B2C3D4E5.com.singsong.app",
  } as const;
}

function validCatalogEnvironment(manifest = writeManifest(approvedManifest())) {
  return {
    APP_PROFILE: "release",
    NODE_ENV: "production",
    CATALOG_PROVIDER_URL: "https://catalog.vendor.co.kr/v1/search",
    CATALOG_PROVIDER_API_KEY: "catalog-production-key-123456",
    ...manifest,
  };
}

function validLinkEnvironment() {
  return {
    APP_PROFILE: "production",
    NODE_ENV: "production",
    ANDROID_APP_SHA256_CERT_FINGERPRINTS: RELEASE_FINGERPRINT,
    IOS_APP_ID: "A1B2C3D4E5.com.singsong.app",
  };
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

beforeAll(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "singsong-preflight-"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("production preflight release evidence", () => {
  it("passes the complete release contract and verifies active plus historical slug keys", async () => {
    const environment = {
      ...validShareEnvironment(),
      ...validCatalogEnvironment(),
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([{ slug_key_version: 1 }, { slug_key_version: 2 }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runProductionPreflight(environment, "all")).resolves.toEqual({
      ok: true,
      blockers: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://singsong-prod.supabase.co/rest/v1/rpc/required_share_slug_key_versions_v1",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({});
  });

  it("fails the runtime verification when a historical key is unavailable or RPC fails", async () => {
    const environment = validShareEnvironment();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse([{ slug_key_version: 3 }]));
    fetchMock.mockRejectedValueOnce(new Error("upstream detail must not escape"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runProductionPreflight(environment, "share")).resolves.toEqual({
      ok: false,
      blockers: ["unable to verify active and historical share slug keys"],
    });
    await expect(runProductionPreflight(environment, "share")).resolves.toEqual({
      ok: false,
      blockers: ["unable to verify active and historical share slug keys"],
    });
  });

  it("does not attempt runtime verification while static blockers remain", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const result = await runProductionPreflight(
      {
        APP_PROFILE: "production",
        SITE_ORIGIN: "https://share.singsong.app/private",
      },
      "share",
    );

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("SITE_ORIGIN must be a credential-free public HTTPS origin");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts an approved, current, hashed rights manifest for the catalog scope", () => {
    const blockers = collectProductionBlockers(validCatalogEnvironment(), "catalog", {
      now: new Date("2026-07-28T00:00:00.000Z"),
    });
    expect(blockers).toEqual([]);
  });

  it("reports manifest approval, expiry, and capability failures together", () => {
    const manifest = writeManifest(
      approvedManifest({
        status: "pending",
        expiresAt: "2026-07-27T23:59:59.999Z",
        capabilities: { ...ALL_CAPABILITIES, redistribute: false },
      }),
    );
    const blockers = collectProductionBlockers(validCatalogEnvironment(manifest), "catalog", {
      now: new Date("2026-07-28T00:00:00.000Z"),
    });

    expect(blockers).toEqual([
      "catalog rights manifest lacks required release capabilities",
      "catalog rights manifest must have a future expiry",
      "catalog rights manifest status must be approved",
    ]);
  });

  it("rejects missing, mismatched, malformed, non-object, empty, and oversized manifests", () => {
    const missing = collectProductionBlockers(
      validCatalogEnvironment({
        CATALOG_RIGHTS_MANIFEST_PATH: join(tempRoot, "missing.json"),
        CATALOG_RIGHTS_MANIFEST_SHA256: "a".repeat(64),
      }),
      "catalog",
    );
    expect(missing).toContain("catalog rights manifest file is unavailable");

    const mismatchedManifest = writeManifest(approvedManifest());
    const mismatch = collectProductionBlockers(
      validCatalogEnvironment({
        ...mismatchedManifest,
        CATALOG_RIGHTS_MANIFEST_SHA256: "b".repeat(64),
      }),
      "catalog",
    );
    expect(mismatch).toContain("catalog rights manifest SHA-256 does not match");

    const malformed = collectProductionBlockers(
      validCatalogEnvironment(writeManifest("{")),
      "catalog",
    );
    expect(malformed).toContain("catalog rights manifest is not valid JSON");

    const array = collectProductionBlockers(
      validCatalogEnvironment(writeManifest("[]")),
      "catalog",
    );
    expect(array).toContain("catalog rights manifest must be a JSON object");

    const empty = collectProductionBlockers(validCatalogEnvironment(writeManifest("")), "catalog");
    expect(empty).toContain("catalog rights manifest must be a 1..65536 byte file");

    const oversized = collectProductionBlockers(
      validCatalogEnvironment(writeManifest(new Uint8Array(64 * 1024 + 1))),
      "catalog",
    );
    expect(oversized).toContain("catalog rights manifest must be a 1..65536 byte file");
  });

  it("keeps catalog manifest validation conditional on a syntactically valid digest", () => {
    const blockers = collectProductionBlockers(
      {
        APP_PROFILE: "production",
        CATALOG_PROVIDER_URL: "https://catalog.vendor.co.kr/v1/search",
        CATALOG_PROVIDER_API_KEY: "catalog-production-key-123456",
        CATALOG_RIGHTS_MANIFEST_PATH: join(tempRoot, "missing-but-not-read.json"),
        CATALOG_RIGHTS_MANIFEST_SHA256: "not-a-digest",
      },
      "catalog",
    );

    expect(blockers).toContain("CATALOG_RIGHTS_MANIFEST_SHA256 must be a SHA-256 hex digest");
    expect(blockers).not.toContain("catalog rights manifest file is unavailable");
  });

  it("rejects catalog provider values that cannot be parsed as URLs", () => {
    const blockers = collectProductionBlockers(
      {
        ...validCatalogEnvironment(),
        CATALOG_PROVIDER_URL: "://not-a-url",
      },
      "catalog",
    );
    expect(blockers).toEqual(["CATALOG_PROVIDER_URL must be a credential-free public HTTPS URL"]);
  });

  it("accepts canonical association documents and normalizes lowercase fingerprints", () => {
    const environment = {
      ...validLinkEnvironment(),
      ANDROID_APP_SHA256_CERT_FINGERPRINTS: RELEASE_FINGERPRINT.toLowerCase(),
    };
    expect(collectProductionBlockers(environment, "links")).toEqual([]);
  });

  it("rejects incomplete Android and Apple association identities", () => {
    const blockers = collectProductionBlockers(
      {
        APP_PROFILE: "production",
        NODE_ENV: "development",
        ANDROID_APP_SHA256_CERT_FINGERPRINTS: `${RELEASE_FINGERPRINT},invalid`,
        IOS_APP_ID: "SHORT.com.singsong.app",
      },
      "links",
    );

    expect(blockers).toEqual([
      "ANDROID_APP_SHA256_CERT_FINGERPRINTS must contain release certificate hashes",
      "IOS_APP_ID must be the Apple team ID plus com.singsong.app",
      "NODE_ENV must be production when set",
    ]);
  });

  it("rejects private, credentialed, path-bearing origins and placeholder secrets", () => {
    const blockers = collectProductionBlockers(
      {
        APP_PROFILE: "fixture",
        NODE_ENV: "test",
        SITE_ORIGIN: "https://user:password@share.singsong.app",
        SUPABASE_URL: "https://127.0.0.1",
        SUPABASE_SECRET_KEY: "legacy-anon-key",
        SHARE_SLUG_ACTIVE_KEY_VERSION: "2",
        SHARE_SLUG_HMAC_KEY_V2: "change-me".repeat(8),
        RATE_LIMIT_IP_HMAC_KEY_V1: "test_secret".repeat(6),
        RATE_LIMIT_REDIS_URL: "https://redis.vendor.co/api",
        RATE_LIMIT_REDIS_TOKEN: "placeholder-token-value",
        VERCEL: "0",
      },
      "share",
    );

    expect(blockers).toEqual(
      expect.arrayContaining([
        "APP_PROFILE must be production or release",
        "NODE_ENV must be production when set",
        "SITE_ORIGIN must be a credential-free public HTTPS origin",
        "SUPABASE_URL must be a credential-free public HTTPS origin",
        "SUPABASE_SECRET_KEY must be a current server-only secret key",
        "SHARE_SLUG_HMAC_KEY_V2 must contain at least 32 random bytes",
        "RATE_LIMIT_IP_HMAC_KEY_V1 must contain at least 32 random bytes",
        "RATE_LIMIT_REDIS_URL must be a credential-free public HTTPS origin",
        "RATE_LIMIT_REDIS_TOKEN must be a non-placeholder server-only token",
        "VERCEL=1 is required for the trusted proxy header contract",
      ]),
    );
  });

  it("supports the legacy public site-origin variable without weakening HTTPS checks", () => {
    const environment: Record<string, string | undefined> = {
      ...validShareEnvironment(),
      SITE_ORIGIN: undefined,
      NEXT_PUBLIC_SITE_URL: "https://share.singsong.app",
    };
    const blockers = collectProductionBlockers(environment, "share");
    expect(blockers).toEqual([]);
    expect(blockers).not.toContain("approved static OG PNG is unavailable");
  });
});
