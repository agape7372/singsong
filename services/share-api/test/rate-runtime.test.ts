import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AllowAllRateLimiter,
  MemoryRateLimiter,
  productionRateBucketHashes,
  ServerlessRateLimiter,
  trustedVercelClientIp,
} from "../src/rate-limit.js";
import {
  FixtureCatalogProvider,
  LicensedCatalogProvider,
  UnavailableCatalogProvider,
} from "../src/catalog.js";
import { createRuntime, runtimeProfile } from "../src/runtime-config.js";
import { LocalShareRepository } from "../src/share/local-repository.js";
import { SupabaseShareRepository } from "../src/share/supabase-repository.js";

const REDIS_URL = "https://redis.example.com";
const RATE_SECRET = Uint8Array.from(Buffer.alloc(32, 0x31));
const RATE_SECRET_TEXT = Buffer.from(RATE_SECRET).toString("base64url");
const SLUG_SECRET_TEXT = Buffer.alloc(32, 0x52).toString("base64url");
const ANDROID_FINGERPRINT = Array.from({ length: 32 }, (_, index) =>
  index.toString(16).padStart(2, "0").toUpperCase(),
).join(":");

function trustedRequest(ip = "198.51.100.42") {
  return new Request("https://share.example.com/api/search", {
    headers: {
      "X-Vercel-Forwarded-For": ip,
      "X-Vercel-Id": "icn1::iad1::request-id",
    },
  });
}

function redisResponse(
  count: unknown,
  ttl?: unknown,
  expireResult: unknown = 1,
  init: ResponseInit = {},
) {
  const effectiveTtl = arguments.length >= 2 ? ttl : 60;
  const responseInit: ResponseInit = {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  };
  if (init.status !== undefined) responseInit.status = init.status;
  return new Response(
    JSON.stringify([{ result: count }, { result: expireResult }, { result: effectiveTtl }]),
    responseInit,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

function limiter() {
  return new ServerlessRateLimiter({
    redisUrl: new URL(REDIS_URL),
    redisToken: "redis-token-at-least-16-characters",
    ipHmacKey: RATE_SECRET,
  });
}

function productionEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    APP_PROFILE: "production",
    SITE_ORIGIN: "https://share.example.com",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_server_only_key",
    SHARE_SLUG_ACTIVE_KEY_VERSION: "1",
    SHARE_SLUG_HMAC_KEY_V1: SLUG_SECRET_TEXT,
    RATE_LIMIT_REDIS_URL: REDIS_URL,
    RATE_LIMIT_REDIS_TOKEN: "redis-token-at-least-16-characters",
    RATE_LIMIT_IP_HMAC_KEY_V1: RATE_SECRET_TEXT,
    ANDROID_APP_SHA256_CERT_FINGERPRINTS: ANDROID_FINGERPRINT,
    IOS_APP_ID: "ABCDEFGHIJ.com.singsong.app",
    ...overrides,
  };
}

describe("trusted Vercel request identity", () => {
  it.each([
    ["IPv4", "198.51.100.42"],
    ["IPv6", "2001:db8:85a3::8a2e:370:7334"],
  ])("accepts one canonical %s address", (_label, ip) => {
    expect(trustedVercelClientIp(trustedRequest(ip))).toBe(ip);
  });

  it("ignores the caller-controlled x-forwarded-for value", () => {
    const request = new Request("https://share.example.com/api/search", {
      headers: {
        "X-Forwarded-For": "203.0.113.99",
        "X-Vercel-Forwarded-For": "198.51.100.42",
        "X-Vercel-Id": "icn1::request-id",
      },
    });
    expect(trustedVercelClientIp(request)).toBe("198.51.100.42");
  });

  it.each([
    ["a missing Vercel request marker", { "X-Vercel-Forwarded-For": "198.51.100.42" }],
    [
      "an empty Vercel request marker",
      { "X-Vercel-Id": "", "X-Vercel-Forwarded-For": "198.51.100.42" },
    ],
  ])("rejects %s", (_label, headers) => {
    expect(() =>
      trustedVercelClientIp(new Request("https://share.example.com", { headers })),
    ).toThrow("Trusted Vercel request identity is unavailable");
  });

  it.each([
    ["a missing address", undefined],
    ["an empty address", ""],
    ["a comma-delimited chain", "198.51.100.42, 203.0.113.9"],
    ["a hostname", "client.example.com"],
    ["an IPv4 address with a port", "198.51.100.42:443"],
    ["an IPv6 zone identifier", "fe80::1%eth0"],
  ])("rejects %s", (_label, ip) => {
    const headers = new Headers({ "X-Vercel-Id": "icn1::request-id" });
    if (ip !== undefined) headers.set("X-Vercel-Forwarded-For", ip);
    expect(() =>
      trustedVercelClientIp(new Request("https://share.example.com", { headers })),
    ).toThrow("Trusted Vercel client IP is unavailable");
  });
});

