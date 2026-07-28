/**
 * 표시용 포맷터 — 원화·분 범위·만료 시각.
 *
 * **왜 `Intl` 을 쓰지 않는가.** Hermes 는 Intl 을 켜서 빌드하지만
 * (`react-native/ReactAndroid/hermes-engine/build.gradle.kts:358`,
 *  `react-native/sdks/hermes-engine/utils/build-apple-framework.sh:103`)
 * 구현은 플랫폼 ICU 위임이다 — Android ICU4J / Apple NSNumberFormatter / 랜딩은 Node ICU.
 * 세 곳이 같은 바이트를 낸다는 보장이 없고, 티켓 폰트는 **서브셋**이라(계획 §3.3)
 * 예상 못 한 구분자(U+00A0)나 전각 원화(U+FFE6)가 한 번 나오면 티켓에 두부가 뜬다.
 * 여기서 내는 코드포인트 집합을 유한하게 못 박아야 그 charset 테스트가 성립한다.
 *
 * 이 파일은 **import 가 없다**. 모듈 평가 중 throw 할 수 있는 표현식이 없다는 뜻이고,
 * 그게 `Intl.NumberFormat` 을 모듈 스코프 const 로 들고 있던 4벌
 * (`ticket-art.ts:295` · `ticket-card.tsx:9` · `ticket-back.tsx:3` · `calculation-strip.tsx:15`)
 * 을 걷어낸 이유다 — 그 4벌 중 하나라도 기기에서 throw 하면 첫 사용이 아니라
 * 모듈 로드가 화이트스크린이 된다.
 *
 * 출력 charset: `0-9` `,` `-` `₩`(U+20A9) `–`(U+2013) `분` `오전` `오후` `.` `:` ` `
 */

/** U+20A9 WON SIGN. 전각 U+FFE6 이 **아니다** — 서브셋 cmap 과 골든이 이 코드포인트에 묶인다. */
const WON_SIGN = "₩";

/** U+2013 EN DASH. 저장소 전역 범위 조인이 이 글자다(실측: 렌더 소스의 dash 는 전부 U+2013, U+2014 는 주석 산문뿐). */
const EN_DASH = "–";

/** 한국은 1988 년 이후 서머타임이 없다. KST 는 상시 UTC+9 고정이라 tz 데이터가 필요 없다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 정수 문자열에 세 자리 구분 쉼표.
 *
 * 인덱싱(`digits[i]`) 대신 `slice` 를 쓴다 — `tsconfig.base.json:23`
 * `noUncheckedIndexedAccess: true` 아래에서 인덱싱은 `string | undefined` 라
 * `+=` 가 TS2365 로 깨진다. 정규식 lookahead 도 피한다: Hermes 정규식은 정상이지만
 * 이 함수는 폴백이 아니라 **정본**이라, 엔진 차이를 계약에서 아예 빼는 편이 싸다.
 */
function groupThousands(whole: string) {
  let out = "";
  for (let end = whole.length; end > 0; end -= 3) {
    const start = Math.max(0, end - 3);
    out = whole.slice(start, end) + (out ? `,${out}` : "");
  }
  return out;
}

/**
 * `8000` → `₩8,000`. 음수는 `-₩1,500`(부호가 기호 **앞**, ICU 와 동일).
 *
 * 비유한값·2^53 초과는 `RangeError`. 삼키지 않는 이유: 도메인 계산은
 * `assertSafeResult`(`calculation.ts:24-32`)로 비음수 안전정수만 통과시키고 상한은
 * `validation.ts:4-13`(`maxMoneyWon`·`maxTracks`)이 막아서 제품 경로에서는 도달하지
 * 않는다. 다만 저장소 읽기 경로가 전부 재검증하지는 않으므로, 여기서 삼키면 상류가
 * 깨졌을 때 `₩NaN`·`₩∞`(U+221E)가 서브셋에 없는 글자를 티켓에 그려 넣는다. throw 는
 * 그 조용한 오염 대신 오류 화면으로 떨어뜨리는 방어선이다 — 도달했다면 상류가 깨진 것이다.
 *
 * ICU 와 의도적으로 다른 유일한 점: **0 으로 반올림되는 음수**(`-0`·`-0.4` 등) → `₩0`
 * (ICU 는 `-₩0`). 실측(270,009 건 대조)에서 갈라지는 건 이 경우뿐이다.
 */
