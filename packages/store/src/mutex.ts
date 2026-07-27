/**
 * 비재진입 뮤텍스. 공개 스토어 함수가 트랜잭션을 열기 전에 통과하는 유일한 관문.
 *
 * 왜 필요한가(실측) — 현행 `createNodeSqlExecutor`(test/node-sql-executor.ts:65-80)에
 * 겹치는 `transaction()` 을 주면 `cannot start a transaction within a transaction` 으로
 * 터진다. 그런데 이식할 T15(local-atomicity.test.ts:59-78)는 `Promise.all` 로 정확히 그
 * 모양(동시 2회 saveTicket)을 요구한다. Dexie 는 자체 트랜잭션 큐가 이걸 흡수했고,
 * SQL 에서는 이 뮤텍스가 그 큐를 대신한다.
 *
 * ★ **비재진입이다 — 재진입을 감지하는 게 아니라 구조로 막는다.** 공개 함수가 다른 공개
 *    함수를 부르면 두 번째 획득이 첫 번째 완료를 기다리는데 첫 번째는 두 번째가 끝나야
 *    끝나므로 영구 데드락이다. 그래서 공개 함수는 공개 함수를 부르지 않고 repository
 *    (SqlSession 첫 인자, transaction() 없음)만 부른다. `SqlSession` 타입이 절반을,
 *    이 관례가 나머지 절반을 막는다.
 *
 * ★ **거부돼도 큐는 계속 돈다.** `tail` 은 앞 작업의 성공/실패를 모두 삼켜(then 의 두 콜백이
 *    같다) 다음 작업이 앞 작업의 rejection 에 물려 죽지 않게 한다.
 *    실측 순서: withLock(throw) → catch, withLock(push) → `["a","a-caught","b"]`.
 */

export type Mutex = <T>(task: () => Promise<T>) => Promise<T>;

export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve();
  return function withLock<T>(task: () => Promise<T>): Promise<T> {
    // 앞 작업이 성공하든 실패하든 그 뒤에 이어 붙인다(then 의 onFulfilled·onRejected 를
    // 같은 task 로 둬서, 앞이 던져도 이 작업은 실행된다).
    const run = tail.then(task, task);
    // 큐 꼬리는 결과값을 흘리지 않는다 — 성공·실패 모두 undefined 로 접어 다음 작업이
    // 앞의 값/에러에 오염되지 않게 한다.
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
