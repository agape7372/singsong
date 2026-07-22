import { beforeAll, describe, expect, it } from "vitest";
import { calculatePlan } from "@/domain/calculation";
import { buildSharedSnapshot } from "@/domain/canonical";
import type { Plan } from "@/domain/models";

beforeAll(() => {
  process.env.APP_PROFILE = "fixture";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
});

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
}

function shareRequest(body: unknown, forwardedFor: string) {
  return new Request("http://localhost:3000/api/shares", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "X-Forwarded-For": forwardedFor,
    },
    body: JSON.stringify(body),
  });
}

const plan: Plan = {
  id: "active-plan",
  revision: 1,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z",
  people: 2,
  pricing: { kind: "song", singlePriceWon: 1_000 },
  items: [
    {
      id: "local",
      source: "manual",
      catalogSongId: null,
      title: "테스트 세션",
      artist: "가상 가수",
      karaokeCodes: [{ vendor: "TJ", code: "123456" }],
      order: 0,
    },
  ],
};

describe("catalog BFF", () => {
  it("accepts POST-only query data and marks fixtures", async () => {
    const { POST } = await import("@/app/api/search/route");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/search", { query: "밤 체크인" }),
    );
    const body = (await response.json()) as {
      dataSource: string;
      notice: string;
      results: unknown[];
    };
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(body.dataSource).toBe("fixture");
    expect(body.notice).toContain("TEST DATA");
    expect(body.results.length).toBeGreaterThan(0);
  });

  it("rejects non-JSON and oversized bodies", async () => {
    const { POST } = await import("@/app/api/search/route");
    const wrongType = await POST(
      new Request("http://localhost:3000/api/search", {
        method: "POST",
        headers: { "Content-Type": "text/plain", Origin: "http://localhost:3000" },
        body: "query=night",
      }),
    );
    expect(wrongType.status).toBe(415);
    const oversized = await POST(
      jsonRequest("http://localhost:3000/api/search", { query: "x".repeat(2_000) }),
    );
    expect(oversized.status).toBe(413);
  });
});

describe("immutable share BFF", () => {
  it("reuses only an exact idempotency, payload and management-token tuple", async () => {
    const idempotencyKey = `${"I".repeat(21)}A`;
    const revokeToken = "J".repeat(43);
    const payload = buildSharedSnapshot(
      plan,
      calculatePlan(1, plan.pricing!, plan.people!),
      `${"K".repeat(21)}A`,
    );
    const { POST } = await import("@/app/api/shares/route");
    const requestBody = { idempotencyKey, revokeToken, payload };
    const first = await POST(jsonRequest("http://localhost:3000/api/shares", requestBody));
    const firstBody = (await first.json()) as { slug: string };
    const retry = await POST(jsonRequest("http://localhost:3000/api/shares", requestBody));
    const retryBody = (await retry.json()) as { slug: string };

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retryBody.slug).toBe(firstBody.slug);

    const wrongToken = await POST(
      jsonRequest("http://localhost:3000/api/shares", {
        ...requestBody,
        revokeToken: "L".repeat(43),
      }),
    );
    expect(wrongToken.status).toBe(409);

    const wrongPayload = await POST(
      jsonRequest("http://localhost:3000/api/shares", {
        ...requestBody,
        payload: buildSharedSnapshot(
          plan,
          calculatePlan(1, plan.pricing!, plan.people!),
          `${"M".repeat(21)}A`,
        ),
      }),
    );
    expect(wrongPayload.status).toBe(409);
  });

  it("does not consume creation quota for an active exact idempotent retry", async () => {
    const payload = buildSharedSnapshot(
      plan,
      calculatePlan(1, plan.pricing!, plan.people!),
      `${"N".repeat(21)}A`,
    );
    const requestBody = {
      idempotencyKey: `${"O".repeat(21)}A`,
      revokeToken: "P".repeat(43),
      payload,
    };
    const { POST } = await import("@/app/api/shares/route");
    const responses: Response[] = [];
    for (let attempt = 0; attempt < 15; attempt += 1) {
      responses.push(await POST(shareRequest(requestBody, "198.51.100.70")));
    }
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const slugs = await Promise.all(
      responses.map(async (response) => ((await response.json()) as { slug: string }).slug),
    );
    expect(new Set(slugs).size).toBe(1);
  });

  it("returns Retry-After and retryAfterSec when new-share quota is exhausted", async () => {
    const payload = buildSharedSnapshot(
      plan,
      calculatePlan(1, plan.pricing!, plan.people!),
      `${"Q".repeat(21)}A`,
    );
    const { POST } = await import("@/app/api/shares/route");
    let response: Response | null = null;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await POST(
        shareRequest(
          {
            idempotencyKey: `${String(attempt).padStart(21, "R")}A`,
            revokeToken: String(attempt).padStart(43, "S"),
            payload,
          },
          "198.51.100.71",
        ),
      );
    }
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("retry-after"))).toBeGreaterThan(0);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED", retryAfterSec: expect.any(Number) },
    });
  });

  it("creates, reads and revokes an exact 22-character capability", async () => {
    const payload = buildSharedSnapshot(
      plan,
      calculatePlan(1, plan.pricing!, plan.people!),
      "AAAAAAAAAAAAAAAAAAAAAA",
    );
    const createRoute = await import("@/app/api/shares/route");
    const createdResponse = await createRoute.POST(
      jsonRequest("http://localhost:3000/api/shares", {
        idempotencyKey: "AAAAAAAAAAAAAAAAAAAAAA",
        revokeToken: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        payload,
      }),
    );
    const created = (await createdResponse.json()) as {
      slug: string;
      revokeToken: string;
      expiresAt: string;
    };
    expect(createdResponse.status).toBe(201);
    expect(created.slug).toMatch(/^[A-Za-z0-9_-]{22}$/u);
    expect(created.revokeToken).toHaveLength(43);

    const getRoute = await import("@/app/api/shares/[slug]/route");
    const fetched = await getRoute.GET(
      new Request(`http://localhost:3000/api/shares/${created.slug}`),
      {
        params: Promise.resolve({ slug: created.slug }),
      },
    );
    expect(fetched.status).toBe(200);
    expect((await fetched.json()) as object).toHaveProperty("payload");

    const revokeRoute = await import("@/app/api/shares/[slug]/revoke/route");
    const revoked = await revokeRoute.POST(
      new Request(`http://localhost:3000/api/shares/${created.slug}/revoke`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${created.revokeToken}`,
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ slug: created.slug }) },
    );
    expect(revoked.status).toBe(204);
    const unavailable = await getRoute.GET(
      new Request(`http://localhost:3000/api/shares/${created.slug}`),
      {
        params: Promise.resolve({ slug: created.slug }),
      },
    );
    expect(unavailable.status).toBe(404);
    expect(unavailable.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects client-tampered calculation data", async () => {
    const payload = buildSharedSnapshot(
      plan,
      calculatePlan(1, plan.pricing!, plan.people!),
      "DDDDDDDDDDDDDDDDDDDDDA",
    );
    const tampered = structuredClone(payload) as {
      calculation: { derived: { totalHighWon: number } };
    };
    tampered.calculation.derived.totalHighWon = 99_999;
    const { POST } = await import("@/app/api/shares/route");
    const response = await POST(
      jsonRequest("http://localhost:3000/api/shares", {
        idempotencyKey: "EEEEEEEEEEEEEEEEEEEEEA",
        revokeToken: "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        payload: tampered,
      }),
    );
    expect(response.status).toBe(400);
  });
});
