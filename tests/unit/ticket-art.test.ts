import { describe, expect, it } from "vitest";
import {
  TICKET_PALETTE,
  compositionSvg,
  formatMinuteRange,
  formatWon,
  formatWonRange,
  halftoneTextureSvg,
  punchColumnStyle,
  svgDataUri,
  ticketSerial,
} from "@/features/ticket/ticket-art";

describe("ticket art", () => {
  it("resolves palette keys into literal hex", () => {
    const svg = compositionSvg({ width: 540, height: 290, idPrefix: "test" });
    expect(svg).toContain(TICKET_PALETTE.accent);
    expect(svg).toContain(TICKET_PALETTE.money);
    // 팔레트 키가 그대로 남으면 래스터라이저가 검정으로 떨어뜨린다.
    expect(svg).not.toMatch(/fill="(ink|accent|money|paper)"/u);
    expect(svg).not.toContain("var(--");
  });

  it("keeps ids unique per prefix so one document can hold several tickets", () => {
    const first = compositionSvg({ width: 100, height: 60, idPrefix: "a" });
    const second = compositionSvg({ width: 100, height: 60, idPrefix: "b" });
    expect(first).toContain("a-composition-grain");
    expect(second).toContain("b-composition-grain");
    expect(first).not.toContain("b-composition-grain");
  });

  it("keeps the halftone cell proportional to the glyph so every renderer matches", () => {
    // 화면 티켓은 150px 글자에 2.6px 셀을 쓴다. 타일 크기가 달라져도 그 비율은 같아야 한다.
    const screenLike = halftoneTextureSvg({ sizePx: 150, idPrefix: "t" });
    const bigger = halftoneTextureSvg({ sizePx: 300, idPrefix: "t" });
    expect(screenLike).toContain('width="2.6"');
    expect(bigger).toContain('width="5.2"');
  });

  it("wraps svg into a data uri", () => {
    const uri = svgDataUri("<svg/>");
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(Buffer.from(uri.split(",")[1]!, "base64").toString("utf8")).toBe("<svg/>");
  });

  it("places punch columns on the requested edge", () => {
    expect(punchColumnStyle("left")).toMatchObject({ left: "7.2px", width: "8px" });
    expect(punchColumnStyle("right")).toMatchObject({ right: "7.2px" });
  });

  it("formats money with the won sign and an en dash range", () => {
    expect(formatWon(8_000)).toBe("₩8,000");
    expect(formatWonRange(6_000, 6_000)).toBe("₩6,000");
    expect(formatWonRange(6_000, 8_000)).toBe("₩6,000–₩8,000");
  });

  it("rounds minutes outward in five minute steps", () => {
    expect(formatMinuteRange(900, 1_800)).toBe("15–30분");
    expect(formatMinuteRange(901, 1_799)).toBe("15–30분");
    expect(formatMinuteRange(900, 900)).toBe("15분");
  });

  it("prefers the fingerprint for the serial and falls back to the artwork seed", () => {
    expect(ticketSerial("d5220e336fabcdef", "seed-value")).toBe("D5220E336F");
    expect(ticketSerial(undefined, "seed-value-1234")).toBe("seed-value");
  });
});
