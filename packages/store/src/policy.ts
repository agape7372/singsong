/**
 * 스토어의 순수 정책. **저장 기전을 모른다** — SQL·Dexie 어느 쪽도 여기 없다.
 *
 * 왜 따로 빼는가 — 만료 24h·slug/token 정규식·100곡 상한·revision 규칙·기본 프로필이
 * Dexie 판(src/data/plan-database.ts)과 SQL 판 두 곳에 흩어지면 조용히 표류한다. 이 리포는
 * 손으로 전사하는 걸 금지하고(이미 100 이 네 벌, DEFAULT_PROFILE_COLOR 가 세 벌이었다),
 * C8 에서 src/ 도 이 파일을 import 하게 만들어 규칙을 한 벌로 접는다.
 *
 * ★ 도메인은 **깊은 경로**로만 집는다(`@singsong/domain/validation`·`/models`). 배럴
 *    `@singsong/domain` 은 `export * from "./catalog"` 를 포함하고 catalog 는 store 가 쓰지도
 *    않는 표면(정규식·casing)을 끌고 온다(crit-C §C-2). 배럴을 피하면 그게 안 새어 든다.
 *
 * ★ 에러 클래스는 반드시 한 벌이어야 한다 — use-active-plan.ts:77-78 이
 *    `caught instanceof RevisionConflictError` 로 사용자 문구를 가른다. 두 벌이면 조용히
 *    잘못된 문구가 나간다. 그래서 여기 정의하고 C8 에서 src/ 가 이걸 import 한다.
 *
 * ★ store 는 순수성 가드(packages/domain 전용) 대상이 아니다. `structuredClone` 을 쓰는데
 *    이는 전역이지만 웹·Hermes(Expo winter 무조건 설치, 핸드오프 실측) 양쪽에 있다.
 *    이 파일에 crypto·Intl·Date.now 는 없다 — clock 은 인자로 받는다(결정성).
 */

import type { Plan, SharedSnapshot } from "@singsong/domain/models";
import { DOMAIN_LIMITS, assertValidPlan } from "@singsong/domain/validation";

/* ────────────────────────────── 식별자·상수 ────────────────────────────── */

export const ACTIVE_PLAN_ID = "active-plan"; // plan-database.ts:5
export const PROFILE_ID = "me"; // plan-database.ts:6
export const DEFAULT_PROFILE_COLOR = "rose"; // plan-database.ts:92
export const PENDING_SHARE_RETENTION_MS = 24 * 60 * 60 * 1000; // plan-database.ts:325

/* ──────────────────────────────── 저장 타입 ────────────────────────────── */

export type ImportedShare = { slug: string; importedAt: string; planRevision: number };

export type ManagedShareReceipt = {
  fingerprint: string;
  slug: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type ManagedShareSecret = {
  fingerprint: string;
  idempotencyKey: string;
  revokeToken: string;
  createdAt: string;
};

/** 데이터 경계에서만 합쳐진다. raw capability 는 영수증 테이블에 들어가지 않는다. */
export type ManagedShare = ManagedShareReceipt & ManagedShareSecret;

export type ManagedShareSummary = ManagedShareReceipt & { canRevoke: boolean };

/**
 * photo 축이 없는 프로필. 웹은 Blob(ProfileRecord), 네이티브는 파일 URI(StoredProfile)로
 * photo 를 다르게 표현하므로(§2.4 열린 결정, M5 확정) 공유는 photo 를 모르는 부분만 한다.
 */
export type BaseProfile = { id: string; nickname: string; colorId: string; updatedAt: string };

/* ──────────────────────────────── 에러 ─────────────────────────────────── */

export class RevisionConflictError extends Error {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`Plan revision changed: expected ${expected}, actual ${actual}`);
    this.name = "RevisionConflictError";
  }
}

export class PlanLimitError extends Error {
  constructor() {
    // 리터럴 100 대신 도메인 상수를 참조한다 — 원문 "A plan can contain at most 100 tracks"
    // 와 바이트 동일하되(maxTracks=100), 네 번째 사본을 만들지 않는다(crit-C §N-2).
    super(`A plan can contain at most ${DOMAIN_LIMITS.maxTracks} tracks`);
    this.name = "PlanLimitError";
  }
}

/* ──────────────────────────── 레코드 팩토리 ────────────────────────────── */

export function newPlan(now: string): Plan {
  return {
    id: ACTIVE_PLAN_ID,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    items: [],
    people: null,
    pricing: null,
  };
}

export function emptyProfile(now: string): BaseProfile {
  return { id: PROFILE_ID, nickname: "", colorId: DEFAULT_PROFILE_COLOR, updatedAt: now };
}

/* ───────────────────────── 공유 링크 정책(전부 순수) ────────────────────── */

export function isExpired(record: ManagedShareReceipt, now: number): boolean {
  return record.expiresAt !== null && Date.parse(record.expiresAt) <= now;
}

export function isStalePending(record: ManagedShareReceipt, now: number): boolean {
  // slug 없는 pending 이 24h 를 넘겼거나 createdAt 이 파싱 불가면 stale.
  // ★ `파싱 불가 = stale` 규칙은 JS 술어에만 있다 — SQL WHERE 로 옮기면 이 분기가 사라진다.
  return (
    record.slug === null &&
    (!Number.isFinite(Date.parse(record.createdAt)) ||
      Date.parse(record.createdAt) <= now - PENDING_SHARE_RETENTION_MS)
  );
}

export function isCompleteReceipt(
  receipt: ManagedShareReceipt,
): receipt is ManagedShareReceipt & { slug: string; expiresAt: string } {
  return receipt.slug !== null && receipt.expiresAt !== null;
}

