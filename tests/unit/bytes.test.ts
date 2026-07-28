import { describe, expect, it } from "vitest";
import { base64Url, utf8ByteLength, utf8Encode } from "@/domain/bytes";

/**
 * 순수 인코더의 정당성은 **기존 전역 경로(`btoa`/`TextEncoder`)와 바이트가 같다**는 것뿐이다.
 * 그래서 이 스위트는 두 오라클을 여기서 재구성해 직접 대조한다. 골든 상수를 손으로 적지
 * 않는 이유: 상수는 드리프트하지만 오라클 대조는 인코딩 규칙이 바뀌면 즉시 빨간불이 된다.
 */

/** 원본 canonical.ts:17-21 이 쓰던 btoa 경로. 이게 참값이다. */
function btoaBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

const textEncoder = new TextEncoder();

/** 결정적 PRNG(mulberry32) — 랜덤 바이트 대조를 재현 가능하게 고정한다. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("base64url 순수 인코더", () => {
  it("16바이트 0 은 22자 seed 로 인코딩된다(아트워크 시드 계약)", () => {
    // generateArtworkSeed(new Uint8Array(16)) 이 기대하는 값. 패딩 없는 22자.
    expect(base64Url(new Uint8Array(16))).toBe("AAAAAAAAAAAAAAAAAAAAAA");
    expect(base64Url(new Uint8Array(16))).toHaveLength(22);
  });

  it("`+`/`/` 를 만들 수 있는 바이트에서 URL 안전 문자만 낸다", () => {
    // 0xFB,0xFF,0xBF → 표준 base64 라면 '+' 와 '/' 가 나온다. base64url 은 '-'·'_'.
    const encoded = base64Url(new Uint8Array([0xfb, 0xff, 0xbf]));
    expect(encoded).toBe(btoaBase64Url(new Uint8Array([0xfb, 0xff, 0xbf])));
    expect(encoded).not.toMatch(/[+/=]/u);
  });

  it("btoa 경로와 바이트 동일 — 길이 0~39, 시드당 여러 케이스", () => {
    const random = mulberry32(0x51_5f_60_2a);
    for (let length = 0; length <= 39; length += 1) {
      for (let trial = 0; trial < 64; trial += 1) {
        const bytes = Uint8Array.from({ length }, () => Math.floor(random() * 256));
        expect(base64Url(bytes)).toBe(btoaBase64Url(bytes));
      }
    }
  });
});

describe("utf8 순수 인코더", () => {
  /** 대조 대상 문자열 집합: 소진 구간 + 성긴 표본 + astral + 짝 없는 서로게이트. */
  function* sampleStrings(): Generator<string> {
    // BMP 앞부분 소진(ASCII·라틴·결합·한글 자모 시작 직전까지).
    for (let cp = 0; cp <= 0x2000; cp += 1) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      yield String.fromCodePoint(cp);
    }
    // 전 범위 성긴 표본(서로게이트 제외).
    for (let cp = 0x2001; cp <= 0x10ffff; cp += 137) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      yield String.fromCodePoint(cp);
    }
    // astral·혼합.
    yield "😀";
    yield "가나다 abc 😀𝕊 ₩–";
    // 짝 없는 서로게이트 7종(spec §4-D). TextEncoder 와 마찬가지로 U+FFFD 로 떨어져야 한다.
    yield "\uD800";
    yield "\uDFFF";
    yield "a\uD83Db";
    yield "\uD83D\uD83D";
    yield "\uDC00\uD800";
    yield "가\uD800나";
    yield "\u{1F600}";
  }

  it("utf8Encode 가 TextEncoder 와 바이트 동일(짝 없는 서로게이트→U+FFFD 포함)", () => {
    for (const value of sampleStrings()) {
      expect(Array.from(utf8Encode(value))).toEqual(Array.from(textEncoder.encode(value)));
    }
  });

  it("utf8ByteLength 가 TextEncoder().encode().byteLength 와 항상 같다", () => {
    for (const value of sampleStrings()) {
      expect(utf8ByteLength(value)).toBe(textEncoder.encode(value).byteLength);
    }
  });

  it("짝 없는 서로게이트는 U+FFFD(EF BF BD)로 바뀐다", () => {
    expect(Array.from(utf8Encode("\uD800"))).toEqual([0xef, 0xbf, 0xbd]);
    // 정상 페어는 4바이트 그대로.
    expect(Array.from(utf8Encode("\u{1F600}"))).toEqual([0xf0, 0x9f, 0x98, 0x80]);
  });
});
