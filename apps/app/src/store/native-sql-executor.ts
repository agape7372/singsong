import { openDatabaseAsync, type SQLiteBindValue, type SQLiteDatabase } from "expo-sqlite";

import {
  CONNECTION_PRAGMAS,
  DURABLE_PRAGMAS,
  type SqlExecutor,
  type SqlRow,
  type SqlRunResult,
  type SqlSession,
  type SqlValue,
} from "@singsong/store";

const DATABASE_NAME = "singsong.db";

function bindParams(params: readonly SqlValue[]): SQLiteBindValue[] {
  return params.map((value) => value as SQLiteBindValue);
}

function createSession(database: SQLiteDatabase): SqlSession {
  return {
    async run(sql, params = []): Promise<SqlRunResult> {
      const result = await database.runAsync(sql, bindParams(params));
      return {
        changes: result.changes,
        lastInsertRowId: result.lastInsertRowId,
      };
    },
    async all<T extends SqlRow = SqlRow>(sql: string, params: readonly SqlValue[] = []) {
      return (await database.getAllAsync(sql, bindParams(params))) as T[];
    },
    async get<T extends SqlRow = SqlRow>(sql: string, params: readonly SqlValue[] = []) {
      return (await database.getFirstAsync(sql, bindParams(params))) as T | null;
    },
    execScript(sql: string) {
      return database.execAsync(sql);
    },
  };
}

/**
 * expo-sqlite 어댑터. store 공개 API가 이미 비재진입 뮤텍스로 직렬화하므로 한 연결에서
 * `BEGIN IMMEDIATE`를 직접 소유할 수 있다. `withExclusiveTransactionAsync`는 별도 연결을
 * 열어 connection PRAGMA가 빠질 수 있어 사용하지 않는다.
 */
export async function openNativeSqlExecutor(): Promise<SqlExecutor> {
  const database = await openDatabaseAsync(DATABASE_NAME);
  const session = createSession(database);
  let transactionOpen = false;

  try {
    for (const pragma of DURABLE_PRAGMAS) await database.execAsync(pragma);
    for (const pragma of CONNECTION_PRAGMAS) await database.execAsync(pragma);
  } catch (error) {
    try {
      await database.closeAsync();
    } catch {
      // PRAGMA 적용의 원래 실패를 보존한다.
    }
    throw error;
  }

  return {
    ...session,
    async transaction<T>(task: (tx: SqlSession) => Promise<T>): Promise<T> {
      if (transactionOpen) {
        throw new Error("중첩 SQLite 트랜잭션은 허용되지 않습니다.");
      }
      transactionOpen = true;
      let began = false;
      try {
        await database.execAsync("begin immediate");
        began = true;
        const result = await task(session);
        await database.execAsync("commit");
        return result;
      } catch (error) {
        if (began) {
          try {
            await database.execAsync("rollback");
          } catch {
            // 원래 실패를 보존한다. 연결 손상은 다음 쿼리에서 명시적으로 드러난다.
          }
        }
        throw error;
      } finally {
        transactionOpen = false;
      }
    },
    close() {
      return database.closeAsync();
    },
  };
}
