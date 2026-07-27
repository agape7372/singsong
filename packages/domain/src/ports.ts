/**
 * 도메인이 바깥 세계에 요구하는 능력(capability)의 전부. **타입 전용 — 런타임 코드 0줄.**
 *
 * 왜 포트인가 — Hermes/RN 에는 `crypto` 전역이 **없다**(실측: react-native
 * Libraries/Core 전체에 crypto 0건, expo winter runtime.native.ts:16-35 의 install
 * 목록에도 없음, expo-crypto 는 모듈 API 이지 폴리필이 아님). 도메인이 전역을 직접
 * 만지면 웹에서는 조용히 돌고 기기에서만 터진다. 능력을 여기 타입으로 선언하고 기본
 * 구현은 web-ports.ts 에 둔다.
 *
 * 왜 기본값이 없는가 — 기본값은 "웹에서 되니까 됐다" 를 만든다. 주입을 강제하면 새
 * 런타임을 붙일 때 **컴파일 에러**로 드러난다(canonical.ts 의 함수들은 이 타입을 필수
 * 인자로 받는다).
 */

/** 암호학적 난수 `byteLength` 바이트. 동기 — 웹 crypto·expo-crypto 둘 다 동기다. */
export type RandomBytes = (byteLength: number) => Uint8Array;

/**
 * RFC 4122 v4 UUID. **도메인은 쓰지 않는다**(packages/domain 안에 randomUUID 호출 0건 —
 * 실측 grep). store·UI 가 자기 포트로 조합하는 공통 어휘로만 여기 둔다.
 */
export type RandomId = () => string;

/** SHA-256. 반드시 32바이트를 돌려줘야 한다(호출부가 검증한다). */
export type Sha256Digest = (bytes: Uint8Array) => Promise<Uint8Array>;

/** epoch 밀리초. `Date` 를 도메인 밖으로 밀어낸다. */
export type Clock = () => number;

/**
 * 집합 진입점(createTicketSnapshot)이 통째로 받는 포트 묶음. randomId 는 도메인이 안
 * 쓰므로 제외한다 — 넣으면 도메인 호출자 전원이 쓰지도 않는 UUID 생성기를 공급해야 한다.
 */
export interface DomainPorts {
  readonly randomBytes: RandomBytes;
  readonly digest: Sha256Digest;
  readonly now: Clock;
}
