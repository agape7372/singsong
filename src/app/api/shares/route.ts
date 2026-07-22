import { z } from "zod";
import {
  canonicalizeSharedSnapshot,
  fingerprintSharedSnapshot,
  serializeSharedSnapshot,
} from "@/domain/canonical";
import { getShareRepository } from "@/features/share/repository.server";
import { ShareRepositoryError } from "@/features/share/types";
import { DomainValidationError } from "@/domain/validation";
import {
  HttpProblem,
  assertTrustedJsonMutation,
  jsonResponse,
  problemResponse,
  readJsonBody,
} from "@/server/http";
import { productionRateBucketHashes, takeRateLimit } from "@/server/rate-limit";
import { safeLog } from "@/server/safe-log";
import { verifyHuman } from "@/server/turnstile";
import { trackAnalytics } from "@/analytics/port";

export const dynamic = "force-dynamic";

function rateLimitedResponse(requestId: string, retryAfterSec: number) {
  return jsonResponse(
    {
      error: {
        code: "RATE_LIMITED",
        message: "티켓 발급 요청이 잠시 많습니다. 나중에 다시 시도해 주세요.",
        requestId,
        retryAfterSec,
      },
    },
    {
      status: 429,
      requestId,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

const createSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{21}[AQgw]$/u),
    revokeToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
    payload: z.unknown(),
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  let status = 201;
  try {
    assertTrustedJsonMutation(request);
    const parsed = createSchema.safeParse(await readJsonBody(request, 128 * 1024));
    if (!parsed.success)
      throw new HttpProblem(400, "INVALID_SHARE", "티켓 데이터를 확인해 주세요.");
    const payload = canonicalizeSharedSnapshot(parsed.data.payload);
    const canonicalPayload = serializeSharedSnapshot(payload);
    const fingerprint = await fingerprintSharedSnapshot(payload);
    const repository = getShareRepository();
    const inspection = await repository.inspect(
      parsed.data.idempotencyKey,
      fingerprint,
      parsed.data.revokeToken,
    );
    if (inspection === "conflict") {
      throw new HttpProblem(409, "IDEMPOTENCY_CONFLICT", "새 공유 요청으로 다시 시도해 주세요.");
    }
    let rateBucketHashes: { hour: string; day: string } | undefined;
    if (inspection !== "reusable") {
      const rate = await takeRateLimit(request, "share-create", 10, 60 * 60 * 1000);
      if (!rate.allowed) {
        status = 429;
        return rateLimitedResponse(requestId, rate.retryAfterSeconds);
      }
      if (!(await verifyHuman(parsed.data.turnstileToken, request, parsed.data.idempotencyKey))) {
        throw new HttpProblem(400, "HUMAN_CHECK_FAILED", "사람 확인을 마친 뒤 다시 시도해 주세요.");
      }
      rateBucketHashes = productionRateBucketHashes(request, "create");
    }
    const created = await repository.create({
      idempotencyKey: parsed.data.idempotencyKey,
      revokeToken: parsed.data.revokeToken,
      payload,
      canonicalPayload,
      fingerprint,
      ...(rateBucketHashes ? { rateBucketHashes } : {}),
    });
    if (created.isNew) trackAnalytics({ name: "snapshot_created" });
    return jsonResponse(
      {
        slug: created.slug,
        revokeToken: created.revokeToken,
        expiresAt: created.expiresAt,
        fingerprint: created.fingerprint,
      },
      { status, requestId },
    );
  } catch (error) {
    if (error instanceof ShareRepositoryError && error.code === "RATE_LIMITED") {
      status = 429;
      return rateLimitedResponse(requestId, 60);
    }
    const mappedError =
      error instanceof DomainValidationError
        ? new HttpProblem(400, "INVALID_SHARE", "티켓 데이터를 확인해 주세요.")
        : error instanceof ShareRepositoryError && error.code === "CONFLICT"
          ? new HttpProblem(409, "IDEMPOTENCY_CONFLICT", "새 공유 요청으로 다시 시도해 주세요.")
          : error;
    const response = problemResponse(mappedError, requestId);
    status = response.status;
    return response;
  } finally {
    safeLog({
      event: "api_request",
      route: "/api/shares",
      status,
      requestId,
      durationMs: Math.round(performance.now() - started),
    });
  }
}
