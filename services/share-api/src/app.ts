import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  DomainValidationError,
  IDEMPOTENCY_KEY_PATTERN,
  REVOKE_TOKEN_PATTERN,
  SHARE_SLUG_PATTERN,
  canonicalizeSharedSnapshot,
  fingerprintSharedSnapshot,
  serializeSharedSnapshot,
} from "./domain.js";
import { isValidSearchQuery } from "./catalog.js";
import {
  HttpProblem,
  assertTrustedJsonRequest,
  emptyResponse,
  htmlResponse,
  jsonResponse,
  methodNotAllowed,
  notFoundProblem,
  problemResponse,
  readJsonBody,
  staticResponse,
} from "./http.js";
import { renderShareLanding, renderUnavailableLanding } from "./landing-html.js";
import { isApprovedOgPng } from "./og-asset.js";
import { productionRateBucketHashes } from "./rate-limit.js";
import type { AppRuntime } from "./runtime-config.js";
import { ShareRepositoryError } from "./share/types.js";

type SafeLogEntry = {
  event: "api_request";
  route: string;
  status: number;
  requestId: string;
  durationMs: number;
};

type ShareApiOptions = {
  requestId?: () => string;
  now?: () => number;
  log?: (entry: SafeLogEntry) => void;
};

const searchSchema = z
  .object({
    query: z.string().min(1).max(120).refine(isValidSearchQuery),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();
const createShareSchema = z
  .object({
    idempotencyKey: z.string().regex(IDEMPOTENCY_KEY_PATTERN),
    revokeToken: z.string().regex(REVOKE_TOKEN_PATTERN),
    payload: z.unknown(),
  })
  .strict();
const emptyObjectSchema = z.object({}).strict();

const routeLimits = {
  search: { limit: 60, windowSeconds: 60 },
  create: { limit: 10, windowSeconds: 3_600 },
  read: { limit: 120, windowSeconds: 60 },
  landing: { limit: 120, windowSeconds: 60 },
  revoke: { limit: 60, windowSeconds: 3_600 },
} as const;

let ogImagePromise: Promise<Uint8Array> | undefined;

async function loadOgImage() {
  ogImagePromise ??= (async () => {
    const candidates = [
      new URL("../public/og/ticket-1200x630.png", import.meta.url),
      new URL("../../../public/og/ticket-1200x630.png", import.meta.url),
    ];
    for (const candidate of candidates) {
      try {
        const bytes = Uint8Array.from(await readFile(candidate));
        if (isApprovedOgPng(bytes)) return bytes;
      } catch {
        // Try the next approved asset location.
      }
    }
    throw new Error("Static OG image is unavailable");
  })();
  return ogImagePromise;
}

function defaultLog(entry: SafeLogEntry) {
  console.info(JSON.stringify(entry));
}

function routeLabel(pathname: string) {
  if (pathname === "/api/search") return "/api/search";
  if (pathname === "/api/shares") return "/api/shares";
  if (/^\/api\/shares\/[^/]+\/revoke$/u.test(pathname)) {
    return "/api/shares/:slug/revoke";
  }
  if (/^\/api\/shares\/[^/]+$/u.test(pathname)) return "/api/shares/:slug";
  if (/^\/s\/[^/]+$/u.test(pathname)) return "/s/:slug";
  if (pathname === "/og/ticket-1200x630.png") return "/og/ticket-1200x630.png";
  if (pathname === "/.well-known/assetlinks.json") return "/.well-known/assetlinks.json";
  if (pathname === "/.well-known/apple-app-site-association") {
    return "/.well-known/apple-app-site-association";
  }
  return "unmatched";
}

function unavailableShare(requestId: string) {
  return jsonResponse(
    {
      error: {
        code: "SHARE_UNAVAILABLE",
        message: "이 공유 티켓을 찾을 수 없습니다.",
        requestId,
      },
    },
    { status: 404, requestId },
  );
}

async function takeRateLimit(
  runtime: AppRuntime,
  request: Request,
  scope: keyof typeof routeLimits,
) {
  const config = routeLimits[scope];
  let decision;
  try {
    decision = await runtime.rateLimiter.take(request, scope, config.limit, config.windowSeconds);
  } catch {
    throw new HttpProblem(
      503,
      "RATE_LIMIT_UNAVAILABLE",
      "요청 보호 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      60,
    );
  }
  if (!decision.allowed) {
    throw new HttpProblem(
      429,
      "RATE_LIMITED",
      "요청이 잠시 많습니다. 조금 뒤 다시 시도해 주세요.",
      decision.retryAfterSeconds,
    );
  }
}

function assertMutation(runtime: AppRuntime, request: Request) {
  assertTrustedJsonRequest(request, runtime.siteOrigin, {
    requireClientHeader: true,
    allowFixtureClient: runtime.profile === "fixture",
  });
}

function assertJson(runtime: AppRuntime, request: Request) {
  assertTrustedJsonRequest(request, runtime.siteOrigin, {
    requireClientHeader: false,
    allowFixtureClient: runtime.profile === "fixture",
  });
}

function optionsResponse(requestId: string, allow: readonly string[]) {
  return emptyResponse({
    status: 204,
    requestId,
    headers: { Allow: allow.join(", ") },
  });
}

export function createShareApi(runtime: AppRuntime, options: ShareApiOptions = {}) {
  const requestId = options.requestId ?? randomUUID;
  const now = options.now ?? Date.now;
  const log = options.log ?? defaultLog;

  async function dispatch(request: Request, currentRequestId: string) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/api/search") {
      const allow = ["POST", "OPTIONS"];
      if (request.method === "OPTIONS") return optionsResponse(currentRequestId, allow);
      if (request.method !== "POST") return methodNotAllowed(currentRequestId, allow);
      assertJson(runtime, request);
      await takeRateLimit(runtime, request, "search");
      const parsed = searchSchema.safeParse(await readJsonBody(request, 1_024));
      if (!parsed.success) {
        throw new HttpProblem(400, "INVALID_SEARCH", "검색어를 확인해 주세요.");
      }
      const results = await runtime.catalog.search(parsed.data.query, parsed.data.limit);
      return jsonResponse(
        runtime.profile === "fixture"
          ? {
              results,
              dataSource: runtime.catalog.kind,
              notice: "TEST DATA · 실제 노래방 곡 목록이 아닙니다.",
            }
          : { results, dataSource: runtime.catalog.kind },
        { status: 200, requestId: currentRequestId },
      );
    }

    if (pathname === "/api/shares") {
      const allow = ["POST", "OPTIONS"];
      if (request.method === "OPTIONS") return optionsResponse(currentRequestId, allow);
      if (request.method !== "POST") return methodNotAllowed(currentRequestId, allow);
      assertMutation(runtime, request);
      const parsed = createShareSchema.safeParse(await readJsonBody(request, 128 * 1_024));
      if (!parsed.success) {
        throw new HttpProblem(400, "INVALID_SHARE", "공유 데이터를 확인해 주세요.");
      }
      const payload = canonicalizeSharedSnapshot(parsed.data.payload);
      const canonicalPayload = serializeSharedSnapshot(payload);
      const fingerprint = fingerprintSharedSnapshot(payload);

      // The serverless limiter runs before repository inspection. Otherwise an
      // attacker can turn inspect() into an unmetered database read primitive.
      await takeRateLimit(runtime, request, "create");
      const inspection = await runtime.repository.inspect(
        parsed.data.idempotencyKey,
        fingerprint,
        parsed.data.revokeToken,
      );
      if (inspection === "conflict") {
        throw new HttpProblem(409, "IDEMPOTENCY_CONFLICT", "새 공유 요청으로 다시 시도해 주세요.");
      }
      const rateBucketHashes = runtime.rateBucketSecret
        ? productionRateBucketHashes(request, "create", runtime.rateBucketSecret, now())
        : undefined;
      const created = await runtime.repository.create({
        idempotencyKey: parsed.data.idempotencyKey,
        revokeToken: parsed.data.revokeToken,
        payload,
        canonicalPayload,
        fingerprint,
        ...(rateBucketHashes ? { rateBucketHashes } : {}),
      });
      return jsonResponse(
        {
          slug: created.slug,
          revokeToken: created.revokeToken,
          expiresAt: created.expiresAt,
          fingerprint: created.fingerprint,
        },
        { status: 201, requestId: currentRequestId },
      );
    }

    const revokeMatch = /^\/api\/shares\/([^/]+)\/revoke$/u.exec(pathname);
    if (revokeMatch) {
      const allow = ["POST", "DELETE", "OPTIONS"];
      if (request.method === "OPTIONS") return optionsResponse(currentRequestId, allow);
      if (request.method !== "POST" && request.method !== "DELETE") {
        return methodNotAllowed(currentRequestId, allow);
      }
      return revoke(request, revokeMatch[1] ?? "", currentRequestId);
    }

    const shareMatch = /^\/api\/shares\/([^/]+)$/u.exec(pathname);
    if (shareMatch) {
      const slug = shareMatch[1] ?? "";
      const allow = ["GET", "DELETE", "OPTIONS"];
      if (request.method === "OPTIONS") return optionsResponse(currentRequestId, allow);
      if (request.method === "DELETE") return revoke(request, slug, currentRequestId);
      if (request.method !== "GET") return methodNotAllowed(currentRequestId, allow);
      await takeRateLimit(runtime, request, "read");
      if (!SHARE_SLUG_PATTERN.test(slug)) return unavailableShare(currentRequestId);
      const share = await runtime.repository.get(slug);
      if (!share) return unavailableShare(currentRequestId);
      return jsonResponse(
        {
          payload: share.payload,
          expiresAt: share.expiresAt,
          fingerprint: share.fingerprint,
        },
        { status: 200, requestId: currentRequestId },
      );
    }

    const landingMatch = /^\/s\/([^/]+)$/u.exec(pathname);
    if (landingMatch) {
      const allow = ["GET", "OPTIONS"];
      if (request.method === "OPTIONS") return optionsResponse(currentRequestId, allow);
      if (request.method !== "GET") return methodNotAllowed(currentRequestId, allow);
      await takeRateLimit(runtime, request, "landing");
      const slug = landingMatch[1] ?? "";
      const share = SHARE_SLUG_PATTERN.test(slug) ? await runtime.repository.get(slug) : null;
      return share
        ? htmlResponse(renderShareLanding(share, runtime.siteOrigin), {
            status: 200,
            requestId: currentRequestId,
          })
        : htmlResponse(renderUnavailableLanding(), {
            status: 404,
            requestId: currentRequestId,
          });
    }

    if (pathname === "/og/ticket-1200x630.png") {
      const allow = ["GET", "OPTIONS"];
      if (request.method === "OPTIONS") return optionsResponse(currentRequestId, allow);
      if (request.method !== "GET") return methodNotAllowed(currentRequestId, allow);
      const image = await loadOgImage();
      return staticResponse(
        image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength) as ArrayBuffer,
        {
          status: 200,
          requestId: currentRequestId,
          contentType: "image/png",
          cacheControl: "public, max-age=86400, immutable",
        },
      );
    }

    if (pathname === "/.well-known/assetlinks.json") {
      const allow = ["GET", "OPTIONS"];
      if (request.method === "OPTIONS") return optionsResponse(currentRequestId, allow);
      if (request.method !== "GET") return methodNotAllowed(currentRequestId, allow);
      return staticResponse(runtime.associations.assetLinksJson, {
        status: 200,
        requestId: currentRequestId,
        contentType: "application/json; charset=utf-8",
        cacheControl: "public, max-age=300",
      });
    }

    if (pathname === "/.well-known/apple-app-site-association") {
      const allow = ["GET", "OPTIONS"];
      if (request.method === "OPTIONS") return optionsResponse(currentRequestId, allow);
      if (request.method !== "GET") return methodNotAllowed(currentRequestId, allow);
      return staticResponse(runtime.associations.appleAppSiteAssociationJson, {
        status: 200,
        requestId: currentRequestId,
        contentType: "application/json; charset=utf-8",
        cacheControl: "public, max-age=300",
      });
    }

    return notFoundProblem(currentRequestId);
  }

  async function revoke(request: Request, slug: string, currentRequestId: string) {
    assertMutation(runtime, request);
    const body = emptyObjectSchema.safeParse(await readJsonBody(request, 8 * 1_024));
    if (!body.success) {
      throw new HttpProblem(400, "INVALID_REVOKE", "폐기 요청 형식을 확인해 주세요.");
    }
    await takeRateLimit(runtime, request, "revoke");
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!SHARE_SLUG_PATTERN.test(slug) || !REVOKE_TOKEN_PATTERN.test(token)) {
      return unavailableShare(currentRequestId);
    }
    const rateBucketHashes = runtime.rateBucketSecret
      ? productionRateBucketHashes(request, "revoke", runtime.rateBucketSecret, now())
      : undefined;
    const outcome = await runtime.repository.revoke(slug, token, rateBucketHashes);
    if (outcome === "rate_limited") {
      throw new HttpProblem(
        429,
        "RATE_LIMITED",
        "요청이 잠시 많습니다. 조금 뒤 다시 시도해 주세요.",
        60,
      );
    }
    if (outcome !== "revoked") return unavailableShare(currentRequestId);
    return emptyResponse({ status: 204, requestId: currentRequestId });
  }

  return {
    async fetch(request: Request) {
      const currentRequestId = requestId();
      const started = performance.now();
      let response: Response;
      try {
        response = await dispatch(request, currentRequestId);
      } catch (error) {
        const mapped =
          error instanceof DomainValidationError
            ? new HttpProblem(400, "INVALID_SHARE", "공유 데이터를 확인해 주세요.")
            : error instanceof ShareRepositoryError && error.code === "RATE_LIMITED"
              ? new HttpProblem(
                  429,
                  "RATE_LIMITED",
                  "요청이 잠시 많습니다. 조금 뒤 다시 시도해 주세요.",
                  60,
                )
              : error instanceof ShareRepositoryError && error.code === "CONFLICT"
                ? new HttpProblem(
                    409,
                    "IDEMPOTENCY_CONFLICT",
                    "새 공유 요청으로 다시 시도해 주세요.",
                  )
                : error;
        response = problemResponse(mapped, currentRequestId);
      }
      log({
        event: "api_request",
        route: routeLabel(new URL(request.url).pathname),
        status: response.status,
        requestId: currentRequestId,
        durationMs: Math.round(performance.now() - started),
      });
      return response;
    },
  };
}
