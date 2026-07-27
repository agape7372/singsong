/**
 * `liveQuery`(Dexie) 대체 — 수동 구독 버스.
 *
 * Dexie 의 `liveQuery`/`BroadcastChannel`(plan-database.ts:180-208,528-537)은 RN 에 없다.
 * 계획 D8 이 drizzle 의 `useLiveQuery`(= sqlite3_update_hook)를 기각한 이유가 이 버스의
 * 설계 근거다: update hook 은 **트랜잭션 커밋 전에** 발화해서, 롤백된 상태를 구독자에게
 * 알린다. 이 앱에는 롤백을 어서션하는 테스트(local-atomicity T16)가 실제로 있다.
 *
 * 그래서 발화 시점을 코드가 통제한다. 이 버스는 topic 만 안다(값을 싣지 않는다) —
 * 구독자는 통지를 받으면 스스로 다시 읽는다. 불변식은 plan-store.ts 가 지킨다:
 *   1. **커밋 뒤에만 emit.** 트랜잭션 안에서 부르지 않는다.
 *   2. **읽기 API 는 emit 하지 않는다.** getActivePlan 은 행이 없으면 삽입하지만(쓰기)
 *      여기서 emit 하면 observeActivePlan → getActivePlan → emit → … 무한루프다
 *      (plan-database.ts:184-186 이 Dexie 판에서 경고한 함정의 재출현). 뮤테이션만 통지한다.
 *   4. **구독 즉시 1회 발화는 이 버스가 아니라 observe* 가** 명시적으로 한 번 읽어서 낸다.
 */

export type StoreTopic = "plan" | "profile" | "ticket" | "imported-share" | "managed-share";

export interface ChangeBus {
  subscribe(topic: StoreTopic, listener: () => void): () => void;
  emit(topic: StoreTopic): void;
}

export function createChangeBus(): ChangeBus {
  const listeners = new Map<StoreTopic, Set<() => void>>();

  return {
    subscribe(topic, listener) {
      let set = listeners.get(topic);
      if (!set) {
        set = new Set();
        listeners.set(topic, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
    emit(topic) {
      const set = listeners.get(topic);
      if (!set) return;
      // 스냅샷을 뜬 뒤 순회한다 — 리스너가 통지 안에서 구독을 해지해도(자기 자신 제거가
      // 흔하다) 순회가 깨지지 않게.
      for (const listener of [...set]) listener();
    },
  };
}
