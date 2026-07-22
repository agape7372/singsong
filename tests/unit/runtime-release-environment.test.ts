import { describe, expect, it } from "vitest";
import { assertRuntimeReleaseEnvironment } from "@/server/runtime-release-environment";

function validReleaseEnvironment(): Record<string, string> {
  return {
    APP_PROFILE: "release",
    NEXT_PUBLIC_APP_PROFILE: "release",
    NEXT_PUBLIC_SITE_URL: "https://sing.example.kr",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: `sb_secret_${"s".repeat(32)}`,
    SHARE_SLUG_HMAC_KEY_V1: "A".repeat(43),
    SHARE_SLUG_ACTIVE_KEY_VERSION: "1",
    RATE_LIMIT_IP_HMAC_KEY_V1: "B".repeat(43),
    TURNSTILE_SECRET_KEY: "turnstile-private-live-value",
    TURNSTILE_ALLOWED_HOSTNAMES: "sing.example.kr",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-public-live-value",
    CATALOG_RIGHTS_MANIFEST_PATH: "rights-approved.json",
    CATALOG_RIGHTS_MANIFEST_SHA256: "a".repeat(64),
    CATALOG_PROVIDER_URL: "https://catalog.vendor.kr/api/search",
    CATALOG_PROVIDER_API_KEY: "catalog-private-live-value",
  };
}

describe("runtime release environment", () => {
  it("accepts a complete release runtime without filesystem or crypto imports", () => {
    expect(() => assertRuntimeReleaseEnvironment(validReleaseEnvironment())).not.toThrow();
  });

  it("rejects fixture and incomplete runtime profiles", () => {
    const fixture = validReleaseEnvironment();
    fixture.APP_PROFILE = "fixture";
    fixture.NEXT_PUBLIC_APP_PROFILE = "fixture";
    expect(() => assertRuntimeReleaseEnvironment(fixture)).toThrow("APP_PROFILE must be release");

    const missing = validReleaseEnvironment();
    delete missing.CATALOG_PROVIDER_API_KEY;
    expect(() => assertRuntimeReleaseEnvironment(missing)).toThrow(
      "missing release configuration: CATALOG_PROVIDER_API_KEY",
    );
  });

  it("rejects local endpoints and weak active share keys", () => {
    const local = validReleaseEnvironment();
    local.CATALOG_PROVIDER_URL = "http://127.0.0.1/catalog";
    expect(() => assertRuntimeReleaseEnvironment(local)).toThrow(
      "CATALOG_PROVIDER_URL must be a credential-free public HTTPS URL",
    );

    const weakKey = validReleaseEnvironment();
    weakKey.SHARE_SLUG_HMAC_KEY_V1 = "weak";
    expect(() => assertRuntimeReleaseEnvironment(weakKey)).toThrow(
      "Required share slug key version 1 is unavailable",
    );

    const weakRateKey = validReleaseEnvironment();
    weakRateKey.RATE_LIMIT_IP_HMAC_KEY_V1 = "weak";
    expect(() => assertRuntimeReleaseEnvironment(weakRateKey)).toThrow(
      "RATE_LIMIT_IP_HMAC_KEY_V1 must contain at least 32 random bytes",
    );
  });

  it("rejects a Turnstile hostname that drifts from the canonical origin", () => {
    const drift = validReleaseEnvironment();
    drift.TURNSTILE_ALLOWED_HOSTNAMES = "other.example.kr";
    expect(() => assertRuntimeReleaseEnvironment(drift)).toThrow(
      "TURNSTILE_ALLOWED_HOSTNAMES must include the canonical site hostname",
    );
  });
});
