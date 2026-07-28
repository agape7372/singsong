/**
 * 스토어가 바깥 세계에 요구하는 능력(capability). **타입 전용 — 런타임 코드 0줄.**
 *
 * `@singsong/domain/ports` 의 `DomainPorts`(트랙 A 랜딩, ports.ts:34-38)에서 `now`·
 * `randomBytes` 를 그대로 물려받는다 — 두 포트가 갈라지지 않게 Pick 으로 묶는다.
 * `randomId` 는 도메인이 안 쓰지만(도메인 안 randomUUID 0건, ports.ts:19-22) store 는
 * 로컬 track id 에 쓴다. 그래서 `RandomId` 낱개 타입을 조합한다.
 *
 * ★ `digest` 는 뺀다 — plan-database.ts 전체에 해싱이 없다. fingerprint 는
 *    `createTicketSnapshot`(canonical.ts:165)이 이미 계산해서 TicketSnapshot 에 담아 넘긴다.
 *
 * ★ `now` 는 `Clock = () => number`(epoch 밀리초)다. 스펙 §3.4 는 `() => string`(ISO)을
 *    적었으나 트랙 A 가 랜딩한 `DomainPorts.now`/`Clock`(ports.ts:27-28)은 number 다.
 *    디스크가 정본이라 여기서 갈라진다 — store 는 record 타임스탬프가 필요한 곳에서
 *    `new Date(ports.now()).toISOString()` 로 변환하고(만료 비교는 ms 를 그대로 쓴다),
 *    덕분에 `createTicketSnapshot` 과 **같은 clock 한 벌**을 공유해 결정성이 한곳에서 잡힌다.
 *
 * ★ 구현체는 store 에 넣지 않는다. 앱(M2)은 expo-crypto 의 getRandomValues·randomUUID 를,
 *    테스트는 Node web crypto 를 꽂는다. `expo-crypto.getRandomBytes` 는 **사용 금지** —
 *    `__DEV__ && !global.nativeCallSyncHook` 에서 Math.random 으로 강등되고 bridgeless dev 에서
 *    그 조건이 상시 참이다(web-ports.ts:14-18 실측 인계).
 */

import type { DomainPorts, RandomId } from "@singsong/domain/ports";

export type StorePorts = Pick<DomainPorts, "now" | "randomBytes"> & {
  readonly randomId: RandomId;
};
