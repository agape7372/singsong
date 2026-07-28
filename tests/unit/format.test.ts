import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import {
  formatKstDate,
  formatKstDateTime,
  formatMinuteRange,
  formatMinuteSpan,
  formatWon,
  formatWonRange,
} from "@/domain/format";
import { estimateDuration, roundDurationOutward } from "@/domain/calculation";

// 도메인 상한: 시간 요금 최악 총액 ≈ ceil(28965/60)×10,000,000 ≈ 4.83e9 (validation.ts:4-13).
const DOMAIN_MONEY_CAP = 4_830_000_000;

describe("formatWon", () => {
  it("groups thousands with the won sign", () => {
    expect(formatWon(0)).toBe("₩0");
    expect(formatWon(999)).toBe("₩999");
    expect(formatWon(1_000)).toBe("₩1,000");
    expect(formatWon(2_500)).toBe("₩2,500");
    expect(formatWon(8_000)).toBe("₩8,000");
    expect(formatWon(1_234_567)).toBe("₩1,234,567");
  });

  it("pins the exact codepoints — this line catches a full-width ₩(U+FFE6) or NBSP(U+00A0) regression", () => {
    expect([...formatWon(8_000)].map((c) => c.codePointAt(0))).toEqual([
      0x20a9, 0x38, 0x2c, 0x30, 0x30, 0x30,
    ]);
  });

  it("puts a leading minus before the sign, and rounds negatives-toward-zero to ₩0", () => {
    expect(formatWon(-1_500)).toBe("-₩1,500");
    // ICU 와 의도적으로 다른 유일한 경우: 0 으로 반올림되는 음수. ICU 는 -₩0.
    expect(formatWon(-0)).toBe("₩0");
    expect(formatWon(-0.4)).toBe("₩0");
  });

  it("rounds half-expand (matching ICU's default)", () => {
    expect(formatWon(0.4)).toBe("₩0");
    expect(formatWon(0.5)).toBe("₩1");
    expect(formatWon(2.5)).toBe("₩3");
  });

  it("rejects non-finite and above-2^53 values instead of drawing ₩NaN/₩∞", () => {
    expect(() => formatWon(Number.NaN)).toThrow(RangeError);
    expect(() => formatWon(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => formatWon(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
    expect(() => formatWon(1e21)).toThrow(RangeError);
  });

  it("formats the whole domain range without throwing", () => {
    expect(formatWon(DOMAIN_MONEY_CAP)).toBe("₩4,830,000,000");
  });

  it("emits only {₩, comma, minus, 0-9} across the whole domain range (charset closure)", () => {
    const allowed = new Set([
      0x20a9,
      0x2c,
      0x2d,
      ...Array.from({ length: 10 }, (_, i) => 0x30 + i),
    ]);
    fc.assert(
      fc.property(fc.integer({ min: -DOMAIN_MONEY_CAP, max: DOMAIN_MONEY_CAP }), (value) => {
        for (const char of formatWon(value)) {
          expect(allowed.has(char.codePointAt(0)!)).toBe(true);
        }
      }),
    );
  });
});

describe("formatWonRange", () => {
  it("prints one label when the bounds are equal", () => {
    expect(formatWonRange(6_000, 6_000)).toBe("₩6,000");
  });

  it("joins distinct bounds with an en dash (U+2013)", () => {
    const label = formatWonRange(6_000, 8_000);
    expect(label).toBe("₩6,000–₩8,000");
    expect([...label]).toContain("–");
  });
});

describe("formatMinuteRange (seconds in)", () => {
  // ticket-art.test.ts 에서 이관: 초를 5분 단위로 밖으로 반올림한다.
  it("rounds minutes outward in five minute steps", () => {
    expect(formatMinuteRange(900, 1_800)).toBe("15–30분");
    expect(formatMinuteRange(901, 1_799)).toBe("15–30분");
    expect(formatMinuteRange(900, 900)).toBe("15분");
  });
});

describe("formatMinuteSpan (rounded minutes in)", () => {
  it("collapses equal bounds and joins distinct ones with an en dash", () => {
    expect(formatMinuteSpan(10, 10)).toBe("10분");
    expect(formatMinuteSpan(5, 15)).toBe("5–15분");
    expect([...formatMinuteSpan(5, 15)]).toContain("–");
  });

  // C-2: 초 반올림(formatMinuteRange)과 분 표기(formatMinuteSpan∘roundDurationOutward)가
  // 두 벌로 갈라지지 못하게 못박는다. roundDurationOutward(calculation.ts:46-52)를 오라클로.
  it("agrees with formatMinuteRange through roundDurationOutward for every supported prefix", () => {
    for (let count = 0; count <= 100; count += 1) {
      const { lowSec, highSec } = estimateDuration(count);
      const rounded = roundDurationOutward({ lowSec, highSec });
      expect(formatMinuteSpan(rounded.lowMinutes, rounded.highMinutes)).toBe(
        formatMinuteRange(lowSec, highSec),
      );
    }
  });

  it("agrees with formatMinuteRange on arbitrary second pairs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 90_000 }),
        fc.integer({ min: 0, max: 90_000 }),
        (a, b) => {
          const lowSec = Math.min(a, b);
          const highSec = Math.max(a, b);
          const rounded = roundDurationOutward({ lowSec, highSec });
          expect(formatMinuteSpan(rounded.lowMinutes, rounded.highMinutes)).toBe(
            formatMinuteRange(lowSec, highSec),
          );
        },
      ),
    );
  });
});

