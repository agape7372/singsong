import { MIGRATION_0001_EXPECTS, MIGRATION_0001_SQL } from "./0001_initial";
import type { Migration } from "./run";

/**
 * 스토어가 여는 경로에서 적용하는 마이그레이션 목록. `openPlanStore` 가 이 배열을 `migrate`
 * 에 넘긴다. 새 마이그레이션은 version 을 올려 여기에 추가한다(배포 기기 0대라 M2 까지는
 * 0001 을 자유롭게 고쳐도 된다 — 0001_initial.ts:14).
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "0001_initial",
    sql: MIGRATION_0001_SQL,
    expects: MIGRATION_0001_EXPECTS,
  },
];
