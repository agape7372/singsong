import { getShareRepository } from "@/features/share/repository.server";
import {
  HttpProblem,
  assertTrustedJsonMutation,
  jsonResponse,
  problemResponse,
  readJsonBody,
} from "@/server/http";
import { productionRateBucketHashes, takeRateLimit } from "@/server/rate-limit";
import { safeLog } from "@/server/safe-log";

export const dynamic = "force-dynamic";

const SLUG = /^[A-Za-z0-9_-]{21}[AQgw]$/u;
const TOKEN = /^[A-Za-z0-9_-]{43}$/u;

function rateLimitedResponse(requestId: string, retryAfterSec: number) {
  return jsonResponse(
    {
      error: {
        code: "RATE_LIMITED",
        message: "잠시 후 다시 시도해 주세요.",
        requestId,
        retryAfterSec,
      },
    },
    { status: 429, requestId, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  let status = 204;
  try {
    assertTrustedJsonMutation(request);
    const body = await readJsonBody(request, 8 * 1024);
    if (typeof body !== "object" || body === null || Object.keys(body).length !== 0) {
      throw new HttpProblem(400, "INVALID_REVOKE", "폐기 요청 형식을 확인해 주세요.");
    }
    const rate = await takeRateLimit(request, "share-revoke", 60, 60 * 60 * 1000);
    if (!rate.allowed) {
      status = 429;
      return rateLimitedResponse(requestId, rate.retryAfterSeconds);
    }
    const { slug } = await context.params;
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!SLUG.test(slug) || !TOKEN.test(token)) {
      throw new HttpProblem(404, "SHARE_UNAVAILABLE", "이 티켓을 찾을 수 없습니다.");
    }
    const outcome = await getShareRepository().revoke(
      slug,
      token,
      productionRateBucketHashes(request, "revoke"),
    );
    if (outcome === "rate_limited") {
      status = 429;
      return rateLimitedResponse(requestId, 60);
    }
    if (outcome !== "revoked") {
      throw new HttpProblem(404, "SHARE_UNAVAILABLE", "이 티켓을 찾을 수 없습니다.");
    }
    return new Response(null, {
      status,
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    });
  } catch (error) {
    const response = problemResponse(error, requestId);
    status = response.status;
    return response;
  } finally {
    safeLog({
      event: "api_request",
      route: "/api/shares/[slug]/revoke",
      status,
      requestId,
      durationMs: Math.round(performance.now() - started),
    });
  }
}
