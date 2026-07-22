import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "X-Forwarded-For": crypto.randomUUID(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("APP_PROFILE", "fixture");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("API failure and recovery contracts", () => {
  it("returns a typed search validation problem", async () => {
    const { POST } = await import("@/app/api/search/route");
    const response = await POST(jsonRequest("http://localhost:3000/api/search", { query: "" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_SEARCH", requestId: expect.any(String) },
    });
  });

  it("fails closed with a generic 500 when production catalog rights are not configured", async () => {
    vi.stubEnv("APP_PROFILE", "production");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/search/route");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/search", { query: "밤의 체크인" }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(body)).not.toContain("licensed provider");
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('"status":500'));
  });

  it("returns 429 and Retry-After after the documented search burst limit", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const infoLog = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/search/route");
    const forwarded = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    let response: Response | undefined;

    for (let attempt = 0; attempt < 61; attempt += 1) {
      response = await POST(
        jsonRequest(
          "http://localhost:3000/api/search",
          { query: "밤의 체크인", limit: 1 },
          { "X-Forwarded-For": forwarded },
        ),
      );
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("60");
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
    expect(infoLog).toHaveBeenCalled();
  });

  it("rejects a cross-origin share mutation before processing its payload", async () => {
    const { POST } = await import("@/app/api/shares/route");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/shares", {}, { Origin: "https://attacker.example" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNTRUSTED_ORIGIN" },
    });
  });

  it("rejects an oversized Turnstile token at the share schema boundary", async () => {
    const { POST } = await import("@/app/api/shares/route");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/shares", {
        idempotencyKey: "AAAAAAAAAAAAAAAAAAAAAA",
        revokeToken: "B".repeat(43),
        payload: {},
        turnstileToken: "x".repeat(2_049),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_SHARE" },
    });
  });

  it("uses the same generic 404 for malformed and unavailable share capabilities", async () => {
    const { GET } = await import("@/app/api/shares/[slug]/route");
    const malformed = await GET(new Request("http://localhost:3000/api/shares/not-a-slug"), {
      params: Promise.resolve({ slug: "not-a-slug" }),
    });
    const missingSlug = `${"Z".repeat(21)}A`;
    const unavailable = await GET(new Request(`http://localhost:3000/api/shares/${missingSlug}`), {
      params: Promise.resolve({ slug: missingSlug }),
    });

    expect(malformed.status).toBe(404);
    expect(unavailable.status).toBe(404);
    await expect(malformed.json()).resolves.toMatchObject({
      error: { code: "SHARE_UNAVAILABLE" },
    });
    await expect(unavailable.json()).resolves.toMatchObject({
      error: { code: "SHARE_UNAVAILABLE" },
    });
  });

  it("rejects nonempty revoke bodies and hides malformed or unavailable capabilities", async () => {
    const { POST } = await import("@/app/api/shares/[slug]/revoke/route");
    const nonempty = await POST(
      jsonRequest("http://localhost:3000/api/shares/not-a-slug/revoke", { unexpected: true }),
      { params: Promise.resolve({ slug: "not-a-slug" }) },
    );
    expect(nonempty.status).toBe(400);
    await expect(nonempty.json()).resolves.toMatchObject({
      error: { code: "INVALID_REVOKE" },
    });

    const malformed = await POST(
      jsonRequest(
        "http://localhost:3000/api/shares/not-a-slug/revoke",
        {},
        {
          Authorization: "Bearer short",
        },
      ),
      { params: Promise.resolve({ slug: "not-a-slug" }) },
    );
    expect(malformed.status).toBe(404);

    const missingSlug = `${"Y".repeat(21)}A`;
    const unavailable = await POST(
      jsonRequest(
        `http://localhost:3000/api/shares/${missingSlug}/revoke`,
        {},
        {
          Authorization: `Bearer ${"R".repeat(43)}`,
        },
      ),
      { params: Promise.resolve({ slug: missingSlug }) },
    );
    expect(unavailable.status).toBe(404);
    await expect(unavailable.json()).resolves.toMatchObject({
      error: { code: "SHARE_UNAVAILABLE" },
    });
  });
});
