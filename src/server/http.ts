import "server-only";

export class HttpProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpProblem";
  }
}

export function assertTrustedJsonMutation(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpProblem(415, "UNSUPPORTED_MEDIA_TYPE", "JSON 요청만 받을 수 있습니다.");
  }
  const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase();
  if (contentEncoding && contentEncoding !== "identity") {
    throw new HttpProblem(415, "UNSUPPORTED_ENCODING", "압축된 요청 본문은 받을 수 없습니다.");
  }
  const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin) {
    throw new HttpProblem(403, "UNTRUSTED_ORIGIN", "요청 출처를 확인할 수 없습니다.");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new HttpProblem(403, "UNTRUSTED_ORIGIN", "요청 출처를 확인할 수 없습니다.");
  }
  if (process.env.APP_PROFILE === "production" && !origin) {
    throw new HttpProblem(403, "UNTRUSTED_ORIGIN", "요청 출처를 확인할 수 없습니다.");
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
      throw new HttpProblem(413, "PAYLOAD_TOO_LARGE", "요청이 허용된 크기를 넘었습니다.");
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
          throw new HttpProblem(413, "PAYLOAD_TOO_LARGE", "요청이 허용된 크기를 넘었습니다.");
        }
        try {
          text += decoder.decode(value, { stream: true });
        } catch {
          await reader.cancel().catch(() => undefined);
          throw new HttpProblem(400, "INVALID_JSON", "요청 형식을 확인해 주세요.");
        }
      }
      try {
        text += decoder.decode();
      } catch {
        throw new HttpProblem(400, "INVALID_JSON", "요청 형식을 확인해 주세요.");
      }
    } finally {
      reader.releaseLock();
    }
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpProblem(400, "INVALID_JSON", "요청 형식을 확인해 주세요.");
  }
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit & { requestId: string; cache?: "no-store" | "private" },
) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", init.cache ?? "no-store");
  headers.set("X-Request-Id", init.requestId);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function problemResponse(error: unknown, requestId: string) {
  if (error instanceof HttpProblem) {
    return jsonResponse(
      { error: { code: error.code, message: error.message, requestId } },
      { status: error.status, requestId },
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