describe("production rate bucket hashes", () => {
  it("is deterministic, opaque, and domain-separated", () => {
    const now = 1_700_000_000_000;
    const first = productionRateBucketHashes(trustedRequest(), "create", RATE_SECRET, now);
    const second = productionRateBucketHashes(trustedRequest(), "create", RATE_SECRET, now);
    expect(second).toEqual(first);
    expect(first.hour).toMatch(/^\\x[a-f0-9]{64}$/u);
    expect(first.day).toMatch(/^\\x[a-f0-9]{64}$/u);
    expect(first.hour).not.toBe(first.day);
    expect(first.hour).not.toContain("198.51.100.42");

    expect(productionRateBucketHashes(trustedRequest(), "revoke", RATE_SECRET, now)).not.toEqual(
      first,
    );
    expect(
      productionRateBucketHashes(trustedRequest("198.51.100.43"), "create", RATE_SECRET, now),
    ).not.toEqual(first);
    expect(
      productionRateBucketHashes(
        trustedRequest(),
        "create",
        Uint8Array.from(Buffer.alloc(32, 0x32)),
        now,
      ),
    ).not.toEqual(first);
  });

  it("rotates the hour and day hashes only at their fixed UTC boundaries", () => {
    const dayStartMs = 20_000 * 86_400 * 1_000;
    const atStart = productionRateBucketHashes(trustedRequest(), "create", RATE_SECRET, dayStartMs);
    const beforeHourEnd = productionRateBucketHashes(
      trustedRequest(),
      "create",
      RATE_SECRET,
      dayStartMs + 3_600_000 - 1,
    );
    const nextHour = productionRateBucketHashes(
      trustedRequest(),
      "create",
      RATE_SECRET,
      dayStartMs + 3_600_000,
    );
    const nextDay = productionRateBucketHashes(
      trustedRequest(),
      "create",
      RATE_SECRET,
      dayStartMs + 86_400_000,
    );

    expect(beforeHourEnd).toEqual(atStart);
    expect(nextHour.hour).not.toBe(atStart.hour);
    expect(nextHour.day).toBe(atStart.day);
    expect(nextDay.hour).not.toBe(nextHour.hour);
    expect(nextDay.day).not.toBe(atStart.day);
  });
});

