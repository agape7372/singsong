import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { contrastRatio, parseHex, ratio2, relativeLuminance, WCAG } from "../src/contrast";
import {
  CONSTANT_TOKENS,
  FORCED_COLOR_TOKENS,
  RESPONSIVE_OVERRIDES,
  THEMED_TOKENS,
  TICKET_CARD_ALIASES,
} from "../src/generated";
import { collectTokenNames, parseTokenBlocks } from "../src/parse-globals";

// `process.cwd()` 로 잡으면 안 된다 — vitest 는 project root 로 chdir 하지 않아서
// 루트에서 돌릴 때와 패키지에서 돌릴 때 값이 달라진다. 파일 위치를 기준으로 올라간다.
const GLOBALS = path.resolve(import.meta.dirname, "..", "..", "..", "src", "app", "globals.css");
const css = readFileSync(GLOBALS, "utf8");

describe("생성물이 globals.css 와 어긋나지 않는다", () => {
  it("커밋된 토큰 집합이 CSS 에서 다시 파싱한 것과 같다", () => {
    // 이 테스트가 드리프트 방지의 전부다. CSS 만 고치고 재생성을 잊으면 여기서 깨진다.
    const fromCss = new Set(collectTokenNames(css));
    const fromGenerated = new Set([
      ...Object.keys(THEMED_TOKENS),
      ...Object.keys(CONSTANT_TOKENS),
      ...Object.keys(TICKET_CARD_ALIASES),
      ...Object.values(RESPONSIVE_OVERRIDES).flatMap((group) => Object.keys(group)),
      ...Object.keys(FORCED_COLOR_TOKENS),
    ]);
    expect([...fromGenerated].sort()).toEqual([...fromCss].sort());
  });

  it("고유 토큰 56개 · 선언 102개 — 계획서의 '토큰 102개' 는 선언 수였다", () => {
    const blocks = parseTokenBlocks(css);
    const declarations = blocks.reduce((sum, block) => sum + block.declarations.size, 0);
    expect(collectTokenNames(css)).toHaveLength(56);
    expect(declarations).toBe(102);
  });

  it("다크에서 재선언되는 토큰은 전부 라이트에도 있다", () => {
    // 다크에만 있는 토큰은 라이트에서 상속돼 정의되지 않은 값을 참조하게 된다.
    const blocks = parseTokenBlocks(css);
    const light = blocks.find((block) => block.context === ":root")!;
    const dark = blocks.find((block) => block.context.includes("prefers-color-scheme: dark"))!;
    const orphans = [...dark.declarations.keys()].filter((name) => !light.declarations.has(name));
    expect(orphans).toEqual([]);
  });

  it("티켓 팔레트를 새로 정의하지 않는다 — 정본은 ticket-artwork.json 이다", () => {
    // `.ticket-card` 별칭은 `--ticket-*` 변수를 다시 부르는 이름일 뿐이어야 한다.
    // 여기에 리터럴 색이 박히면 팔레트 정본이 셋이 된다.
    const literals = Object.entries(TICKET_CARD_ALIASES).filter(([, value]) =>
      /#[0-9a-fA-F]{3,8}\b/.test(value),
    );
    expect(literals).toEqual([]);
  });
});

describe("대비비", () => {
  it("WCAG 참조값을 재현한다", () => {
    // 검산: 순수 흰검은 정확히 21:1, 같은 색끼리는 1:1.
    expect(ratio2("#ffffff", "#000000")).toBe(21);
    expect(ratio2("#777777", "#777777")).toBe(1);
    // 인자 순서 무관.
    expect(contrastRatio("#ffffff", "#123456")).toBeCloseTo(
      contrastRatio("#123456", "#ffffff"),
      12,
    );
  });

  it("상대 휘도 정의를 따른다", () => {
    expect(relativeLuminance(parseHex("#ffffff"))).toBeCloseTo(1, 12);
    expect(relativeLuminance(parseHex("#000000"))).toBe(0);
    // 0.04045 임계 아래 선형 구간: 10/255 = 0.039216 ≤ 0.04045 → 0.039216/12.92
    expect(relativeLuminance([10, 10, 10])).toBeCloseTo(0.0030357, 6);
  });

  it("3자리 hex 를 6자리로 편다", () => {
    expect(parseHex("#abc")).toEqual(parseHex("#aabbcc"));
  });

  it("hex 가 아니면 거부한다", () => {
    expect(() => parseHex("rgb(0,0,0)")).toThrow(/6자리 hex/);
  });
});

describe("실제 팔레트 대비 — 값을 고정한다", () => {
  const light = {
    canvas: THEMED_TOKENS["--canvas"].light,
    accentText: THEMED_TOKENS["--accent-text"].light,
    accentFill: THEMED_TOKENS["--accent-fill"].light,
    borderControl: THEMED_TOKENS["--border-control"].light,
    moneyText: THEMED_TOKENS["--money-text"].light,
    inkMuted: THEMED_TOKENS["--ink-muted"].light,
    onAccent: THEMED_TOKENS["--on-accent"].light,
    ink: THEMED_TOKENS["--ink"].light,
    ticketPaper: THEMED_TOKENS["--ticket-paper"].light,
  };

  // 계획서 §3.5 가 실측이라고 적은 다섯 쌍. 독립 재계산 결과 전부 일치했다.
  it.each([
    ["accentText/canvas", light.accentText, light.canvas, 4.6],
    ["borderControl/canvas", light.borderControl, light.canvas, 3.92],
    ["moneyText/canvas", light.moneyText, light.canvas, 5.97],
    ["inkMuted/canvas", light.inkMuted, light.canvas, 5.77],
    ["onAccent/accentFill", light.onAccent, light.accentFill, 5.39],
  ])("%s = %#", (_name, a, b, expected) => {
    expect(ratio2(a, b)).toBe(expected);
  });

  it("본문 잉크는 AA 를 여유 있게 넘는다", () => {
    expect(contrastRatio(light.ink, light.canvas)).toBeGreaterThan(WCAG.aaNormal);
  });

  it("borderControl 은 비텍스트 기준(3:1)만 넘으면 된다", () => {
    // 컨트롤 경계선이라 일반 텍스트 기준을 적용하지 않는다.
    expect(contrastRatio(light.borderControl, light.canvas)).toBeGreaterThan(WCAG.aaNonText);
    expect(contrastRatio(light.borderControl, light.canvas)).toBeLessThan(WCAG.aaNormal);
  });

  /**
   * ★ 알려진 미달 1건. 값을 고정하되 red 테스트로 커밋하지 않는다 —
   * 상시 빨간 스위트는 곧 무시되고, 그러면 다음 진짜 회귀도 같이 묻힌다.
   * 대신 (a) 현재 비율을 못박고 (b) 이 쌍이 큰 텍스트에서만 허용된다는 사실을
   * 별도 테스트로 명시한다. 값 조정 또는 사용처 제한은 사용자 게이트(계획 §5-7)다.
   */
  it("accentText on ticket-paper 는 4.29 — 일반 텍스트 AA 미달", () => {
    expect(ratio2(light.accentText, light.ticketPaper)).toBe(4.29);
    expect(contrastRatio(light.accentText, light.ticketPaper)).toBeLessThan(WCAG.aaNormal);
  });

  it("그 쌍은 큰 텍스트 기준으로는 통과한다 — 그래서 티켓 키커에만 쓸 수 있다", () => {
    expect(contrastRatio(light.accentText, light.ticketPaper)).toBeGreaterThan(WCAG.aaLarge);
  });
});