export function combineManagedShare(
  receipt: ManagedShareReceipt,
  secret: ManagedShareSecret,
): ManagedShare {
  return { ...receipt, ...secret };
}

/**
 * pending 영수증 + 두 bearer capability 를 만든다. 토큰 생성기를 **인자로** 받는다
 * (포트 주입) — 정본 호출부는 `capabilityToken(ports.randomBytes)` 를 넘긴다.
 */
export function newManagedShare(
  fingerprint: string,
  now: string,
  token: (byteLength: number) => string,
): { receipt: ManagedShareReceipt; secret: ManagedShareSecret; combined: ManagedShare } {
  const receipt: ManagedShareReceipt = { fingerprint, slug: null, expiresAt: null, createdAt: now };
  const secret: ManagedShareSecret = {
    fingerprint,
    idempotencyKey: token(16),
    revokeToken: token(32),
    createdAt: now,
  };
  return { receipt, secret, combined: combineManagedShare(receipt, secret) };
}

/** 완성 영수증의 형태 검증. plan-database.ts:431-436 의 정규식 2개 + Date.parse. */
export function isValidCompletionReceipt(receipt: {
  slug: string;
  revokeToken: string;
  expiresAt: string;
}): boolean {
  return (
    /^[A-Za-z0-9_-]{21}[AQgw]$/u.test(receipt.slug) &&
    /^[A-Za-z0-9_-]{43}$/u.test(receipt.revokeToken) &&
    Number.isFinite(Date.parse(receipt.expiresAt))
  );
}

/** 만료/stale 영수증(obsolete)과 고아 secret 을 분류한다. plan-database.ts:377-383. */
export function partitionObsoleteShares(
  receipts: readonly ManagedShareReceipt[],
  secrets: readonly ManagedShareSecret[],
  now: number,
): { obsolete: string[]; orphanSecrets: string[] } {
  const receiptFingerprints = new Set(receipts.map(({ fingerprint }) => fingerprint));
  const obsolete = receipts
    .filter((receipt) => isExpired(receipt, now) || isStalePending(receipt, now))
    .map(({ fingerprint }) => fingerprint);
  const orphanSecrets = secrets
    .filter(({ fingerprint }) => !receiptFingerprints.has(fingerprint))
    .map(({ fingerprint }) => fingerprint);
  return { obsolete, orphanSecrets };
}

/**
 * 완성된 영수증만 요약으로. plan-database.ts:500-506.
 * ★ 정렬은 하지 않는다 — SQL 판은 `order by created_at desc, fingerprint`(0001_initial.ts:91)
 *    가 순서를 주고, 그건 Dexie 의 `createdAt desc, fingerprint asc` 와 정확히 일치한다(실측).
 */
export function summarizeManagedShares(
  receipts: readonly ManagedShareReceipt[],
  secrets: readonly ManagedShareSecret[],
): ManagedShareSummary[] {
  const secretFingerprints = new Set(secrets.map(({ fingerprint }) => fingerprint));
  return receipts
    .filter(isCompleteReceipt)
    .map((receipt) => ({ ...receipt, canRevoke: secretFingerprints.has(receipt.fingerprint) }));
}

/* ─────────────────────────── 플랜 변이 규칙 ────────────────────────────── */

/**
 * 클론 → 뮤테이션 → 100곡 검사 → order 재번호 → assertValidPlan. plan-database.ts:219-229.
 * CAS(revision 비교)는 호출부(트랜잭션 안 SELECT 뒤)에 남는다 — 이 함수는 순수하다.
 *
 * ★ `structuredClone` 을 유지한다. 계획 §3.4 는 clonePlan 교체를 요구했으나 핸드오프가
 *    Expo winter 의 structuredClone 상시 설치·"undefined 키 소실" 반증을 실측했다.
 * ★ PlanLimitError 를 assertValidPlan 보다 **먼저** 던진다 — 원본 순서다. 둘 다 100 초과를
 *    잡지만 에러 타입이 PlanLimitError 여야 호출부가 구분한다.
 */
export function applyPlanMutation(
  current: Plan,
  mutation: (plan: Plan) => Omit<Plan, "id" | "revision" | "createdAt" | "updatedAt">,
  now: string,
): Plan {
  const mutable = mutation(structuredClone(current));
  if (mutable.items.length > DOMAIN_LIMITS.maxTracks) throw new PlanLimitError();
  const next: Plan = {
    ...mutable,
    id: ACTIVE_PLAN_ID,
    revision: current.revision + 1,
    createdAt: current.createdAt,
    updatedAt: now,
    items: mutable.items.map((item, order) => ({ ...item, order })),
  };
  assertValidPlan(next);
  return next;
}

/**
 * 공유 스냅샷을 로컬 플랜으로 투영한다. plan-database.ts:268-285.
 * 항목마다 새 로컬 id 를 발급한다(공유 스냅샷엔 id 가 없다) — `newId` 를 인자로 받는다.
 */
export function buildImportedPlan(
  current: Plan,
  payload: SharedSnapshot,
  now: string,
  newId: () => string,
): Plan {
  const plan: Plan = {
    id: ACTIVE_PLAN_ID,
    revision: current.revision + 1,
    createdAt: current.createdAt,
    updatedAt: now,
    items: payload.items.map((item, order) => ({
      id: newId(),
      source: item.source,
      catalogSongId: null,
      title: item.title,
      artist: item.artist,
      karaokeCodes: item.karaokeCodes.map(({ vendor, code }) => ({ vendor, code })),
      order,
    })),
    people: payload.calculation.people,
    pricing: payload.calculation.pricing,
  };
  assertValidPlan(plan);
  return plan;
}
