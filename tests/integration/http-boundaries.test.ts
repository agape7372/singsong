import { beforeAll, describe, expect, it } from "vitest";
import { HttpProblem, readJsonBody } from "@/server/http";

const RAW_LIMIT = 128 * 1024;

beforeAll(() => {
  process.env.APP_PROFILE = "fixture";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
});

function rawRequest(body: string, extraHeaders: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/shares", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "X-Forwarded-For": crypto.randomUUID(),
      ...extraHeaders,
    },
    body,
  });
}

function paddedJson(totalBytes: number) {
  const fixedBytes = new TextEncoder().encode('{"pad":""}').byteLength;
  const body = JSON.stringify({ pad: "x".repeat(totalBytes - fixedBytes) });
  expect(new TextEncoder().encode(body).byteLength).toBe(totalBytes);
  return body;
}

describe("share raw HTTP boundary defenses", () => {
  it("cancels the request stream as soon as max + 1 bytes arrive", async () => {
    const encoder = new TextEncoder();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"a":1}'));
        controller.enqueue(encoder.encode("x"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("http://localhost:3000/api/shares", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    try {
      await readJsonBody(request, 7);
      throw new Error("Expected streaming byte limit rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpProblem);
      expect((error as HttpProblem).code).toBe("PAYLOAD_TOO_LARGE");
    }
    expect(cancelled).toBe(true);
  });

  it("lets an exact 128 KiB body reach schema validation", async () => {
    const { POST } = await import("@/app/api/shares/route");
    const response = await POST(rawRequest(paddedJson(RAW_LIMIT)));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_SHARE" },
    });
  });

  it("rejects 128 KiB + 1 without Content-Length and with a forged small length", async () => {
    const { POST } = await import("@/app/api/shares/route");
    const body = paddedJson(RAW_LIMIT + 1);

    const absentLength = await POST(rawRequest(body));
    expect(absentLength.status).toBe(413);
    await expect(absentLength.json()).resolves.toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE" },
    });

    const forgedLength = await POST(rawRequest(body, { "Content-Length": "1" }));
    expect(forgedLength.status).toBe(413);
    await expect(forgedLength.json()).resolves.toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
  });

  it("rejects an oversized declared length before parsing and unsupported encodings", async () => {
    const { POST } = await import("@/app/api/shares/route");
    const declaredOversize = await POST(
      rawRequest("{}", { "Content-Length": String(RAW_LIMIT + 1) }),
    );
    expect(declaredOversize.status).toBe(413);

    const encoded = await POST(rawRequest("{}", { "Content-Encoding": "gzip" }));
    expect(encoded.status).toBe(415);
    await expect(encoded.json()).resolves.toMatchObject({
      error: { code: "UNSUPPORTED_ENCODING" },
    });
  });
});
