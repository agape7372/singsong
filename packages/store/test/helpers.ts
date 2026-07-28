/**
 * 스토어 테스트 공용 헬퍼. **이 파일은 vitest 수집 대상이 아니다**(include 는 *.test.ts 만).
 */

import type { DomainPorts } from "@singsong/domain/ports";
import { webPorts, webRandomBytes, webRandomId } from "@singsong/domain/web-ports";

import { MIGRATIONS } from "../src/migrations/index";
import { migrate } from "../src/migrations/run";
import { openPlanStore, type PlanStore } from "../src/plan-store";
import type { StorePorts } from "../src/ports";
import type { SqlExecutor } from "../src/sql-executor";
import { createNodeSqlExecutor } from "./node-sql-executor";

/** 결정성을 위해 시계만 고정한다 — randomBytes·randomId 는 진짜여야 정상(seed·id 는 매번 달라야 한다). */
export const FIXED_NOW_MS = Date.parse("2026-07-22T00:00:00.000Z");
export const FIXED_NOW_ISO = "2026-07-22T00:00:00.000Z";

export const testStorePorts: StorePorts = {
  now: () => FIXED_NOW_MS,
  randomId: webRandomId,
  randomBytes: webRandomBytes,
};

/** createTicketSnapshot 용 DomainPorts. digest·randomBytes 는 진짜, 시계만 고정. */
export const testDomainPorts: DomainPorts = { ...webPorts, now: () => FIXED_NOW_MS };

/** 마이그레이션까지 끝난 node:sqlite 실행기. location 미지정이면 연결당 독립 `:memory:`(M2). */
export async function createMigratedExecutor(location?: string): Promise<SqlExecutor> {
  const executor = createNodeSqlExecutor(location);
  await migrate(executor, MIGRATIONS);
  return executor;
}

/** 연결당 독립 `:memory:` 위에 연 스토어. 각 테스트가 자기 스토어를 갖는다(오염 0, M2). */
export async function openTestStore(): Promise<{ store: PlanStore; executor: SqlExecutor }> {
  const executor = createNodeSqlExecutor();
  const store = await openPlanStore(executor, testStorePorts);
  return { store, executor };
}