describe("in-memory rate limiting", () => {
  it("isolates identity and scope and resets at the window boundary", async () => {
    let now = 10_000;
    const rateLimiter = new MemoryRateLimiter(
      () => now,
      (request) => request.headers.get("x-test-identity") ?? "anonymous",
    );
    const alpha = new Request("https://share.example.com", {
      headers: { "X-Test-Identity": "alpha" },
    });
    const beta = new Request("https://share.example.com", {
      headers: { "X-Test-Identity": "beta" },
    });

    await expect(rateLimiter.take(alpha, "search", 2, 10)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    await expect(rateLimiter.take(alpha, "search", 2, 10)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 10,
    });
    await expect(rateLimiter.take(alpha, "search", 2, 10)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 10,
    });
    await expect(rateLimiter.take(beta, "search", 2, 10)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(rateLimiter.take(alpha, "create", 2, 10)).resolves.toMatchObject({
      allowed: true,
    });

    now += 10_000;
    await expect(rateLimiter.take(alpha, "search", 2, 10)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("uses only the first forwarded address in its local default identity", async () => {
    const rateLimiter = new MemoryRateLimiter(() => 0);
    const request = new Request("http://127.0.0.1", {
      headers: { "X-Forwarded-For": "198.51.100.2, 203.0.113.8" },
    });
    await expect(rateLimiter.take(request, "search", 1, 60)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(rateLimiter.take(request, "search", 1, 60)).resolves.toMatchObject({
      allowed: false,
    });
    await expect(new AllowAllRateLimiter().take()).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });
});

describe("serverless Upstash rate limiting", () => {
  it("submits the atomic pipeline and allows a count within the limit", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(redisResponse(2, 57));

    await expect(limiter().take(trustedRequest(), "search", 3, 60)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(input)).toBe("https://redis.example.com/pipeline");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
    });
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer redis-token-at-least-16-characters",
    );
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json; charset=utf-8");
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    const pipeline = JSON.parse(String(init?.body)) as [
      [string, string],
      [string, string, number, string],
      [string, string],
    ];
    expect(pipeline[0][0]).toBe("INCR");
    expect(pipeline[1]).toEqual(["EXPIRE", pipeline[0][1], 60, "NX"]);
    expect(pipeline[2]).toEqual(["TTL", pipeline[0][1]]);
    expect(pipeline[0][1]).toMatch(/^singsong:rate:search:60:\d+:[a-f0-9]{32}$/u);
    expect(pipeline[0][1]).not.toContain("198.51.100.42");
  });

  it("denies over-limit traffic with the Redis TTL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(redisResponse(4, 41));
    await expect(limiter().take(trustedRequest(), "create", 3, 60)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 41,
    });
  });

  it.each([undefined, null, -1, 0, 1.5, "not-a-number"])(
    "falls back to the configured window for an unusable denial TTL (%s)",
    async (ttl) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(redisResponse(4, ttl));
      await expect(limiter().take(trustedRequest(), "create", 3, 90)).resolves.toEqual({
        allowed: false,
        retryAfterSeconds: 90,
      });
    },
  );

  it.each([
    ["an HTTP failure", new Response("unavailable", { status: 503 })],
    ["a non-JSON response", new Response("[]", { headers: { "Content-Type": "text/plain" } })],
    [
      "an invalid declared size",
      new Response("[]", {
        headers: { "Content-Type": "application/json", "Content-Length": "NaN" },
      }),
    ],
    [
      "a negative declared size",
      new Response("[]", {
        headers: { "Content-Type": "application/json", "Content-Length": "-1" },
      }),
    ],
    [
      "an oversized declared body",
      new Response("[]", {
        headers: { "Content-Type": "application/json", "Content-Length": "8193" },
      }),
    ],
    ["a missing body", new Response(null, { headers: { "Content-Type": "application/json" } })],
  ])("fails closed for %s", async (_label, response) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    await expect(limiter().take(trustedRequest(), "search", 3, 60)).rejects.toThrow(
      "Distributed rate limit is unavailable",
    );
  });

  it("fails closed when an undeclared response stream exceeds 8 KiB", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("x".repeat(8 * 1024 + 1), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(limiter().take(trustedRequest(), "search", 3, 60)).rejects.toThrow(
      "Distributed rate limit is unavailable",
    );
  });

  it("fails closed for invalid UTF-8 and invalid JSON", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0xc3, 0x28]), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("{", { headers: { "Content-Type": "application/json" } }),
      );
    await expect(limiter().take(trustedRequest(), "search", 3, 60)).rejects.toThrow(
      "Distributed rate limit is unavailable",
    );
    await expect(limiter().take(trustedRequest(), "search", 3, 60)).rejects.toThrow(
      "Distributed rate limit is unavailable",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a non-array payload", { result: 1 }],
    ["the wrong pipeline result count", [{ result: 1 }]],
    ["a null pipeline entry", [{ result: 1 }, null, { result: 60 }]],
    ["an array pipeline entry", [{ result: 1 }, [], { result: 60 }]],
    ["a Redis command error", [{ result: 1 }, { error: "ERR" }, { result: 60 }]],
  ])("fails closed for %s", async (_label, payload) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(limiter().take(trustedRequest(), "search", 3, 60)).rejects.toThrow(
      "Distributed rate limit is unavailable",
    );
  });

  it.each([undefined, null, 0, -1, 1.25, "not-a-count"])(
    "fails closed for an invalid counter result (%s)",
    async (count) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(redisResponse(count));
      await expect(limiter().take(trustedRequest(), "search", 3, 60)).rejects.toThrow(
        "Distributed rate limit is unavailable",
      );
    },
  );

  it("normalizes network failures without leaking their details", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("getaddrinfo ENOTFOUND secret.internal"),
    );
    await expect(limiter().take(trustedRequest(), "search", 3, 60)).rejects.toThrow(
      "Distributed rate limit is unavailable",
    );
    await expect(limiter().take(trustedRequest(), "search", 3, 60)).rejects.not.toThrow(
      "secret.internal",
    );
  });

  it("uses a three-second deadline and normalizes a timeout", async () => {
    const timeoutReason = new DOMException("The operation timed out", "TimeoutError");
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(AbortSignal.abort(timeoutReason));
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (init?.signal?.aborted) throw init.signal.reason;
      return redisResponse(1);
    });

    await expect(limiter().take(trustedRequest(), "search", 3, 60)).rejects.toThrow(
      "Distributed rate limit is unavailable",
    );
    expect(timeoutSpy).toHaveBeenCalledWith(3_000);
  });
});

