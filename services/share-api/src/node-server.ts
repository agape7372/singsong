import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export type WebRequestHandler = {
  fetch(request: Request): Promise<Response>;
};

function requestUrl(request: IncomingMessage) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string" && /^(?:http|https)$/u.test(forwardedProto)
      ? forwardedProto
      : "http";
  const host = request.headers.host ?? "127.0.0.1";
  return new URL(request.url ?? "/", `${protocol}://${host}`);
}

function webRequest(request: IncomingMessage) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, entry);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  const method = request.method ?? "GET";
  if (method === "GET" || method === "HEAD") {
    return new Request(requestUrl(request), { method, headers });
  }
  return new Request(requestUrl(request), {
    method,
    headers,
    body: Readable.toWeb(request) as ReadableStream<Uint8Array>,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

async function send(response: Response, target: ServerResponse) {
  target.statusCode = response.status;
  response.headers.forEach((value, key) => target.setHeader(key, value));
  if (!response.body) {
    target.end();
    return;
  }
  await pipeline(Readable.fromWeb(response.body as never), target);
}

export function createNodeServer(handler: WebRequestHandler) {
  const server = createServer(async (request, response) => {
    try {
      await send(await handler.fetch(webRequest(request)), response);
    } catch {
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
      }
      response.end(
        JSON.stringify({
          error: {
            code: "INTERNAL_ERROR",
            message: "요청을 처리하지 못했습니다.",
            requestId: "unavailable",
          },
        }),
      );
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}
