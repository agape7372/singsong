import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveTurnstileAttemptId, verifyHuman } from "@/server/turnstile";

describe("Turnstile request binding", () => {
  beforeEach(() => {
    vi.stubEnv("APP_PROFILE", "production");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "real-secret-for-contract-test");
    vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "tickets.example.com");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("derives a stable RFC 4122 v4-shaped UUID and separates keys", async () => {
    const first = await deriveTurnstileAttemptId(`${"A".repeat(21)}A`, "token-one");
    const retry = await deriveTurnstileAttemptId(`${"A".repeat(21)}A`, "token-one");
    const otherKey = await deriveTurnstileAttemptId(`${"B".repeat(21)}A`, "token-one");

    expect(first).toBe(retry);
    expect(first).toBe("672e68d2-abd4-4205-8c5f-00dce2137e37");
    expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
    expect(otherKey).not.toBe(first);
  });

  it("requires exact action, hostname and a fresh challenge", async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response(
        JSON.stringify({
          success: true,
          action: "create_share",
          hostname: "tickets.example.com",
          challenge_ts: now,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://tickets.example.com/api/shares", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
    const key = `${"C".repeat(21)}A`;

    await expect(verifyHuman("real-token", request, key)).resolves.toBe(true);
    const form = fetchMock.mock.calls[0]?.[1]?.body;
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get("secret")).toBe("real-secret-for-contract-test");
    expect((form as FormData).get("response")).toBe("real-token");
    expect((form as FormData).get("remoteip")).toBe("203.0.113.7");
    expect((form as FormData).get("idempotency_key")).toBe(
      await deriveTurnstileAttemptId(key, "real-token"),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          action: "wrong_action",
          hostname: "tickets.example.com",
          challenge_ts: now,
        }),
        { status: 200 },
      ),
    );
    await expect(verifyHuman("second-token", request, key)).resolves.toBe(false);
  });

  it.each([
    ["wrong hostname", { hostname: "attacker.example" }],
    ["expired challenge", { challenge_ts: "2026-07-22T00:54:59.999Z" }],
    ["future challenge", { challenge_ts: "2026-07-22T01:00:30.001Z" }],
    ["missing timestamp", { challenge_ts: undefined }],
  ])("fails closed for a %s", async (_label, override) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T01:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              action: "create_share",
              hostname: "tickets.example.com",
              challenge_ts: "2026-07-22T01:00:00.000Z",
              ...override,
            }),
            { status: 200 },
          ),
      ),
    );

    await expect(
      verifyHuman(
        "single-use-token",
        new Request("https://tickets.example.com/api/shares"),
        `${"D".repeat(21)}A`,
      ),
    ).resolves.toBe(false);
  });

  it("rejects test secrets, missing tokens and oversized tokens before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://tickets.example.com/api/shares");
    const key = `${"E".repeat(21)}A`;

    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    await expect(verifyHuman("token", request, key)).resolves.toBe(false);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "real-secret-for-contract-test");
    await expect(verifyHuman(undefined, request, key)).resolves.toBe(false);
    await expect(verifyHuman("x".repeat(2_049), request, key)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows fixture bypass only on loopback", async () => {
    vi.stubEnv("APP_PROFILE", "fixture");
    const key = `${"F".repeat(21)}A`;

    await expect(
      verifyHuman(undefined, new Request("http://127.0.0.1:3000/api/shares"), key),
    ).resolves.toBe(true);
    await expect(
      verifyHuman(undefined, new Request("https://preview.example/api/shares"), key),
    ).resolves.toBe(false);
  });

  it("fails closed when Siteverify exceeds five seconds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const verification = verifyHuman(
      "slow-token",
      new Request("https://tickets.example.com/api/shares"),
      `${"G".repeat(21)}A`,
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce(), {
      timeout: 1_000,
      interval: 1,
    });
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(verification).resolves.toBe(false);
  });
});
