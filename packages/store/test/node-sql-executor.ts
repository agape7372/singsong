import { DatabaseSync } from "node:sqlite";

import {
  CONNECTION_PRAGMAS,
  DURABLE_PRAGMAS,
  type SqlExecutor,
  type SqlRow,
  type SqlRunResult,
  type SqlSession,
  type SqlValue,
} from "../src/sql-executor";

/**
 * `node:sqlite` 기반 `SqlExecutor`. **테스트 전용**이다.
 *
 * 기기에서는 `expo-sqlite` 어댑터가 꽂히고, 이 파일은 계약 테스트를 기기 없이 돌리기 위한
 * 두 번째 구현이다. 포트가 진짜로 이식 가능한지는 구현이 둘일 때만 드러난다.
 *
 * `node:sqlite` 는 **동기 전용**이다(DatabaseSync/StatementSync 에 thenable 없음).
 * 그런데 포트는 async 다 — 이유는 expo-sqlite 에 sync API 가 없어서가 아니라
 * (있다: `execSync`/`runSync`/`withTransactionSync`), sync 는 JS 스레드를 블로킹하고
 * 정본 트랜잭션 프리미티브인 `withTransactionAsync` 가 async 전용이라
 * async 쪽이 이식 가능한 상위집합이기 때문이다.
 */

function normalizeRun(result: {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}): SqlRunResult {
  return {
    changes: Number(result.changes),
    // node:sqlite 는 `lastInsertRowid`(소문자 i), expo-sqlite 는 `lastInsertRowId`.
    // 포트 쪽 철자로 정규화한다.
    lastInsertRowId: Number(result.lastInsertRowid),
  };
}

function session(db: DatabaseSync): SqlSession {
  return {
    async run(sql, params = []) {
      return normalizeRun(db.prepare(sql).run(...(params as SqlValue[])));
    },
    async all<T extends SqlRow = SqlRow>(sql: string, params: readonly SqlValue[] = []) {
      return db.prepare(sql).all(...(params as SqlValue[])) as T[];
    },
    async get<T extends SqlRow = SqlRow>(sql: string, params: readonly SqlValue[] = []) {
      return (db.prepare(sql).get(...(params as SqlValue[])) as T | undefined) ?? null;
    },
    async execScript(sql) {
      db.exec(sql);
    },
  };
}

export function createNodeSqlExecutor(location = ":memory:"): SqlExecutor {
  const db = new DatabaseSync(location);
  // 파일 헤더에 영속되는 것부터. 트랜잭션 밖이어야 한다.
  for (const pragma of DURABLE_PRAGMAS) db.exec(pragma);
  for (const pragma of CONNECTION_PRAGMAS) db.exec(pragma);

  const base = session(db);

  return {
    ...base,
    async transaction(task) {
      db.exec("begin immediate");
      try {
        const value = await task(base);
        db.exec("commit");
        return value;
      } catch (error) {
        // rollback 자체가 던지면 원래 오류가 가려진다. 삼키고 원인을 올린다.
        try {
          db.exec("rollback");
        } catch {
          /* 이미 롤백됐거나 트랜잭션이 없다 */
        }
        throw error;
      }
    },
    async close() {
      db.close();
    },
  };
}