describe("runtime profile and fixture configuration", () => {
  it.each([
    ["fixture", "fixture"],
    ["release", "production"],
    ["production", "production"],
  ] as const)("maps APP_PROFILE=%s to %s", (value, expected) => {
    expect(runtimeProfile({ APP_PROFILE: value })).toBe(expected);
  });

  it.each([undefined, "", "development", "prod"])("rejects unsupported APP_PROFILE=%s", (value) => {
    expect(() => runtimeProfile({ APP_PROFILE: value })).toThrow(
      "APP_PROFILE must be fixture, release, or production",
    );
  });

  it("builds a dependency-complete fixture runtime with safe defaults", async () => {
    const runtime = createRuntime({ APP_PROFILE: "fixture" });
    expect(runtime.profile).toBe("fixture");
    expect(runtime.siteOrigin.href).toBe("http://127.0.0.1:8787/");
    expect(runtime.repository).toBeInstanceOf(LocalShareRepository);
    expect(runtime.catalog).toBeInstanceOf(FixtureCatalogProvider);
    expect(runtime.rateLimiter).toBeInstanceOf(AllowAllRateLimiter);
    expect(runtime.rateBucketSecret).toBeUndefined();
    expect(JSON.parse(runtime.associations.assetLinksJson)).toEqual([]);
    expect(JSON.parse(runtime.associations.appleAppSiteAssociationJson)).toEqual({
      applinks: { apps: [], details: [] },
    });
    await expect(runtime.catalog.search("91001")).resolves.toBeInstanceOf(Array);
  });

  it("uses the legacy public URL fallback when SITE_ORIGIN is absent", () => {
    const runtime = createRuntime({
      APP_PROFILE: "fixture",
      NEXT_PUBLIC_SITE_URL: "https://preview.example.test",
    });
    expect(runtime.siteOrigin.href).toBe("https://preview.example.test/");
  });

  it("serializes configured Android and Apple association documents", () => {
    const secondFingerprint = ANDROID_FINGERPRINT.replace(/^00/u, "FF");
    const runtime = createRuntime({
      APP_PROFILE: "fixture",
      ANDROID_APP_SHA256_CERT_FINGERPRINTS: ` ${ANDROID_FINGERPRINT.toLowerCase()}, ${secondFingerprint} `,
      IOS_APP_ID: "ABCDEFGHIJ.com.singsong.app",
    });
    expect(JSON.parse(runtime.associations.assetLinksJson)).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.singsong.app",
          sha256_cert_fingerprints: [ANDROID_FINGERPRINT, secondFingerprint],
        },
      },
    ]);
    expect(JSON.parse(runtime.associations.appleAppSiteAssociationJson)).toEqual({
      applinks: {
        apps: [],
        details: [
          {
            appID: "ABCDEFGHIJ.com.singsong.app",
            components: [{ "/": "/s/*", comment: "SingSong shared tickets" }],
          },
        ],
      },
    });
  });

  it.each([
    ["credentials", "https://user:password@share.example.test/"],
    ["a path", "https://share.example.test/path"],
    ["a query", "https://share.example.test/?preview=1"],
    ["a fragment", "https://share.example.test/#preview"],
    ["an unsupported protocol", "ftp://share.example.test/"],
    ["invalid URL syntax", "not a URL"],
  ])("rejects a fixture origin containing %s", (_label, origin) => {
    expect(() => createRuntime({ APP_PROFILE: "fixture", SITE_ORIGIN: origin })).toThrow(
      "SITE_ORIGIN is unavailable",
    );
  });
});

