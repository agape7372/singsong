import { describe, expect, it } from "vitest";
import { createShareApi } from "../src/app.js";
import { fixtureSnapshot } from "../src/domain.js";
import { createRuntime } from "../src/runtime-config.js";

const origin = "https://share.singsong.test";

function testApp() {
  const runtime = createRuntime({
    APP_PROFILE: "fixture",
    SITE_ORIGIN: origin,
  });
  return {
    runtime,
    app: createShareApi(runtime, {
      requestId: () => "request-test",
      log: () => undefined,
    }),
  };
}

function jsonRequest(
  path: string,
  body: unknown,
  options: {
    method?: "POST" | "DELETE";
    headers?: Record<string, string>;
  } = {},
) {
  return new Request(`${origin}${path}`, {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}

function mutationHeaders(extra: Record<string, string> = {}) {
  return {
    "X-SingSong-Client": "fixture/0.1.0",
    ...extra,
  };
}

async function createShare(
  app: ReturnType<typeof createShareApi>,
  options: {
    idempotencyKey?: string;
    revokeToken?: string;
    title?: string;
  } = {},
) {
  const response = await app.fetch(
    jsonRequest(
      "/api/shares",
      {
        idempotencyKey: options.idempotencyKey ?? "AAAAAAAAAAAAAAAAAAAAAA",
        revokeToken: options.revokeToken ?? "B".repeat(43),
        payload: fixtureSnapshot(options.title),
      },
      { headers: mutationHeaders() },
    ),
  );
  expect(response.status).toBe(201);
  return (await response.json()) as {
    slug: string;
    revokeToken: string;
    expiresAt: string;
    fingerprint: string;
  };
}

describe("share API routes", () => {
  it("searches deterministic fixture rows with bounded JSON and no-store headers", async () => {
    const { app } = testApp();
    const response = await app.fetch(jsonRequest("/api/search", { query: "밤의 체크인" }));
    const body = (await response.json()) as {
      results: Array<{ title: string }>;
      dataSource: string;
      notice: string;
    };

    expect(response.status).toBe(200);
    expect(body.results[0]?.title).toBe("밤의 체크인");
    expect(body.dataSource).toBe("fixture");
    expect(body.notice).toContain("TEST DATA");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("request-test");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("rejects invalid media types, encodings, JSON and oversized bodies", async () => {
    const { app } = testApp();
    const wrongType = await app.fetch(
      new Request(`${origin}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "query=night",
      }),
    );
    expect(wrongType.status).toBe(415);
    await expect(wrongType.json()).resolves.toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE", requestId: "request-test" },
    });

    const encoded = await app.fetch(
      jsonRequest(
        "/api/search",
        { query: "밤의 체크인" },
        { headers: { "Content-Encoding": "gzip" } },
      ),
    );
    expect(encoded.status).toBe(415);

    const malformed = await app.fetch(
      new Request(`${origin}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    expect(malformed.status).toBe(400);

    const oversized = await app.fetch(jsonRequest("/api/search", { query: "가".repeat(2_000) }));
    expect(oversized.status).toBe(413);
  });

  it("requires hygienic native client metadata on mutations without treating it as auth", async () => {
    const { app } = testApp();
    const body = {
      idempotencyKey: "AAAAAAAAAAAAAAAAAAAAAA",
      revokeToken: "B".repeat(43),
      payload: fixtureSnapshot(),
    };
    const missing = await app.fetch(jsonRequest("/api/shares", body));
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({
      error: { code: "INVALID_CLIENT_HEADER" },
    });

    const nativeWithoutOrigin = await app.fetch(
      jsonRequest("/api/shares", body, { headers: mutationHeaders() }),
    );
    expect(nativeWithoutOrigin.status).toBe(201);

    const crossOrigin = await app.fetch(
      jsonRequest(
        "/api/shares",
        {
          ...body,
          idempotencyKey: "CCCCCCCCCCCCCCCCCCCCCA",
          revokeToken: "D".repeat(43),
        },
        {
          headers: mutationHeaders({ Origin: "https://attacker.invalid" }),
        },
      ),
    );
    expect(crossOrigin.status).toBe(403);
  });

  it("creates, reads, idempotently retries, and revokes both supported ways", async () => {
    const { app } = testApp();
    const created = await createShare(app);
    expect(created.slug).toMatch(/^[A-Za-z0-9_-]{21}[AQgw]$/u);
    expect(created.fingerprint).toMatch(/^[a-f0-9]{64}$/u);

    const retry = await app.fetch(
      jsonRequest(
        "/api/shares",
        {
          idempotencyKey: "AAAAAAAAAAAAAAAAAAAAAA",
          revokeToken: "B".repeat(43),
          payload: fixtureSnapshot(),
        },
        { headers: mutationHeaders() },
      ),
    );
    expect(retry.status).toBe(201);
    await expect(retry.json()).resolves.toMatchObject({ slug: created.slug });

    const fetched = await app.fetch(new Request(`${origin}/api/shares/${created.slug}`));
    expect(fetched.status).toBe(200);
    await expect(fetched.json()).resolves.toMatchObject({
      payload: { schemaVersion: 1 },
      fingerprint: created.fingerprint,
    });

    const deleted = await app.fetch(
      jsonRequest(
        `/api/shares/${created.slug}`,
        {},
        {
          method: "DELETE",
          headers: mutationHeaders({
            Authorization: `Bearer ${created.revokeToken}`,
          }),
        },
      ),
    );
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe("");

    const unavailable = await app.fetch(new Request(`${origin}/api/shares/${created.slug}`));
    expect(unavailable.status).toBe(404);
    await expect(unavailable.json()).resolves.toMatchObject({
      error: { code: "SHARE_UNAVAILABLE" },
    });

    const second = await createShare(app, {
      idempotencyKey: "EEEEEEEEEEEEEEEEEEEEEA",
      revokeToken: "F".repeat(43),
    });
    const posted = await app.fetch(
      jsonRequest(
        `/api/shares/${second.slug}/revoke`,
        {},
        {
          headers: mutationHeaders({
            Authorization: `Bearer ${second.revokeToken}`,
          }),
        },
      ),
    );
    expect(posted.status).toBe(204);
  });

  it("uses the same unavailable response for malformed and unknown capabilities", async () => {
    const { app } = testApp();
    const malformed = await app.fetch(new Request(`${origin}/api/shares/not-a-capability`));
    const missing = await app.fetch(new Request(`${origin}/api/shares/${"Z".repeat(21)}A`));
    expect(malformed.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await malformed.json()).toEqual(await missing.json());
  });

  it("returns explicit credential-free OPTIONS without enabling browser CORS", async () => {
    const { app } = testApp();
    for (const path of [
      "/api/search",
      "/api/shares",
      `/api/shares/${"Z".repeat(21)}A`,
      `/api/shares/${"Z".repeat(21)}A/revoke`,
      `/s/${"Z".repeat(21)}A`,
      "/og/ticket-1200x630.png",
      "/.well-known/assetlinks.json",
    ]) {
      const response = await app.fetch(new Request(`${origin}${path}`, { method: "OPTIONS" }));
      expect(response.status, path).toBe(204);
      expect(response.headers.get("allow"), path).toContain("OPTIONS");
      expect(response.headers.has("access-control-allow-origin"), path).toBe(false);
    }
  });
});

describe("landing and static routes", () => {
  it("renders one escaped HTML document with absolute OG URLs and hardening headers", async () => {
    const { app } = testApp();
    const created = await createShare(app, {
      title: "<script>alert(1)</script>",
    });
    const response = await app.fetch(new Request(`${origin}/s/${created.slug}`));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'none'");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(html).toContain(`content="${origin}/og/ticket-1200x630.png"`);
    expect(html).toContain(`content="${origin}/s/${created.slug}"`);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain('data-ticket-variant="og"');
    expect(html).toContain('data-kind="halftoneGlyphs"');
    expect(html).toContain('aria-labelledby="ticket-title ticket-desc"');
    expect(html).not.toMatch(/<script|javascript:/iu);
    expect(html).toContain("singsong://s/");
  });

  it("returns a 404 document without stale OG image metadata", async () => {
    const { app } = testApp();
    const response = await app.fetch(new Request(`${origin}/s/${"Z".repeat(21)}A`));
    const html = await response.text();
    expect(response.status).toBe(404);
    expect(html).not.toContain('property="og:image"');
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("serves the approved PNG and safe fixture association documents", async () => {
    const { app } = testApp();
    const image = await app.fetch(new Request(`${origin}/og/ticket-1200x630.png`));
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(Array.from(new Uint8Array(await image.arrayBuffer()).slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const android = await app.fetch(new Request(`${origin}/.well-known/assetlinks.json`));
    expect(android.headers.get("content-type")).toContain("application/json");
    await expect(android.json()).resolves.toEqual([]);

    const apple = await app.fetch(new Request(`${origin}/.well-known/apple-app-site-association`));
    await expect(apple.json()).resolves.toEqual({
      applinks: { apps: [], details: [] },
    });
  });
});
