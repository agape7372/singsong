/**
 * 스토어가 SQLite 를 만지는 유일한 창구.
 *
 * 왜 포트를 두는가 — `expo-sqlite` 는 Node 에서 돌지 않는다. 계약 테스트를 기기 없이
 * 돌리려면 같은 인터페이스를 Node 24 내장 `node:sqlite` 로도 구현할 수 있어야 한다.
 * 스토어 로직은 어느 쪽이 꽂혔는지 몰라야 하고, 드라이버 고유의 모양이 이 파일 밖으로
 * 새어 나가면 안 된다.
 *
 * 아래 규약은 전부 Node v24.11.1 / SQLite 3.50.4 에서 **실행해서** 확인한 것이다.
 * 문서나 기억이 아니라 실측이 근거다.
 */

/**
 * `boolean` 과 `undefined` 는 뺀다 — `node:sqlite` 가 둘 다
 * `Provided value cannot be bound to SQLite parameter` TypeError 를 던진다.
 * 2^53 을 넘는 정수는 RangeError. 불리언은 호출부에서 0/1 로 정규화한다.
 */
export type SqlValue = string | number | Uint8Array | null;

export type SqlRow = Record<string, SqlValue>;

export interface SqlRunResult {
  /**
   * `sqlite3_changes()`. ★ *값이 바뀐 행* 이 아니라 ***쓰인 행*** 을 센다 — 같은 값으로 다시
   * UPDATE 해도 changes=1 이다(M7 실측: `update … set v='same'` → changes 1, `update … where 없는키`
   * → 0). 즉 "no-op UPDATE 는 0" 은 **틀린 근거**였다(정정).
   * `claimTicketMotion` 을 `UPDATE … WHERE issue_motion_claimed_at IS NULL` + `changes === 1` 로
   * 환원할 수 있는 진짜 근거는 값 비교가 아니라 **WHERE 가 이미-청구·없는 행을 걸러서** 이번에
   * 청구한 경우에만 한 행이 쓰이기 때문이다.
   */
  readonly changes: number;
  /**
   * ★ 드라이버마다 철자가 다르다 — `node:sqlite` 는 `lastInsertRowid`(소문자 i),
   * `expo-sqlite` 는 `lastInsertRowId`(대문자 I). 드라이버 객체를 그대로 통과시키면
   * 한쪽에서 조용히 `undefined` 가 된다. 어댑터가 여기로 정규화한다.
   */
  readonly lastInsertRowId: number;
}

/**
 * 트랜잭션 **안**의 핸들. `transaction()` 이 없는 것이 설계다 —
 * 중첩 BEGIN 은 `cannot start a transaction within a transaction` 이고,
 * 타입에서 빼 두면 "공개 함수는 공개 함수를 호출하지 않는다"는 뮤텍스 규약이
 * 관례가 아니라 구조로 강제된다.
 */
export interface SqlSession {
  run(sql: string, params?: readonly SqlValue[]): Promise<SqlRunResult>;
  all<T extends SqlRow = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T extends SqlRow = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  /**
   * 여러 문장을 한 번에 실행한다. 마이그레이션 DDL 전용이며 파라미터를 받지 않는다.
   *
   * ★ **`run()` 으로 대체하면 안 된다.** `prepare()` 는 멀티스테이트먼트 SQL 을
   * 거절하지 않고 **첫 문장만 컴파일한 뒤 나머지를 버린다**(실측: 3문장 스크립트에서
   * `sourceSQL` 이 첫 문장으로 잘리고 테이블 1개만 생성, `run()` 은 throw 하지 않음).
   * 마이그레이션을 `run(전체스크립트)` 로 돌리면 오브젝트 1개만 만들어진 채
   * `user_version` 이 찍히고 커밋된다. 러너는 이미 마이그레이션된 것으로 보고
   * 영구히 early-return 하며, 기기에서의 복구 수단은 DB 파일 삭제 = 사용자 데이터 삭제뿐이다.
   */
  execScript(sql: string): Promise<void>;
}

export interface SqlExecutor extends SqlSession {
  /**
   * `BEGIN IMMEDIATE` 로 연다. deferred 는 읽기 락으로 시작해 첫 쓰기에서 승격하므로
   * 경합이 트랜잭션 중간에, 재시도할 수 없는 형태로 드러난다. IMMEDIATE 는 쓰기 락을
   * 선점해서 경합이 `busy_timeout` 구간으로 들어온다.
   */
  transaction<T>(task: (tx: SqlSession) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * 연결을 열 때마다 다시 걸어야 하는 PRAGMA.
 *
 * `journal_mode` 는 여기 없다 — 파일 헤더에 영속되므로 한 번만 걸면 되고, 게다가
 * 트랜잭션 안에서는 `cannot change out of wal mode from within a transaction` 으로
 * 하드 실패한다. 반대로 `busy_timeout` 과 `foreign_keys` 는 **연결 스코프**라
 * 새 연결마다 0/기본값으로 돌아간다(실측).
 *
 * ★ `foreign_keys` 를 명시하는 이유가 중요하다. `node:sqlite` 는 기본이 **ON** 이고
 * (`enableForeignKeyConstraints` 기본 true) C 라이브러리 기본값 OFF 와 반대다.
 * 명시하지 않으면 CI 는 FK 를 강제하고 기기는 안 해서 **CI 가 green 인 채로
 * 기기에서만 깨지는** 방향으로 어긋난다.
 */
export const CONNECTION_PRAGMAS: readonly string[] = [
  "pragma busy_timeout = 5000",
  "pragma foreign_keys = on",
];

/**
 * 파일 헤더에 영속되는 PRAGMA. DB 를 처음 만들 때 한 번, 트랜잭션 **밖**에서.
 */
export const DURABLE_PRAGMAS: readonly string[] = ["pragma journal_mode = wal"];

/**
 * 실행기가 진짜 SQLite 인지 한 줄 왕복으로 확인한다.
 *
 * `expo-sqlite` 는 서버 런타임용 더미 구현을 갖고 있고 그쪽 `runAsync` 는
 * `{ changes: 0 }` 을 돌려준다. 그 위에서 테스트하면 **아무것도 저장하지 않는 DB 에
 * 대해 전부 green** 이 난다. 그래서 스토어를 여는 경로에서 한 번 호출한다 —
 * Node 어댑터 팩토리에 달면 더미는 expo 어댑터로만 도달하므로 영원히 발화하지 않는
 * no-op 이 된다.
 */
export async function assertRealSqlExecutor(executor: SqlSession): Promise<void> {
  const probe = `__singsong_probe_${Math.floor(Date.now() % 1_000_000)}`;
  await executor.execScript(`create table if not exists ${probe} (k text primary key, v text)`);
  try {
    const inserted = await executor.run(`insert into ${probe} (k, v) values (?, ?)`, ["k", "v"]);
    if (inserted.changes !== 1) {
      throw new Error(
        `SqlExecutor 가 changes=${inserted.changes} 를 반환했다 — 더미 구현으로 보인다`,
      );
    }
    const row = await executor.get<{ v: string }>(`select v from ${probe} where k = ?`, ["k"]);
    if (row?.v !== "v") {
      throw new Error("SqlExecutor 왕복 실패 — 쓴 값이 읽히지 않는다");
    }
  } finally {
    await executor.execScript(`drop table if exists ${probe}`);
  }
}
