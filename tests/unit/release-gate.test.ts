import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ReleaseGateError,
  assertReleaseEnvironment,
  collectReleaseBlockers,
} from "../../scripts/release-gate.mjs";

const temporaryDirectories: string[] = [];

function approvedManifest() {
  return {
    manifestId: "rights-2026-001",
    manifestVersion: "1",
    sourceId: "licensed-provider-one",
    providerLegalName: "Licensed Provider Co Ltd",
    integrationChannel: "documented-api-v1",
    evidenceRef: "legal-system-record-2026-001",
    credentialRef: "secret-manager-catalog-provider-production",
    takedownRouteRef: "ops-catalog-takedown-primary",
    status: "approved",
    effectiveAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    environments: ["release"],
    territories: ["KR"],
    fieldScope: ["title", "artist", "karaokeCodes"],
    approvalRefs: ["product-ops-approval-2026-001", "legal-rights-approval-2026-001"],
    capabilities: {
      automatedFetch: true,
      cache: true,
      rawRetention: false,
      normalize: true,
      display: true,
      search: true,
      export: true,
      redistribute: true,
    },
  };
}

function releaseEnvironment(manifest = approvedManifest()): NodeJS.ProcessEnv {
  const directory = mkdtempSync(join(tmpdir(), "singsong-rights-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "rights.json");
  const bytes = Buffer.from(JSON.stringify(manifest), "utf8");
  writeFileSync(path, bytes);
  const randomKey = Buffer.alloc(32, 7).toString("base64url");
  return {
    APP_PROFILE: "release",
    NEXT_PUBLIC_APP_PROFILE: "release",
    NODE_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://singsong.co.kr",
    SUPABASE_URL: "https://project-ref.supabase.co",
    SUPABASE_SECRET_KEY: `sb_secret_${"s".repeat(32)}`,
    SHARE_SLUG_HMAC_KEY_V1: randomKey,
    SHARE_SLUG_ACTIVE_KEY_VERSION: "1",
    RATE_LIMIT_IP_HMAC_KEY_V1: randomKey,
    TURNSTILE_SECRET_KEY: `0x4AAAA${"s".repeat(28)}`,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: `0x4AAAA${"p".repeat(28)}`,
    TURNSTILE_ALLOWED_HOSTNAMES: "singsong.co.kr",
    CATALOG_RIGHTS_MANIFEST_PATH: path,
    CATALOG_RIGHTS_MANIFEST_SHA256: createHash("sha256").update(bytes).digest("hex"),
    CATALOG_PROVIDER_URL: "https://catalog.vendor.co.kr/v1/search",
    CATALOG_PROVIDER_API_KEY: `catalog_live_${"k".repeat(32)}`,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("release profile preflight", () => {
  it("returns a deterministic BLOCK_EXTERNAL result when external evidence is absent", () => {
    const environment = {
      APP_PROFILE: "release",
      NEXT_PUBLIC_APP_PROFILE: "release",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv;

    expect(() => assertReleaseEnvironment(environment)).toThrow(ReleaseGateError);
    expect(() => assertReleaseEnvironment(environment)).toThrow("BLOCK_EXTERNAL");
    expect(collectReleaseBlockers(environment)).toContainEqual(
      expect.stringContaining("missing release configuration"),
    );
  });

  it("accepts an exact approved, current manifest and current production controls", () => {
    expect(() =>
      assertReleaseEnvironment(releaseEnvironment(), {
        now: new Date("2026-07-22T00:00:00.000Z"),
      }),
    ).not.toThrow();
  });

  it("rejects altered evidence, test keys, fixture flags, and unapproved capabilities", () => {
    const environment = releaseEnvironment({
      ...approvedManifest(),
      capabilities: { ...approvedManifest().capabilities, redistribute: false },
    });
    environment.CATALOG_RIGHTS_MANIFEST_SHA256 = "0".repeat(64);
    environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    environment.CATALOG_USE_FIXTURE = "true";

    const blockers = collectReleaseBlockers(environment, {
      now: new Date("2026-07-22T00:00:00.000Z"),
    });
    expect(blockers).toEqual(
      expect.arrayContaining([
        "CATALOG_USE_FIXTURE bypass is forbidden",
        "Cloudflare Turnstile test keys are forbidden",
        "catalog rights manifest SHA-256 does not match",
      ]),
    );
  });

  it("rejects a correctly hashed manifest whose rights are insufficient", () => {
    const environment = releaseEnvironment({
      ...approvedManifest(),
      capabilities: { ...approvedManifest().capabilities, redistribute: false },
    });

    expect(
      collectReleaseBlockers(environment, { now: new Date("2026-07-22T00:00:00.000Z") }),
    ).toContain("catalog rights capability redistribute is not approved");
  });
});
