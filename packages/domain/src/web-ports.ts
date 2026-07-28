// packages/domain/src/web-ports.ts
//
// 웹/Node 런타임용 DomainPorts 기본 구현(crypto 전역 · Date).
//
// ★ index.ts 에서 re-export 하지 않는다. `@singsong/domain` 을 import 하는 것만으로
//    crypto 참조가 모듈 그래프에 들어오면 순수성 가드(C5)가 성립하지 않고, apps/app 이
//    실수로 이걸 집을 여지가 생긴다(RN 에는 crypto 전역이 없다). package.json 의
//    `"./*": "./src/*.ts"` 덕에 `@singsong/domain/web-ports`(런타임)·`@/domain/web-ports`
//    (tsconfig/vitest alias)로만 닿는다.
//
// ★ 여기서 `crypto` 는 **전역**이라 import 문이 없다 — eslint packages/* 수입 경계
//    (no-restricted-imports)에 걸리지 않는다. 이 파일은 C5 순수성 가드 대상에서도 제외된다.
//
// ★ 네이티브(M2, apps/app/src/ports.ts) 는 이 파일이 아니라 expo-crypto 로 조합한다.
//    그때 getRandomBytes 는 금지 — expo-crypto/src/Crypto.ts:32-41 이 `__DEV__` 안에서
//    (!global.nativeCallSyncHook || global.__REMOTEDEV__) 일 때 Math.random 으로 강등하고,
//    bridgeless dev 에서 그 조건이 상시 참이다(프로덕션 번들에서는 강등 안 됨 — crit §N-6).
//    getRandomValues(:159-163)·randomUUID(:177-179)·digest(:207) 에는 그 분기가 없다.

import type { Clock, DomainPorts, RandomBytes, RandomId, Sha256Digest } from "./ports";

export const webRandomBytes: RandomBytes = (byteLength) =>
  crypto.getRandomValues(new Uint8Array(byteLength));

export const webRandomId: RandomId = () => crypto.randomUUID();

export const webNow: Clock = () => Date.now();

export const webSha256: Sha256Digest = async (bytes) => {
  // ★ 복사가 필요하다. Node Buffer 처럼 풀링된 ArrayBuffer 를 넘겨받으면 bytes.buffer 는
  //    요청보다 크고 byteOffset 이 0 이 아니다 — 그대로 digest 하면 남의 바이트까지 해시한다.
  //    (원본 canonical.ts:136-137 의 의도를 보존.)
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return new Uint8Array(digest);
};

export const webPorts: DomainPorts = {
  randomBytes: webRandomBytes,
  digest: webSha256,
  now: webNow,
};
