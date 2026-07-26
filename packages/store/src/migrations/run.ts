import type { SqlExecutor, SqlSession } from "../sql-executor";

/**
 * 마이그레이션 러너.
 *
 * 규모가 작아 보이지만 여기서 틀리면 복구 수단이 사용자 데이터 삭제뿐이라
 * 방어가 조밀하다. 아래 세 가지는 전부 Node v24.11.1 / SQLite 3.50.4 에서 실행해 확인했다.
 */

export type Migration = {
  readonly version: number;
  readonly name: string;
  /** 멀티스테이트먼트 DDL. `execScript` 로만 실행한다. */
  readonly sql: string;
  /**
   * 이 마이그레이션이 만들어야 하는 sqlite_master 오브젝트 이름.
   * 스크립트가 중간에 잘렸는지를 `user_version` 을 찍기 **전에** 잡는 그물이다.
   */
  readonly expects: readonly string[];
};

export async function readUserVersion(session: SqlSession): Promise<number> {
  const row = await session.get<{ user_version: number }>("pragma user_version");
  return row?.user_version ?? 0;
}

/**
 * @returns 적용된 마이그레이션 버전들. 이미 최신이면 빈 배열.
 */
export async function migrate(
  executor: SqlExecutor,
  migrations: readonly Migration[],
): Promise<number[]> {
  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  const applied: number[] = [];

  for (const migration of ordered) {
    // 트랜잭션 밖에서 먼저 읽는다. 이미 적용됐으면 트랜잭션을 열 이유가 없다.
    const current = await readUserVersion(executor);
    if (current >= migration.version) continue;
    if (current !== migration.version - 1) {
      throw new Error(
        `마이그레이션 순서가 어긋났다: user_version=${current} 인데 ${migration.version}(${migration.name}) 을 적용하려 한다`,
      );
    }

    await executor.transaction(async (tx) => {
      // ★ `tx.run(migration.sql)` 이 아니라 `execScript` 다.
      //   `prepare()` 는 멀티스테이트먼트를 거절하지 않고 첫 문장만 컴파일한 뒤 나머지를
      //   조용히 버린다. 그러면 오브젝트 1개만 생긴 채로 아래 user_version 이 찍히고
      //   커밋되어, 다음 실행부터 이 함수가 영구히 early-return 한다.
      await tx.execScript(migration.sql);

      // 그래도 한 겹 더 본다. execScript 가 옳더라도 스크립트 자체를 잘못 편집했을 수 있고,
      // 그 실수는 user_version 이 찍히는 순간 되돌릴 수 없어진다.
      const objects = await tx.all<{ name: string }>(
        "select name from sqlite_master where name not like 'sqlite_%'",
      );
      const present = new Set(objects.map((row) => row.name));
      const missing = migration.expects.filter((name) => !present.has(name));
      if (missing.length > 0) {
        // throw 하면 트랜잭션이 통째로 롤백되고 user_version 도 같이 되돌아간다(실측).
        throw new Error(
          `${migration.name} 이 만들었어야 할 오브젝트가 없다: ${missing.join(", ")} — 스크립트가 중간에 잘렸을 수 있다`,
        );
      }

      // `pragma user_version = ?` 는 파라미터 바인딩이 안 된다(`near "?": syntax error`).
      // 정수만 받으므로 호출부 값이 정수인지 여기서 확인하고 문자열로 박는다.
      if (!Number.isInteger(migration.version) || migration.version < 1) {
        throw new Error(`마이그레이션 버전이 양의 정수가 아니다: ${migration.version}`);
      }
      await tx.execScript(`pragma user_version = ${migration.version}`);
    });

    applied.push(migration.version);
  }

  return applied;
}