describe("formatKstDate / formatKstDateTime", () => {
  it("renders the KST calendar date", () => {
    expect(formatKstDate("2099-07-22T00:00:00.000Z")).toBe("2099. 7. 22.");
  });

  it("renders date + 12h time without seconds", () => {
    // UTC 자정 + 9h = 오전 9:00. seconds 는 뺀다.
    expect(formatKstDateTime("2099-07-22T00:00:00.000Z")).toBe("2099. 7. 22. 오전 9:00");
  });

  it("crosses midnight into the next KST day", () => {
    // 2026-12-31 15:00Z + 9h = 2027-01-01 00:00 KST = 오전 12:00.
    expect(formatKstDateTime("2026-12-31T15:00:00.000Z")).toBe("2027. 1. 1. 오전 12:00");
  });

  it("uses 오후 12:00 for noon KST", () => {
    // 2026-07-27 03:00Z + 9h = 정오 KST.
    expect(formatKstDateTime("2026-07-27T03:00:00.000Z")).toBe("2026. 7. 27. 오후 12:00");
  });

  it("returns an empty string on an unparseable input", () => {
    expect(formatKstDate("not a date")).toBe("");
    expect(formatKstDateTime("")).toBe("");
  });
});

describe("KST is pinned regardless of the host time zone", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("applies +9 rather than the local or UTC offset", () => {
    const iso = "2099-07-22T00:00:00.000Z";
    // +9 가 실제로 걸렸다는 증거: UTC 자정을 오전 9:00 으로 옮긴다(UTC 로 읽었다면 오전 12:00).
    expect(formatKstDateTime(iso)).toBe("2099. 7. 22. 오전 9:00");
    expect(formatKstDateTime(iso)).not.toContain("오전 12:00");
  });

  it("produces the same string under any stubbed TZ (in-process, no CI job needed)", () => {
    const iso = "2099-07-22T00:00:00.000Z";
    const expected = "2099. 7. 22. 오전 9:00";
    for (const tz of ["UTC", "America/New_York", "Asia/Seoul", "Pacific/Kiritimati"]) {
      vi.stubEnv("TZ", tz);
      expect(formatKstDateTime(iso)).toBe(expected);
      expect(formatKstDate(iso)).toBe("2099. 7. 22.");
    }
  });
});
