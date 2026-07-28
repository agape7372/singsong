import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARTWORK, TICKET_PALETTE } from "@/features/ticket/ticket-art";

/**
 * 티켓 그림은 `ticket-artwork.json` 한 곳에서 나온다. 다만 CSS는 JSON을 import할 수 없어
 * `globals.css`의 `--ticket-*` 토큰이 유일하게 손으로 맞춰야 하는 사본이다. 이 테스트가
 * 그 둘을 묶는다.
 */

const cssPath = path.join(process.cwd(), "src", "app", "globals.css");

async function readCss() {
  return readFile(cssPath, "utf8");
}

/** 첫 선언 = `:root`의 라이트 값. 다크 오버라이드는 그 뒤 미디어쿼리에 온다. */
function declaredValue(css: string, name: string) {
  const match = new RegExp(`${name}:\\s*([^;]+);`, "u").exec(css);
  return match?.[1]?.trim();
}

function darkValue(css: string, name: string) {
  const all = [...css.matchAll(new RegExp(`${name}:\\s*([^;]+);`, "gu"))];
  return all[1]?.[1]?.trim();
}

describe("ticket artwork contract", () => {
  it("keeps the in-app ticket on the user theme while PNG/OG stay light", async () => {
    const css = await readCss();
    // 인앱 티켓은 사용자 테마를 따른다(정본 §9-2). 다크 오버라이드가 사라지면
    // 어두운 화면에 흰 종이만 떠 있게 된다.
    for (const token of ["--ticket-paper", "--ticket-ink", "--ticket-canvas"]) {
      const light = declaredValue(css, token);
      const dark = darkValue(css, token);
      expect(dark, `${token} 다크 오버라이드`).toBeTruthy();
      expect(dark, `${token} 는 라이트와 달라야 한다`).not.toBe(light);
    }
  });

  it("mirrors the artwork palette into the CSS ticket scope", async () => {
    const css = await readCss();
    const expected: Record<string, string> = {
      "--ticket-paper": TICKET_PALETTE.paper,
      "--ticket-ink": TICKET_PALETTE.ink,
      "--ticket-ink-muted": TICKET_PALETTE.inkMuted,
      "--ticket-accent-fill": TICKET_PALETTE.accent,
      "--ticket-accent-text": TICKET_PALETTE.accentText,
      "--ticket-money-text": TICKET_PALETTE.money,
      "--ticket-border-control": TICKET_PALETTE.border,
      "--ticket-canvas": TICKET_PALETTE.hole,
    };

    for (const [token, value] of Object.entries(expected)) {
      expect(declaredValue(css, token), token).toBe(value);
    }
    expect(declaredValue(css, "--radius-ticket")).toBe(`${ARTWORK.radiusPx}px`);
  });

  it("never references a CSS variable that nothing defines", async () => {
    const css = await readCss();
    const defined = new Set(
      [...css.matchAll(/^\s*(--[a-z0-9-]+):/gmu)].map((match) => match[1] as string),
    );
    // `var(--x, fallback)` 는 정의가 없어도 동작하므로 폴백 없는 참조만 본다.
    const used = new Set(
      [...css.matchAll(/var\((--[a-z0-9-]+)\s*\)/gu)].map((match) => match[1] as string),
    );
    const missing = [...used].filter((name) => !defined.has(name)).sort();

    expect(missing, `정의 없이 쓰인 CSS 변수: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps every shape fill inside the palette", () => {
    const keys = new Set(Object.keys(TICKET_PALETTE));
    for (const shape of ARTWORK.composition.shapes) {
      expect(keys.has(shape.fill), shape.fill).toBe(true);
    }
  });
});
