export class HttpProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "HttpProblem";
  }
}

type JsonResponseInit = ResponseInit & {
  requestId: string;
};

const API_CSP =
  "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; object-src 'none'";
export const LANDING_CSP =
  "default-src 'none'; base-uri 'none'; connect-src 'none'; font-src 'none'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; media-src 'none'; object-src 'none'; script-src 'none'; style-src 'unsafe-inline'";

function baseSecurityHeaders(csp: string) {
  return {
    "Content-Security-Policy": csp,
    "Cross-Origin-Resource-Policy": "same-site",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

export function assertTrustedJsonRequest(
  request: Request,
  siteOrigin: URL,
  options: { requireClientHeader: boolean; allowFixtureClient: boolean },
) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpProblem(415, "UNSUPPORTED_MEDIA_TYPE", "JSON 요청만 받을 수 있습니다.");
  }
  const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase();
  if (contentEncoding && contentEncoding !== "identity") {
    throw new HttpProblem(415, "UNSUPPORTED_ENCODING", "압축된 요청 본문은 받을 수 없습니다.");
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== siteOrigin.origin) {
    throw new HttpProblem(403, "UNTRUSTED_ORIGIN", "요청 출처를 확인할 수 없습니다.");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new HttpProblem(403, "UNTRUSTED_ORIGIN", "요청 출처를 확인할 수 없습니다.");
  }
  if (!options.requireClientHeader) return;
  const client = request.headers.get("x-singsong-client")?.trim() ?? "";
  const productionClient = /^(?:android|ios)\/[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/u;
  const fixtureClient = /^fixture\/[0-9]+\.[0-9]+\.[0-9]+$/u;
  if (
    client.length > 64 ||
    (!productionClient.test(client) && !(options.allowFixtureClient && fixtureClient.test(client)))
  ) {
    throw new HttpProblem(400, "INVALID_CLIENT_HEADER", "싱송 앱 요청 정보를 확인해 주세요.");
  }
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      throw new HttpProblem(400, "INVALID_CONTENT_LENGTH", "요청 크기 정보를 확인해 주세요.");
    }
    if (declaredLength > maxBytes) {
      throw new HttpProblem(413, "PAYLOAD_TOO_LARGE", "요청 내용의 크기를 줄여 주세요.");
    }
  }
  const reader = request.body?.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        if (bytesRead > maxBytes) {
          await reader.cancel().catch(() => undefined);
          throw new HttpProblem(413, "PAYLOAD_TOO_LARGE", "요청 내용의 크기를 줄여 주세요.");
        }
        try {
          text += decoder.decode(value, { stream: true });
        } catch {
          await reader.cancel().catch(() => undefined);
          throw new HttpProblem(400, "INVALID_JSON", "JSON 요청 형식을 확인해 주세요.");
        }
      }
      try {
        text += decoder.decode();
      } catch {
        throw new HttpProblem(400, "INVALID_JSON", "JSON 요청 형식을 확인해 주세요.");
      }
    } finally {
      reader.releaseLock();
    }
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpProblem(400, "INVALID_JSON", "JSON 요청 형식을 확인해 주세요.");
  }
}

export function jsonResponse(body: unknown, init: JsonResponseInit) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Request-Id", init.requestId);
  for (const [key, value] of Object.entries(baseSecurityHeaders(API_CSP))) {
    headers.set(key, value);
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function emptyResponse(init: ResponseInit & { requestId: string }) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Request-Id", init.requestId);
  for (const [key, value] of Object.entries(baseSecurityHeaders(API_CSP))) {
    headers.set(key, value);
  }
  return new Response(null, { ...init, headers });
}

export function htmlResponse(
  body: string,
  init: ResponseInit & { requestId: string; cacheControl?: string },
) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", init.cacheControl ?? "no-store");
  headers.set("X-Request-Id", init.requestId);
  for (const [key, value] of Object.entries(baseSecurityHeaders(LANDING_CSP))) {
    headers.set(key, value);
  }
  return new Response(body, { ...init, headers });
}

export function staticResponse(
  body: BodyInit,
  init: ResponseInit & { requestId: string; contentType: string; cacheControl: string },
) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", init.contentType);
  headers.set("Cache-Control", init.cacheControl);
  headers.set("X-Request-Id", init.requestId);
  for (const [key, value] of Object.entries(baseSecurityHeaders(API_CSP))) {
    headers.set(key, value);
  }
  return new Response(body, { ...init, headers });
}

export function problemResponse(error: unknown, requestId: string) {
  if (error instanceof HttpProblem) {
    const detail =
      error.retryAfterSeconds === undefined ? {} : { retryAfterSec: error.retryAfterSeconds };
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...detail,
        },
      },
      {
        status: error.status,
        requestId,
        ...(error.retryAfterSeconds === undefined
          ? {}
          : { headers: { "Retry-After": String(error.retryAfterSeconds) } }),
      },
    );
  }
  return jsonResponse(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        requestId,
      },
    },
    { status: 500, requestId },
  );
}

export function notFoundProblem(requestId: string) {
  return jsonResponse(
    {
      error: {
        code: "NOT_FOUND",
        message: "요청한 경로를 찾을 수 없습니다.",
        requestId,
      },
    },
    { status: 404, requestId },
  );
}

export function methodNotAllowed(requestId: string, allow: readonly string[]) {
  return jsonResponse(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "이 경로에서 사용할 수 없는 요청 방식입니다.",
        requestId,
      },
    },
    {
      status: 405,
      requestId,
      headers: { Allow: allow.join(", ") },
    },
  );
}
