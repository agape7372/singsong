/**
 * 한국어 조사 자동 선택.
 *
 * 곡 제목은 사용자 데이터라 받침 유무를 미리 알 수 없다. 문구에 조사를 하드코딩하면
 * ‘우리의 대기번호을’ 같은 문장이 그대로 사용자에게 나간다.
 */

type JosaPair = "을/를" | "이/가" | "은/는" | "과/와" | "으로/로";

const PAIRS: Record<JosaPair, readonly [withFinal: string, withoutFinal: string]> = {
  "을/를": ["을", "를"],
  "이/가": ["이", "가"],
  "은/는": ["은", "는"],
  "과/와": ["과", "와"],
  // 로/으로는 ㄹ 받침도 ‘로’를 쓴다(예: 서울로).
  "으로/로": ["으로", "로"],
};

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

// 숫자 읽기의 종성 유무: 0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 → 받침 있음.
const DIGITS_WITH_FINAL = new Set(["0", "1", "3", "6", "7", "8"]);

// 알파벳 이름 읽기 기준으로 받침이 생기는 글자(L 엘, M 엠, N 엔, R 아르, ...).
const LATIN_WITH_FINAL = new Set(["l", "m", "n", "r", "g", "b", "d", "k", "p", "t", "h"]);

// 따옴표·괄호·공백 등 장식 문자는 건너뛰고 실제 글자를 찾는다.
function lastLetter(word: string): string | null {
  const letters = Array.from(word.trim()).filter((char) => /[0-9a-zA-Z가-힣]/.test(char));
  return letters.at(-1) ?? null;
}

/** 마지막 유의미한 글자의 받침 유무. 판별 불가하면 null. */
export function hasFinalConsonant(word: string): boolean | null {
  const last = lastLetter(word);
  if (!last) return null;

  const code = last.codePointAt(0)!;
  if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
    return (code - HANGUL_BASE) % 28 !== 0;
  }
  if (/[0-9]/.test(last)) return DIGITS_WITH_FINAL.has(last);
  return LATIN_WITH_FINAL.has(last.toLowerCase());
}

// ㄹ 받침(종성 인덱스 8)은 ‘으로’가 아니라 ‘로’를 쓴다.
function endsWithRieul(word: string): boolean {
  const last = lastLetter(word);
  if (!last) return false;
  const code = last.codePointAt(0)!;
  if (code < HANGUL_BASE || code > HANGUL_LAST) return last.toLowerCase() === "l";
  return (code - HANGUL_BASE) % 28 === 8;
}

/**
 * 단어에 붙일 조사만 돌려준다. 받침을 알 수 없으면 받침 없는 형태를 쓴다
 * (‘를’ 쪽이 어색함이 덜하다).
 */
export function josa(word: string, pair: JosaPair): string {
  const [withFinal, withoutFinal] = PAIRS[pair];
  if (pair === "으로/로" && endsWithRieul(word)) return withoutFinal;
  return hasFinalConsonant(word) ? withFinal : withoutFinal;
}

/** 단어와 조사를 붙여서 돌려준다. */
export function withJosa(word: string, pair: JosaPair): string {
  return `${word}${josa(word, pair)}`;
}
