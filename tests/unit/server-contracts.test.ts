import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FixtureCatalogProvider } from "@/features/catalog/fixture";
import { getCatalogProvider } from "@/features/catalog/provider.server";
import { LocalShareRepository } from "@/features/share/local-repository.server";
import { getShareRepository } from "@/features/share/repository.server";
import { SupabaseShareRepository } from "@/features/share/supabase-repository.server";
import { ShareRepositoryError } from "@/features/share/types";
import {
  HttpProblem,
  assertTrustedJsonMutation,
  jsonResponse,
  problemResponse,
  readJsonBody,
} from "@/server/http";
import { productionRateBucketHashes, takeRateLimit } from "@/server/rate-limit";
import { assertProductionEnvironment, getRuntimeProfile } from "@/server/runtime-profile";

const productionKeys = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SHARE_SLUG_HMAC_KEY_V1",
  "SHARE_SLUG_ACTIVE_KEY_VERSION",
  "RATE_LIMIT_IP_HMAC_KEY_V1",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_ALLOWED_HOSTNAMES",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_SITE_URL",
] as const;

function mutationRequest(headers: Record<string, string> = {}) {
  return new Request("https://app.example.test/api/action", {
    method: "POST",
    headers,
    body: "{}",
  });
}

function streamRequest(chunks: readonly Uint8Array[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request("https://app.example.test/api/action", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

beforeEach(() => {
  vi.stubEnv("APP_PROFILE", "fixture");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.test");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("explicit runtime profile and provider selection", () => {
  it("rejects an absent or unknown profile and accepts both explicit profiles", () => {
    vi.stubEnv("APP_PROFILE", "");
    expect(() => getRuntimeProfile()).toThrow("APP_PROFILE is not explicit");
    vi.stubEnv("APP_PROFILE", "preview");
    expect(() => getRuntimeProfile()).toThrow("APP_PROFILE is not explicit");
    vi.stubEnv("APP_PROFILE", "fixture");
    expect(getRuntimeProfile()).toBe("fixture");
    vi.stubEnv("APP_PROFILE", "release");
    expect(getRuntimeProfile()).toBe("production");
    vi.stubEnv("APP_PROFILE", "production");
    expect(getRuntimeProfile()).toBe("production");
  });

  it("does not require external credentials for fixtures but enumerates missing production keys", () => {
    expect(() => assertProductionEnvironment()).not.toThrow();

    vi.stubEnv("APP_PROFILE", "production");
    for (const key of productionKeys) vi.stubEnv(key, "");
    expect(() => assertProductionEnvironment()).toThrow(
      `Missing production configuration: ${productionKeys.join(", ")}`,
    );
  });

  it("keeps production blocked when only the legacy security variables are present", () => {
    vi.stubEnv("APP_PROFILE", "production");
    for (const key of productionKeys) vi.stubEnv(key, `${key}-configured`);
    expect(() => assertProductionEnvironment()).toThrow("CATALOG_RIGHTS_MANIFEST_PATH");
  });

  it("selects deterministic fixture services and fails closed for an unlicensed catalog", async () => {
    const fixtureCatalog = getCatalogProvider();
    expect(fixtureCatalog).toBeInstanceOf(FixtureCatalogProvider);
    await expect(fixtureCatalog.search("밤의 체크인", 1)).resolves.toMatchObject([
      { id: "fx-001", source: "fixture" },
    ]);

    const fixtureShares = getShareRepository();
    expect(fixtureShares).toBeInstanceOf(LocalShareRepository);
    expect(getShareRepository()).toBe(fixtureShares);

    vi.stubEnv("APP_PROFILE", "production");
    expect(() => getCatalogProvider()).toThrow("Missing production configuration");
    const productionShares = getShareRepository();
    expect(productionShares).toBeInstanceOf(SupabaseShareRepository);
    expect(getShareRepository()).toBe(productionShares);
  });

  it("exposes stable typed repository errors without leaking request data", () => {
    const error = new ShareRepositoryError("CONFLICT");
    expect(error).toMatchObject({
      name: "ShareRepositoryError",
      code: "CONFLICT",
      message: "Share repository error: CONFLICT",
    });
  });
});

describe("HTTP mutation and UTF-8 boundary contract", () => {
  it("accepts JSON charset, identity encoding and same-origin browser metadata", () => {
    expect(() =>
      assertTrustedJsonMutation(
        mutationRequest({
          "Content-Type": "Application/JSON; Charset=UTF-8",
          "Content-Encoding": "identity",
          Origin: "https://app.example.test",
          "Sec-Fetch-Site": "same-origin",
        }),
      ),
    ).not.toThrow();
  });

  it.each([
    ["wrong media type", { "Content-Type": "text/plain" }, "UNSUPPORTED_MEDIA_TYPE", 415],
    [
      "compressed body",
      { "Content-Type": "application/json", "Content-Encoding": "br" },
      "UNSUPPORTED_ENCODING",
      415,
    ],
    [
      "foreign origin",
      { "Content-Type": "application/json", Origin: "https://evil.example" },
      "UNTRUSTED_ORIGIN",
      403,
    ],
    [
      "cross-site fetch",
      { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
      "UNTRUSTED_ORIGIN",
      403,
    ],
  ])("rejects %s", (_label, headers, code, status) => {
    try {
      assertTrustedJsonMutation(mutationRequest(headers));
      throw new Error("expected request rejection");
    } catch (error) {
      expect(error).toMatchObject({ code, status });
    }
  });

  it("allows an origin-less fixture request but requires Origin in production", () => {
    expect(() =>
      assertTrustedJsonMutation(mutationRequest({ "Content-Type": "application/json" })),
    ).not.toThrow();

    vi.stubEnv("APP_PROFILE", "production");
    expect(() =>
      assertTrustedJsonMutation(mutationRequest({ "Content-Type": "application/json" })),
    ).toThrow(expect.objectContaining({ code: "UNTRUSTED_ORIGIN", status: 403 }));
  });

  it("falls back to the request URL origin when no canonical site URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    expect(() =>
      assertTrustedJsonMutation(
        mutationRequest({
          "Content-Type": "application/json",
          Origin: "https://app.example.test",
        }),
      ),
    ).not.toThrow();
  });

  it.each(["NaN", "-1", "1.5"])("rejects invalid Content-Length %s", async (length) => {
    const request = mutationRequest({
      "Content-Type": "application/json",
      "Content-Length": length,
    });
    await expect(readJsonBody(request, 100)).rejects.toMatchObject({
      code: "INVALID_CONTENT_LENGTH",
      status: 400,
    });
  });

  it("rejects an oversized declared body before reading", async () => {
    const request = mutationRequest({
      "Content-Type": "application/json",
      "Content-Length": "101",
    });
    await expect(readJsonBody(request, 100)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      status: 413,
    });
  });

  it("decodes a multibyte JSON value split across stream chunks", async () => {
    const bytes = new TextEncoder().encode('{"value":"한글"}');
    const splitInsideFirstKoreanCharacter = bytes.indexOf(0xed) + 1;
    const request = streamRequest([
      bytes.slice(0, splitInsideFirstKoreanCharacter),
      bytes.slice(splitInsideFirstKoreanCharacter),
    ]);

    await expect(readJsonBody(request, 100)).resolves.toEqual({ value: "한글" });
  });

  it.each([
    ["invalid continuation", new Uint8Array([0x7b, 0xc3, 0x28, 0x7d])],
    ["truncated final sequence", new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xc3])],
  ])("rejects %s as invalid UTF-8 JSON", async (_label, bytes) => {
    await expect(readJsonBody(streamRequest([bytes]), 100)).rejects.toMatchObject({
      code: "INVALID_JSON",
      status: 400,
    });
  });

  it("rejects an empty body as invalid JSON", async () => {
    await expect(
      readJsonBody(new Request("https://app.example.test/api/action"), 100),
    ).rejects.toMatchObject({ code: "INVALID_JSON", status: 400 });
  });

  it("sets invariant response headers and maps known and unknown problems", async () => {
    const privateResponse = jsonResponse(
      { ok: true },
      {
        status: 200,
        requestId: "request-1",
        cache: "private",
        headers: { "X-Test": "present" },
      },
    );
    expect(privateResponse.headers.get("cache-control")).toBe("private");
    expect(privateResponse.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(privateResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(privateResponse.headers.get("x-request-id")).toBe("request-1");
    expect(privateResponse.headers.get("x-test")).toBe("present");

    const known = problemResponse(new HttpProblem(409, "CONFLICT", "conflict"), "request-2");
    expect(known.status).toBe(409);
    await expect(known.json()).resolves.toMatchObject({
      error: { code: "CONFLICT", message: "conflict", requestId: "request-2" },
    });

    const unknown = problemResponse(new Error("private details"), "request-3");
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(await unknown.json())).not.toContain("private details");
    expect(unknown.headers.get("cache-control")).toBe("no-store");
  });
});

