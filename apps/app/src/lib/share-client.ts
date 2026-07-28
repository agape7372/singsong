import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  isValidShareSlug,
  parseSharedSnapshot,
  type SharedSnapshot,
  type TicketSnapshot,
} from "@singsong/domain";
import type { ManagedShare } from "@singsong/store";

import { shareApiUrl } from "@/lib/runtime-config";

type ErrorEnvelope = { error?: { message?: string; code?: string } };

export type CreatedShare = {
  readonly slug: string;
  readonly revokeToken: string;
  readonly expiresAt: string;
  readonly fingerprint: string;
};

export class ShareApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "ShareApiError";
  }
}

function clientHeader() {
  return `${Platform.OS}/${Constants.expoConfig?.version ?? "dev"}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const envelope = body as ErrorEnvelope;
    if (typeof envelope.error?.message === "string") return envelope.error.message;
  }
  return fallback;
}

function errorCode(body: unknown): string | null {
  if (body && typeof body === "object") {
    const envelope = body as ErrorEnvelope;
    if (typeof envelope.error?.code === "string") return envelope.error.code;
  }
  return null;
}

function assertOk(response: Response, body: unknown, fallback: string): void {
  if (!response.ok) {
    throw new ShareApiError(errorMessage(body, fallback), response.status, errorCode(body));
  }
}

export function shareLandingUrl(slug: string): string {
  if (!isValidShareSlug(slug)) throw new Error("티켓 링크 형식이 올바르지 않습니다.");
  return shareApiUrl(`/s/${encodeURIComponent(slug)}`);
}

export async function createRemoteShare(
  ticket: TicketSnapshot,
  pending: ManagedShare,
): Promise<CreatedShare> {
  const response = await fetch(shareApiUrl("/api/shares"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SingSong-Client": clientHeader(),
    },
    body: JSON.stringify({
      idempotencyKey: pending.idempotencyKey,
      revokeToken: pending.revokeToken,
      payload: ticket.payload,
    }),
  });
  const body = await readJson(response);
  assertOk(response, body, "공유 링크를 만들지 못했습니다.");
  const result = body as Partial<CreatedShare> | null;
  if (
    !result ||
    typeof result.slug !== "string" ||
    !isValidShareSlug(result.slug) ||
    typeof result.revokeToken !== "string" ||
    result.revokeToken !== pending.revokeToken ||
    typeof result.expiresAt !== "string" ||
    typeof result.fingerprint !== "string" ||
    result.fingerprint !== ticket.fingerprint
  ) {
    throw new Error("공유 서버 응답을 확인하지 못했습니다.");
  }
  return result as CreatedShare;
}

export async function fetchRemoteShare(
  slug: string,
): Promise<{ payload: SharedSnapshot; expiresAt: string | null }> {
  if (!isValidShareSlug(slug)) throw new Error("티켓 링크 형식이 올바르지 않습니다.");
  const response = await fetch(shareApiUrl(`/api/shares/${encodeURIComponent(slug)}`), {
    headers: { "X-SingSong-Client": clientHeader() },
  });
  const body = await readJson(response);
  assertOk(response, body, "이 티켓을 찾을 수 없습니다.");
  if (!body || typeof body !== "object") throw new Error("공유 서버 응답을 확인하지 못했습니다.");
  const record = body as { payload?: unknown; snapshot?: unknown; expiresAt?: unknown };
  return {
    payload: parseSharedSnapshot(record.payload ?? record.snapshot),
    expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : null,
  };
}

export async function revokeRemoteShare(slug: string, revokeToken: string): Promise<void> {
  if (!isValidShareSlug(slug)) throw new Error("티켓 링크 형식이 올바르지 않습니다.");
  const response = await fetch(shareApiUrl(`/api/shares/${encodeURIComponent(slug)}/revoke`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${revokeToken}`,
      "Content-Type": "application/json",
      "X-SingSong-Client": clientHeader(),
    },
    body: "{}",
  });
  if (response.ok || response.status === 404) return;
  const body = await readJson(response);
  throw new ShareApiError(
    errorMessage(body, "공유 링크를 폐기하지 못했습니다."),
    response.status,
    errorCode(body),
  );
}
