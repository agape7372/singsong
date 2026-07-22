import { z } from "zod";
import { getCatalogProvider } from "@/features/catalog/provider.server";
import {
  HttpProblem,
  assertTrustedJsonMutation,
  jsonResponse,
  problemResponse,
  readJsonBody,
} from "@/server/http";
import { takeRateLimit } from "@/server/rate-limit";
import { safeLog } from "@/server/safe-log";
import { isValidSearchQuery } from "@/domain/catalog";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    query: z.string().min(1).max(120).refine(isValidSearchQuery),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  let status = 200;
  try {
    assertTrustedJsonMutation(request);
    const rate = await takeRateLimit(request, "search", 60, 60_000);
    if (!rate.allowed) {
      status = 429;
      const response = jsonResponse(
        {
          error: {
            code: "RATE_LIMITED",
            message: "검색 요청이 잠시 많습니다. 조금 뒤 다시 시도해 주세요.",
            requestId,
          },
        },
        { status, requestId, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
      return response;
    }

    const parsed = requestSchema.safeParse(await readJsonBody(request, 1024));
    if (!parsed.success) {
      throw new HttpProblem(400, "INVALID_SEARCH", "검색어를 확인해 주세요.");
    }

    const provider = getCatalogProvider();
    const results = await provider.search(parsed.data.query, parsed.data.limit);
    if (process.env.NEXT_PUBLIC_APP_PROFILE !== "production") {
      return jsonResponse(
        {
          results,
          dataSource: provider.kind,
          notice: "TEST DATA — 실제 노래방 곡 목록이 아닙니다.",
        },
        { status, requestId },
      );
    }
    return jsonResponse({ results, dataSource: provider.kind }, { status, requestId });
  } catch (error) {
    const response = problemResponse(error, requestId);
    status = response.status;
    return response;
  } finally {
    safeLog({
      event: "api_request",
      route: "/api/search",
      status,
      requestId,
      durationMs: Math.round(performance.now() - started),
    });
  }
}
