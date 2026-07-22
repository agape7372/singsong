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
});