describe("rate limiting and privacy-preserving production buckets", () => {
  it("blocks within a window and resets after its deadline", async () => {
    let now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const request = new Request("https://app.example.test/api/search", {
      headers: { "X-Forwarded-For": "203.0.113.10, 10.0.0.1" },
    });
    const scope = `coverage-${crypto.randomUUID()}`;

    await expect(takeRateLimit(request, scope, 1, 2_000)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    await expect(takeRateLimit(request, scope, 1, 2_000)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 2,
    });

    now += 2_000;
    await expect(takeRateLimit(request, scope, 1, 2_000)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("uses a local anonymous bucket when no forwarded identity is present", async () => {
    const request = new Request("https://app.example.test/api/search");
    await expect(
      takeRateLimit(request, `local-${crypto.randomUUID()}`, 1, 1_000),
    ).resolves.toMatchObject({ allowed: true });
  });

  it("returns no database buckets for fixtures", () => {
    expect(
      productionRateBucketHashes(
        new Request("https://app.example.test/api/shares", {
          headers: { "X-Forwarded-For": "203.0.113.10" },
        }),
        "create",
      ),
    ).toBeUndefined();
  });

  it("requires a production HMAC key and a trusted proxy identity", () => {
    vi.stubEnv("APP_PROFILE", "production");
    vi.stubEnv("RATE_LIMIT_IP_HMAC_KEY_V1", "");
    expect(() =>
      productionRateBucketHashes(
        new Request("https://app.example.test/api/shares", {
          headers: { "X-Forwarded-For": "203.0.113.10" },
        }),
        "create",
      ),
    ).toThrow("RATE_LIMIT_IP_HMAC_KEY_V1 is required in production");

    vi.stubEnv("RATE_LIMIT_IP_HMAC_KEY_V1", "rate-secret");
    expect(() =>
      productionRateBucketHashes(new Request("https://app.example.test/api/shares"), "revoke"),
    ).toThrow("Trusted proxy identity is unavailable");
  });

  it("derives scoped, fixed-length, deterministic production bucket hashes", () => {
    vi.stubEnv("APP_PROFILE", "production");
    vi.stubEnv("RATE_LIMIT_IP_HMAC_KEY_V1", "rate-secret");
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const request = new Request("https://app.example.test/api/shares", {
      headers: { "X-Forwarded-For": "203.0.113.10, 10.0.0.1" },
    });

    const created = productionRateBucketHashes(request, "create");
    const repeated = productionRateBucketHashes(request, "create");
    const revoked = productionRateBucketHashes(request, "revoke");

    expect(created).toEqual(repeated);
    expect(created?.hour).toMatch(/^\\x[a-f0-9]{64}$/u);
    expect(created?.day).toMatch(/^\\x[a-f0-9]{64}$/u);
    expect(created?.hour).not.toBe(created?.day);
    expect(created).not.toEqual(revoked);
  });
});
