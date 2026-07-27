import { describe, expect, it } from "vitest";
import {
  extractChosung,
  isValidSearchQuery,
  normalizeSearchText,
  rankFixtureCatalog,
  tokenizeSearchQuery,
} from "@/domain/catalog";

const catalog = [
  { id: "b", title: "분홍 영수증", artist: "모서리", codes: ["92002"] },
  { id: "a", title: "밤의 체크인", artist: "유리별", codes: ["91001"] },
  { id: "c", title: "체크인 밤", artist: "다른별", codes: ["93003"] },
] as const;

describe("fixture catalog ranking", () => {
  it("normalizes NFC, whitespace and punctuation", () => {
    expect(normalizeSearchText("  밤!  체크인  ")).toBe("밤 체크인");
    expect(tokenizeSearchQuery("체크인 밤 밤")).toEqual(["밤", "체크인"]);
  });

  it("requires every token and is independent of token order", () => {
    const first = rankFixtureCatalog(catalog, "밤 체크인").map(({ id }) => id);
    const second = rankFixtureCatalog(catalog, "체크인 밤").map(({ id }) => id);
    expect(first).toEqual(second);
    expect(first).toEqual(["a", "c"]);
  });

  it("ranks exact number and exact title before broader matches with stable ids", () => {
    expect(rankFixtureCatalog(catalog, "91001").map(({ id }) => id)).toEqual(["a"]);
    expect(rankFixtureCatalog(catalog, "분홍 영수증").map(({ id }) => id)).toEqual(["b"]);
  });

  it("matches Korean initial consonants and enforces text/number query shapes", () => {
    expect(extractChosung("밤의 체크인")).toBe("ㅂㅇ ㅊㅋㅇ");
    expect(rankFixtureCatalog(catalog, "ㅂㅇ ㅊㅋㅇ").map(({ id }) => id)).toEqual(["a"]);
    expect(isValidSearchQuery("밤")).toBe(false);
    expect(isValidSearchQuery("밤의")).toBe(true);
    expect(isValidSearchQuery("9")).toBe(true);
    expect(isValidSearchQuery("1234567")).toBe(false);
    expect(isValidSearchQuery("가".repeat(60))).toBe(true);
    expect(isValidSearchQuery("가".repeat(61))).toBe(false);
  });

  it("lowercases without a locale round-trip (toLowerCase, not toLocaleLowerCase)", () => {
    // 전각 ＢＴＳ 는 전각 소문자 ｂｔｓ(U+FF42/54/53)가 된다 — ASCII "bts" 가 아니다.
    // \p{P}\p{S} 는 전각 라틴 문자를 안 먹는다(카테고리 Lu/Ll). (실측 node)
    expect(normalizeSearchText("ＢＴＳ Dynamite")).toBe("ｂｔｓ dynamite");
    // İ(U+0130) → i + U+0307 COMBINING DOT ABOVE. 소문자화가 normalize("NFC") 뒤라
    // 이 조합은 재정규화되지 않아 결과가 NFC 가 아니다(U+0069 U+0307 …, 9 코드포인트).
    expect(normalizeSearchText("İSTANBUL")).toBe("i̇stanbul");
  });

  it("breaks rank ties by code unit order, not ICU collation", () => {
    // 두 항목 모두 제목이 질의와 정확히 일치 → score 0 동점 → id 타이브레이커가 결정.
    // 코드유닛: 'F'(0x46) < 'f'(0x66) → FX-2 먼저. localeCompare 였다면 fx-1 이 앞이었다.
    const items = [
      { id: "fx-1", title: "같은제목", artist: "가수", codes: [] },
      { id: "FX-2", title: "같은제목", artist: "가수", codes: [] },
    ] as const;
    expect(rankFixtureCatalog(items, "같은제목").map(({ id }) => id)).toEqual(["FX-2", "fx-1"]);
  });
});
