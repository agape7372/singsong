import { describe, expect, it } from "vitest";
import { createShareApi } from "../src/app.js";
import { AllowAllRateLimiter, trustedVercelClientIp } from "../src/rate-limit.js";
import { createRuntime } from "../src/runtime-config.js";
import { collectProductionBlockers } from "../src/preflight.js";
import { isApprovedOgPng } from "../src/og-asset.js";

describe("serverless request boundaries", () => {
  it("ignores spoofable x-forwarded-for and accepts only the Vercel copy", () => {
    const request = new Request("https://share.example.com/api/search", {
      headers: {
        "X-Forwarded-For": "203.0.113.99",
        "X-Vercel-Forwarded-For": "198.51.100.12",
        "X-Vercel-Id": "icn1::abc",
      },
    });
    expect(trustedVercelClientIp(request)).toBe("198.51.100.12");
    expect(() =>
      trustedVercelClientIp(
        new Request("https://share.example.com/api/search", {
          headers: {
            "X-Forwarded-For": "203.0.113.99",
            "X-Vercel-Forwarded-For": "198.51.100.12",
          },
        }),
      ),
    ).toThrow("Trusted Vercel request identity");
    expect(() =>
      trustedVercelClientIp(
        new Request("https://share.example.com/api/search", {
          headers: {
            "X-Vercel-Forwarded-For": "198.51.100.12, 203.0.113.99",
            "X-Vercel-Id": "icn1::abc",
          },
        }),
      ),
    ).toThrow("Trusted Vercel client IP");
  });

  it("fails a rate-limiter outage closed with a deterministic 503 envelope", async () => {
    const runtime = createRuntime({
      APP_PROFILE: "fixture",
      SITE_ORIGIN: "https://share.example.test",
    });
    runtime.rateLimiter = {
      async take() {
        throw new Error("secret provider detail");
      },
    };
    const app = createShareApi(runtime, {
      requestId: () => "request-rate",
      log: () => undefined,
    });
    const response = await app.fetch(
      new Request("https://share.example.test/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "밤의 체크인" }),
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "RATE_LIMIT_UNAVAILABLE",
        message: "요청 보호 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        requestId: "request-rate",
        retryAfterSec: 60,
      },
    });
  });

  it("logs only the fixed allowlist even when requests carry capabilities", async () => {
    const runtime = createRuntime({
      APP_PROFILE: "fixture",
      SITE_ORIGIN: "https://share.example.test",
    });
    runtime.rateLimiter = new AllowAllRateLimiter();
    const entries: unknown[] = [];
    const app = createShareApi(runtime, {
      requestId: () => "request-log",
      log: (entry) => entries.push(entry),
    });
    await app.fetch(
      new Request("https://share.example.test/api/shares/secret/revoke", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${"S".repeat(43)}`,
          "Content-Type": "application/json",
          "X-SingSong-Client": "fixture/0.1.0",
        },
        body: "{}",
      }),
    );
    expect(entries).toHaveLength(1);
    expect(Object.keys(entries[0] as object).sort()).toEqual([
      "durationMs",
      "event",
      "requestId",
      "route",
      "status",
    ]);
    expect(JSON.stringify(entries)).not.toContain("Bearer");
    expect(JSON.stringify(entries)).not.toContain("SSSS");
  });
});

describe("production preflight", () => {
  it("fails closed without credentials and reports names, never secret values", () => {
    const blockers = collectProductionBlockers(
      {
        APP_PROFILE: "production",
        SITE_ORIGIN: "https://share.example.com",
        SUPABASE_SECRET_KEY: "leaked-value",
        RATE_LIMIT_REDIS_TOKEN: "leaked-value",
      },
      "all",
      { cwd: process.cwd(), now: new Date("2026-07-28T00:00:00.000Z") },
    );
    expect(blockers).toEqual([...blockers].sort());
    expect(blockers.join("\n")).toContain("SUPABASE_SECRET_KEY");
    expect(blockers.join("\n")).toContain("RATE_LIMIT_REDIS_TOKEN");
    expect(blockers.join("\n")).toContain("CATALOG_PROVIDER_API_KEY");
    expect(blockers.join("\n")).toContain("ANDROID_APP_SHA256_CERT_FINGERPRINTS");
    expect(blockers.join("\n")).not.toContain("leaked-value");
  });

  it("keeps share and catalog credential gates independently addressable", () => {
    const share = collectProductionBlockers({ APP_PROFILE: "production" }, "share");
    const catalog = collectProductionBlockers({ APP_PROFILE: "production" }, "catalog");
    expect(share.join("\n")).toContain("SUPABASE_URL");
    expect(share.join("\n")).not.toContain("CATALOG_PROVIDER_URL");
    expect(catalog.join("\n")).toContain("CATALOG_PROVIDER_URL");
    expect(catalog.join("\n")).not.toContain("SUPABASE_URL");
  });

  it("accepts a licensed provider HTTPS endpoint with a path", () => {
    const blockers = collectProductionBlockers(
      {
        APP_PROFILE: "production",
        CATALOG_PROVIDER_URL: "https://catalog.vendor.co.kr/v1/search",
        CATALOG_PROVIDER_API_KEY: "0123456789abcdef0123456789abcdef",
      },
      "catalog",
    );
    expect(blockers.join("\n")).not.toContain("CATALOG_PROVIDER_URL");
  });
});

describe("approved OG asset contract", () => {
  it("requires a bounded 1200 by 630 PNG", () => {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
    bytes.set([0, 0, 4, 176, 0, 0, 2, 118], 16);
    expect(isApprovedOgPng(bytes)).toBe(true);
    bytes[23] = 117;
    expect(isApprovedOgPng(bytes)).toBe(false);
  });
});
