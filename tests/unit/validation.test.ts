import { describe, expect, it } from "vitest";
import {
  DomainValidationError,
  assertValidKaraokeCode,
  assertValidTrackText,
  normalizeTrackText,
  parseSharedSnapshot,
  unicodeCodePointLength,
} from "@/domain/validation";

describe("strict shared text validation", () => {
  it("counts Unicode code points rather than UTF-16 units", () => {
    expect(unicodeCodePointLength("🎤".repeat(80))).toBe(80);
    expect(() => assertValidTrackText("🎤".repeat(80), "title")).not.toThrow();
    expect(() => assertValidTrackText("🎤".repeat(81), "title")).toThrow(DomainValidationError);
  });

  it("normalizes benign local input but rejects non-canonical public text and bidi controls", () => {
    expect(normalizeTrackText("  cafe\u0301   song ")).toBe("café song");
    expect(() => assertValidTrackText(" cafe ", "title")).toThrow(/NFC and single-line/u);
    expect(() => assertValidTrackText("safe\u202eevil", "title")).toThrow(/forbidden/u);
    expect(() => assertValidTrackText("line\nbreak", "title")).toThrow(/forbidden/u);
  });

  it("accepts only short ASCII-digit karaoke codes", () => {
    expect(() => assertValidKaraokeCode("012345")).not.toThrow();
    expect(() => assertValidKaraokeCode("１２３")).toThrow();
    expect(() => assertValidKaraokeCode("1234567")).toThrow();
  });

  it("rejects unknown public payload keys", () => {
    expect(() =>
      parseSharedSnapshot({
        schemaVersion: 1,
        artworkSeed: "AAAAAAAAAAAAAAAAAAAAAA",
        unexpected: true,
        items: [],
        calculation: {},
      }),
    ).toThrow(/schema/u);
  });
});
