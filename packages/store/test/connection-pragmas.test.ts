import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createNodeSqlExecutor } from "./node-sql-executor";
import { createMigratedExecutor } from "./helpers";

/**
 * `busy_timeout` 이 **새 연결마다** 실제로 걸리는지 확인한다(CONNECTION_PRAGMAS 가 연결
 * 스코프라 재적용이 필요한 이유, sql-executor.ts:74-77).
 *
 * ★ Promise.all 로 두 연결을 경합시키지 않는다 — node:sqlite 는 동기라 진 쪽이 이벤트 루프를
 *    막고 그 루프에서 이긴 쪽이 commit 해야 한다(구조적 데드락, 항상 타임아웃, M4 실측). 대신
 *    잠금을 명시적으로 인터리브해 busy_timeout 이 걸렸는지만 잰다. 제품에는 단일 연결 + 공개
 *    경계 뮤텍스(계획 D7)뿐이라 2연결 경합은 우리 코드가 아니라 SQLite 를 테스트하는 것이다.
 */
describe("연결 스코프 busy_timeout", () => {
  it("두 번째 연결의 begin immediate 가 busy_timeout 만큼 기다린 뒤 locked 로 실패한다", async () => {
    const dir = mkdtempSync(join(tmpdir(), "singsong-store-")); // WAL 은 -wal/-shm 사이드카를 만든다
    const file = join(dir, "t.db");
    // createNodeSqlExecutor 는 이미 location 인자를 받는다(node-sql-executor.ts:55) — 프로덕션 변경 불필요.
    const a = await createMigratedExecutor(file);
    const b = createNodeSqlExecutor(file);
    try {
      await b.execScript("pragma busy_timeout = 150"); // 스위트를 빠르게 유지(기본 5000 이면 5초)

      // a 가 쓰기 락을 선점한다.
      await a.execScript("begin immediate");
      await a.run(
        "insert into imported_share (slug, imported_at, plan_revision) values (?, ?, ?)",
        ["S".repeat(21) + "A", "2026-07-01T00:00:00.000Z", 1],
      );

      // b 가 같은 쓰기 락을 재려다 busy_timeout 을 소진하고 실패한다.
      const start = Date.now();
      let message = "";
      try {
        await b.execScript("begin immediate");
        await b.run(
          "insert into imported_share (slug, imported_at, plan_revision) values (?, ?, ?)",
          ["T".repeat(21) + "A", "2026-07-02T00:00:00.000Z", 2],
        );
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      const elapsed = Date.now() - start;

      expect(message).toMatch(/locked/i);
      expect(elapsed).toBeGreaterThanOrEqual(140); // 150 이 실제로 걸렸다(마진 10ms)
      expect(elapsed).toBeLessThan(2_000); // 기본 5000 이 아니라 우리가 건 150 이 적용됐다
    } finally {
      try {
        await a.execScript("rollback");
      } catch {
        /* 이미 롤백됐거나 트랜잭션 없음 */
      }
      await a.close();
      await b.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
