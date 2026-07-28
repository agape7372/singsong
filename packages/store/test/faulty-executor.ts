/**
 * 특정 SQL 에서만 던지는 실행기. Dexie 판이 `IDBObjectStore.prototype.add` 를 스파이한
 * 자리(local-atomicity.test.ts:94-104)의 등가물이다. 트랜잭션 경계는 진짜 실행기가 그대로
 * 처리하므로 롤백은 SQLite 가 한다.
 *
 * ★ **transaction() 이 넘기는 tx 까지 감싸야 한다**(crit §C-6). importSharedPlan 의 두 번째
 *    쓰기는 `sql.transaction(tx => …)` 안의 tx 로 나간다(node-sql-executor.ts:68 이 base 세션을
 *    넘긴다). 최상위 run/all/get 만 감싸면 주입이 절대 발화하지 않고 T16 이 "롤백을 검증했다"고
 *    착각한 채 무음 green 이 된다 — Dexie 가 프로토타입을 스파이한 이유가 모든 경로를 덮기 위해서다.
 *    발화 횟수를 세어(firedCount) 테스트가 "주입이 실제로 발화했는가"를 어서션할 수 있게 한다.
 */

import type { SqlExecutor, SqlRow, SqlRunResult, SqlSession, SqlValue } from "../src/sql-executor";

export interface FaultyExecutor extends SqlExecutor {
  /** shouldFail 이 참을 돌려줘 던진 횟수. 무음 green 방지용. */
  readonly firedCount: () => number;
}

export function faultyExecutor(
  inner: SqlExecutor,
  shouldFail: (sql: string) => boolean,
): FaultyExecutor {
  let fired = 0;
  const guard = (sql: string): void => {
    if (shouldFail(sql)) {
      fired += 1;
      throw new Error(`injected failure: ${sql}`);
    }
  };

  const wrap = (session: SqlSession): SqlSession => ({
    async run(sql: string, params?: readonly SqlValue[]): Promise<SqlRunResult> {
      guard(sql);
      return session.run(sql, params);
    },
    async all<T extends SqlRow = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
      guard(sql);
      return session.all<T>(sql, params);
    },
    async get<T extends SqlRow = SqlRow>(
      sql: string,
      params?: readonly SqlValue[],
    ): Promise<T | null> {
      guard(sql);
      return session.get<T>(sql, params);
    },
    async execScript(sql: string): Promise<void> {
      guard(sql);
      return session.execScript(sql);
    },
  });

  const base = wrap(inner);
  return {
    ...base,
    // ★ tx 도 감싼다 — 트랜잭션 안 쓰기가 이 세션으로 나간다.
    transaction: (task) => inner.transaction((tx) => task(wrap(tx))),
    close: () => inner.close(),
    firedCount: () => fired,
  };
}