export function formatWon(value: number) {
  // Math.round 는 음수에서 half-ceil 이라 절댓값에 걸어 half-expand(=ICU 기본)를 맞춘다.
  const magnitude = Math.round(Math.abs(value));
  if (!Number.isSafeInteger(magnitude)) {
    throw new RangeError(`formatWon: 표시할 수 없는 금액 ${value}`);
  }
  const sign = value < 0 && magnitude !== 0 ? "-" : "";
  return `${sign}${WON_SIGN}${groupThousands(String(magnitude))}`;
}

/** 두 값이 같으면 한 번만 쓴다. `₩6,000–₩8,000`. */
export function formatWonRange(lowWon: number, highWon: number) {
  const low = formatWon(lowWon);
  return lowWon === highWon ? low : `${low}${EN_DASH}${formatWon(highWon)}`;
}

/**
 * 초를 받아 5분 단위로 낮은 쪽은 내리고 높은 쪽은 올린다. `15–30분`. OG 라우트가 이걸 쓴다.
 *
 * 반올림 상수(300·5)는 `roundDurationOutward`(`calculation.ts:46-52`)와 **같은 식**이다.
 * 그 함수를 import 해 없애지 않는 이유: `calculation.ts → validation.ts → zod` 를 끌고 와
 * 이 파일의 "import 0 · 모듈 평가 중 throw 불가" 리프 성질이 그 자리에서 깨진다. 대신 두
 * 벌이 조용히 갈라지지 못하도록 동값 테스트(`tests/unit/format.test.ts`)로 묶어 둔다.
 */
export function formatMinuteRange(lowSec: number, highSec: number) {
  const low = Math.floor(lowSec / 300) * 5;
  const high = Math.ceil(highSec / 300) * 5;
  return low === high ? `${low}분` : `${low}${EN_DASH}${high}분`;
}

/**
 * 이미 5분 단위로 반올림된 **분**을 받아 같은 표기를 낸다. `5–15분` / `10분`.
 *
 * 화면(`calculation-strip.tsx`·`ticket-back.tsx`)은 `roundDurationOutward` 가 만든
 * `displayDuration`/`lowMinutes` 를 이미 들고 있어서 초→분 반올림을 두 번 하지 않는다.
 * `formatMinuteRange`(초 입력)와 이 함수는 `formatMinuteRange(sec) ===
 * formatMinuteSpan(roundDurationOutward(sec))` 로 묶여 있다(동값 테스트).
 */
export function formatMinuteSpan(lowMinutes: number, highMinutes: number) {
  return lowMinutes === highMinutes ? `${lowMinutes}분` : `${lowMinutes}${EN_DASH}${highMinutes}분`;
}

/**
 * ISO 문자열 → KST 달력 필드. 파싱 실패는 null(호출부가 빈 문자열로 처리).
 *
 * 입력은 **절대 시각**(`Z`/오프셋 포함, 예: `expiresAt`·`createdAt`)이어야 한다.
 * 오프셋 없는 ISO 는 `Date.parse` 가 로컬로 해석해 호스트 tz 를 타지만, 우리 시각은
 * 전부 DB/`toISOString()` 산출물이라 항상 오프셋이 붙는다.
 */
function kstFields(iso: string) {
  const epoch = Date.parse(iso);
  if (!Number.isFinite(epoch)) return null;
  // UTC 게터로 읽으면 호스트 tz 를 타지 않는다 — Hermes·Node·브라우저가 같은 값을 낸다.
  const shifted = new Date(epoch + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** `2099. 7. 22.` — 오늘의 `toLocaleDateString("ko-KR")`(Asia/Seoul) 출력과 바이트 동일. */
export function formatKstDate(iso: string) {
  const fields = kstFields(iso);
  return fields ? `${fields.year}. ${fields.month}. ${fields.day}.` : "";
}

/**
 * `2099. 7. 22. 오전 9:00` — 오늘의 `toLocaleString("ko-KR")` 에서 **초만 뺀 것**.
 * 만료 시각에 초는 정보가 아니고, 자릿수가 줄면 320dp 에서 줄바꿈이 덜 난다.
 */
export function formatKstDateTime(iso: string) {
  const fields = kstFields(iso);
  if (!fields) return "";
  const meridiem = fields.hour < 12 ? "오전" : "오후";
  const hour12 = fields.hour % 12 === 0 ? 12 : fields.hour % 12;
  const minute = String(fields.minute).padStart(2, "0");
  return `${fields.year}. ${fields.month}. ${fields.day}. ${meridiem} ${hour12}:${minute}`;
}
