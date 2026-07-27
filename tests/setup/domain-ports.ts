import type { DomainPorts } from "@/domain/ports";
import { webPorts } from "@/domain/web-ports";

/**
 * 테스트용 DomainPorts. 주입 강제를 풀지 않고(부분 주입·기본값 없음) 공유 헬퍼로만 편의를 준다.
 *
 * 시계만 고정한다 — digest 는 진짜 SHA-256 이어야 한다. 골든 지문
 * (share-payload-boundaries.test.ts:64-66)이 실제 해시값이라, 시계를 스텁하되 digest 는
 * webPorts 의 것을 그대로 쓴다. randomBytes 도 진짜다 — 시드는 티켓마다 달라야 정상이다.
 *
 * ★ 이 파일은 vitest 수집 대상이 아니다(include 는 .test.ts/.tsx 만 잡는다). packages/domain
 *   안에 테스트 전용 모듈을 두면 순수성 가드가 예외를 하나 더 갖게 되므로 여기(tests/setup)에 둔다.
 */
export const FIXED_NOW_MS = Date.parse("2026-07-22T00:00:00.000Z");

export const testPorts: DomainPorts = { ...webPorts, now: () => FIXED_NOW_MS };