describe("production runtime configuration", () => {
  it.each(["production", "release"])(
    "assembles the complete server-only runtime for APP_PROFILE=%s",
    (profile) => {
      const environment = productionEnvironment({
        APP_PROFILE: profile,
        CATALOG_PROVIDER_URL: "https://catalog.vendor.example/v1/search",
        CATALOG_PROVIDER_API_KEY: "licensed-api-key-at-least-16",
      });
      const runtime = createRuntime(environment);

      expect(runtime.profile).toBe("production");
      expect(runtime.siteOrigin.href).toBe("https://share.example.com/");
      expect(runtime.repository).toBeInstanceOf(SupabaseShareRepository);
      expect(runtime.catalog).toBeInstanceOf(LicensedCatalogProvider);
      expect(runtime.rateLimiter).toBeInstanceOf(ServerlessRateLimiter);
      expect(runtime.rateBucketSecret).toEqual(RATE_SECRET);

      const repository = runtime.repository as SupabaseShareRepository;
      expect(repository.config.url.href).toBe("https://project.supabase.co/");
      expect(repository.config.activeSlugKeyVersion).toBe(1);
      expect(repository.config.slugKeys.get(1)).toEqual(
        Uint8Array.from(Buffer.from(SLUG_SECRET_TEXT, "base64url")),
      );

      const rateLimiter = runtime.rateLimiter as ServerlessRateLimiter;
      expect(rateLimiter.config.redisUrl.href).toBe("https://redis.example.com/");
      expect(rateLimiter.config.redisToken).toBe("redis-token-at-least-16-characters");
      expect(rateLimiter.config.ipHmacKey).toEqual(RATE_SECRET);

      expect(JSON.parse(runtime.associations.assetLinksJson)).toEqual([
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: "com.singsong.app",
            sha256_cert_fingerprints: [ANDROID_FINGERPRINT],
          },
        },
      ]);
      expect(JSON.parse(runtime.associations.appleAppSiteAssociationJson)).toEqual({
        applinks: {
          apps: [],
          details: [
            {
              appID: "ABCDEFGHIJ.com.singsong.app",
              components: [{ "/": "/s/*", comment: "SingSong shared tickets" }],
            },
          ],
        },
      });
    },
  );

  it("uses NEXT_PUBLIC_SITE_URL only when the canonical origin is absent", () => {
    const runtime = createRuntime(
      productionEnvironment({
        SITE_ORIGIN: undefined,
        NEXT_PUBLIC_SITE_URL: "https://legacy-share.example.com",
      }),
    );
    expect(runtime.siteOrigin.href).toBe("https://legacy-share.example.com/");
  });

  it.each([
    ["a missing origin", undefined],
    ["HTTP", "http://share.example.com/"],
    ["credentials", "https://user:password@share.example.com/"],
    ["a path", "https://share.example.com/share"],
    ["a query", "https://share.example.com/?x=1"],
    ["a fragment", "https://share.example.com/#x"],
    ["invalid URL syntax", "not a URL"],
  ])("rejects a production site origin with %s", (_label, origin) => {
    expect(() =>
      createRuntime(
        productionEnvironment({
          SITE_ORIGIN: origin,
          NEXT_PUBLIC_SITE_URL: undefined,
        }),
      ),
    ).toThrow("SITE_ORIGIN is unavailable");
  });

  it.each([
    ["a missing HMAC key", { RATE_LIMIT_IP_HMAC_KEY_V1: undefined }, "RATE_LIMIT_IP_HMAC_KEY_V1"],
    [
      "an invalid HMAC key",
      { RATE_LIMIT_IP_HMAC_KEY_V1: "not-base64url!" },
      "RATE_LIMIT_IP_HMAC_KEY_V1",
    ],
    ["a short Redis token", { RATE_LIMIT_REDIS_TOKEN: "short" }, "RATE_LIMIT_REDIS_TOKEN"],
    ["an invalid Redis URL", { RATE_LIMIT_REDIS_URL: "not a URL" }, "RATE_LIMIT_REDIS_URL"],
    [
      "an HTTP Redis URL",
      { RATE_LIMIT_REDIS_URL: "http://redis.example.com" },
      "RATE_LIMIT_REDIS_URL",
    ],
    [
      "a credentialed Redis URL",
      { RATE_LIMIT_REDIS_URL: "https://user:pass@redis.example.com" },
      "RATE_LIMIT_REDIS_URL",
    ],
    ["a local Redis URL", { RATE_LIMIT_REDIS_URL: "https://localhost" }, "RATE_LIMIT_REDIS_URL"],
  ] as const)("rejects %s", (_label, overrides, message) => {
    expect(() => createRuntime(productionEnvironment(overrides))).toThrow(message);
  });

  it.each([
    [
      "a legacy Supabase service key",
      { SUPABASE_SECRET_KEY: "eyJlegacy" },
      "current server-only Supabase secret key",
    ],
    [
      "a missing slug key version",
      { SHARE_SLUG_ACTIVE_KEY_VERSION: undefined },
      "SHARE_SLUG_ACTIVE_KEY_VERSION is invalid",
    ],
    [
      "slug key version zero",
      { SHARE_SLUG_ACTIVE_KEY_VERSION: "0" },
      "SHARE_SLUG_ACTIVE_KEY_VERSION is invalid",
    ],
    [
      "a fractional slug key version",
      { SHARE_SLUG_ACTIVE_KEY_VERSION: "1.5" },
      "SHARE_SLUG_ACTIVE_KEY_VERSION is invalid",
    ],
    [
      "an oversized slug key version",
      { SHARE_SLUG_ACTIVE_KEY_VERSION: "32768" },
      "SHARE_SLUG_ACTIVE_KEY_VERSION is invalid",
    ],
    [
      "a missing active slug key",
      { SHARE_SLUG_ACTIVE_KEY_VERSION: "2" },
      "SHARE_SLUG_HMAC_KEY_V2 is unavailable",
    ],
    [
      "an invalid active slug key",
      { SHARE_SLUG_HMAC_KEY_V1: "bad!" },
      "SHARE_SLUG_HMAC_KEY_V1 is unavailable",
    ],
    ["an invalid Supabase URL", { SUPABASE_URL: "not a URL" }, "SUPABASE_URL is unavailable"],
    [
      "an HTTP Supabase URL",
      { SUPABASE_URL: "http://project.supabase.co" },
      "SUPABASE_URL is unavailable",
    ],
    ["a local Supabase URL", { SUPABASE_URL: "https://localhost" }, "SUPABASE_URL is unavailable"],
  ] as const)("rejects %s", (_label, overrides, message) => {
    expect(() => createRuntime(productionEnvironment(overrides))).toThrow(message);
  });

  it.each([
    [
      "missing Android fingerprints",
      { ANDROID_APP_SHA256_CERT_FINGERPRINTS: undefined },
      "Android app association is unavailable",
    ],
    [
      "a malformed Android fingerprint",
      { ANDROID_APP_SHA256_CERT_FINGERPRINTS: "AA:BB" },
      "Android app association is unavailable",
    ],
    ["a missing Apple app ID", { IOS_APP_ID: undefined }, "Apple app association is unavailable"],
    [
      "a lowercase Apple team ID",
      { IOS_APP_ID: "abcdefghij.com.singsong.app" },
      "Apple app association is unavailable",
    ],
    [
      "a different Apple bundle ID",
      { IOS_APP_ID: "ABCDEFGHIJ.com.example.app" },
      "Apple app association is unavailable",
    ],
  ] as const)("rejects %s", (_label, overrides, message) => {
    expect(() => createRuntime(productionEnvironment(overrides))).toThrow(message);
  });

  it("uses an unavailable catalog when optional licensed credentials are absent or invalid", () => {
    expect(createRuntime(productionEnvironment()).catalog).toBeInstanceOf(
      UnavailableCatalogProvider,
    );
    expect(
      createRuntime(
        productionEnvironment({
          CATALOG_PROVIDER_API_KEY: "short",
          CATALOG_PROVIDER_URL: "https://catalog.vendor.example",
        }),
      ).catalog,
    ).toBeInstanceOf(UnavailableCatalogProvider);
    expect(
      createRuntime(
        productionEnvironment({
          CATALOG_PROVIDER_API_KEY: "licensed-api-key-at-least-16",
          CATALOG_PROVIDER_URL: "http://catalog.vendor.example",
        }),
      ).catalog,
    ).toBeInstanceOf(UnavailableCatalogProvider);
  });
});
