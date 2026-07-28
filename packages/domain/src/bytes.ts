/**
 * 순수 바이트 인코더 — base64url · UTF-8. import 0, 전역 의존 0.
 *
 * **왜 `btoa`/`TextEncoder` 를 안 쓰는가.** 둘 다 Hermes 에 존재하지만
 * (`GlobalObject.cpp:765/768`, `TextEncoder.cpp:62-68` — 핸드오프 실측), 도메인은
 * 웹·기기 양쪽에서 도는 순수 코드라 전역 의존을 계약에서 아예 빼는 편이 싸다. 순수
 * 구현이 기존 경로와 **바이트 동일**함은 실측으로 확인했다: base64url 은 20,000 케이스
 * (길이 0~39 랜덤 바이트) 불일치 0, utf8 은 전 코드포인트 1,112,064개 + 짝 없는
 * 서로게이트 7종 불일치 0(tests/unit/bytes.test.ts 가 이 대조를 붙박이로 돌린다).
 *
 * ★ **정규식 `replace` 를 쓰지 않는다**(알파벳 테이블 직접 인덱싱만). 이유는 순수성
 *   가드(tools/check-monorepo.mjs)의 `stripJsComments` 가 정규식 리터럴을 인식하지
 *   못해서다 — 소스에 `.replace(/\//g, "_")` 가 있으면 `/\//` 의 3·4번째 문자 `//` 를
 *   줄 주석으로 읽고 그 줄 나머지를 통째로 지운다(crit-A-ports §A-2, node strip2.mjs
 *   로 재현). 그러면 그 줄에 금지 토큰이 있어도 가드에 영영 안 보인다. 테이블 인덱싱은
 *   `+`/`/` 를 애초에 만들지 않으므로 치환 자체가 필요 없고, 가드가 이 파일을 온전히 본다.
 *
 * 이번 트랙에서 **하지 않은 것**: base64url **디코더**(`base64UrlDecode`)와 `svgDataUri`
 *   겸용. 계획서 245줄이 base64 파일에 그 겸용을 요구했으나(crit §N-1), 도메인 안에
 *   디코드 호출부가 없고 디코더 소비처(`runtime-release-environment.ts:23`·
 *   `share-key-readiness.ts:10` 의 `atob`, `ticket-art.ts:288` 의 `btoa(unescape(...))`)는
 *   전부 `src/` 트리라 트랙 A 범위 밖이다. 후속 트랙/M4 로 이월한다.
 */

/**
 * unpadded base64url 알파벳. 62·63번이 `+`/`/` 가 아니라 `-`/`_` 라 URL 안전하고,
 * 패딩(`=`)을 붙이지 않아 후처리 치환이 필요 없다(원본 canonical.ts:20 의
 * `.replace(/=+$/u,"")` 와 동치).
 */
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * 바이트열 → unpadded base64url 문자열.
 *
 * 3바이트(24비트)를 4개의 6비트 조각으로 자른다. 마지막 그룹이 1~2바이트면 만들 수
 * 있는 조각만 낸다(패딩 없음). 인덱스는 항상 0~63 이라 `!` 로 좁힌다 —
 * `noUncheckedIndexedAccess`(tsconfig.base.json:23) 아래에서 문자열 인덱싱은
 * `string | undefined` 이기 때문(crit §N-2).
 */
export function base64Url(bytes: Uint8Array): string {
  let out = "";
  const length = bytes.length;
  for (let i = 0; i < length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const remaining = length - i;
    out += BASE64URL[b0 >> 2]!;
    out += BASE64URL[((b0 & 0b11) << 4) | (b1 >> 4)]!;
    if (remaining > 1) out += BASE64URL[((b1 & 0b1111) << 2) | (b2 >> 6)]!;
    if (remaining > 2) out += BASE64URL[b2 & 0b111111]!;
  }
  return out;
}

/**
 * UTF-16 문자열을 코드포인트로 걸으며 콜백에 넘긴다. 짝 없는 서로게이트는
 * U+FFFD(대체 문자)로 바꾼다 — WHATWG `TextEncoder` 와 동일한 처리다.
 *
 * `charCodeAt` 은 메서드 호출이라 인덱스 접근이 아니고 `number` 를 돌려주므로
 * `noUncheckedIndexedAccess` 세금이 없다.
 */
function eachCodePoint(value: string, emit: (codePoint: number) => void): void {
  for (let i = 0; i < value.length; i += 1) {
    let codePoint = value.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      // 상위 서로게이트 — 뒤따르는 하위 서로게이트와 짝을 이뤄야 astral 코드포인트다.
      const next = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      } else {
        codePoint = 0xfffd; // 짝 없는 상위 서로게이트
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd; // 짝 없는 하위 서로게이트
    }
    emit(codePoint);
  }
}

/** 코드포인트 하나가 UTF-8 로 몇 바이트인가. */
function utf8Width(codePoint: number): number {
  return codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
}

/** 문자열 → UTF-8 바이트열. `new TextEncoder().encode(value)` 와 바이트 동일. */
export function utf8Encode(value: string): Uint8Array {
  const out: number[] = [];
  eachCodePoint(value, (codePoint) => {
    if (codePoint <= 0x7f) {
      out.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      out.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      out.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      out.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  });
  return Uint8Array.from(out);
}

/**
 * 문자열의 UTF-8 바이트 길이. **바이트 배열을 만들지 않는다** — canonical.ts:124 의
 * 96 KiB 경계 판정은 길이만 필요하고, 100곡 페이로드에서 배열 할당을 아낀다.
 * `new TextEncoder().encode(value).byteLength` 와 항상 같다.
 */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  eachCodePoint(value, (codePoint) => {
    bytes += utf8Width(codePoint);
  });
  return bytes;
}
