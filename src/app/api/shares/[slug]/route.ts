import { getShareRepository } from "@/features/share/repository.server";
import { jsonResponse, problemResponse } from "@/server/http";
import { safeLog } from "@/server/safe-log";

export const dynamic = "force-dynamic";

const SLUG = /^[A-Za-z0-9_-]{21}[AQgw]$/u;

function unavailable(requestId: string) {
  return jsonResponse(
    {
      error: {
        code: "SHARE_UNAVAILABLE",
        message: "이 티켓을 찾을 수 없습니다.",
        requestId,
      },
    },
    { status: 404, requestId },
  );
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  let status = 200;
  try {
    const { slug } = await context.params;
    if (!SLUG.test(slug)) {
      status = 404;
      return unavailable(requestId);
    }
    const share = await getShareRepository().get(slug);
    if (!share) {
      status = 404;
      return unavailable(requestId);
    }
    return jsonResponse(
      { payload: share.payload, expiresAt: share.expiresAt, fingerprint: share.fingerprint },
      { status, requestId },
    );
  } catch (error) {
    const response = problemResponse(error, requestId);
    status = response.status;
    return response;
  } finally {
    safeLog({
      event: "api_request",
      route: "/api/shares/[slug]",
      status,
      requestId,
      durationMs: Math.round(performance.now() - started),
    });
  }
}
