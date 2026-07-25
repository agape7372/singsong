import { describe, expect, it } from "vitest";
import { hasFinalConsonant, josa, withJosa } from "@/domain/josa";

describe("josa", () => {
  it("picks the particle from the final consonant of a Korean syllable", () => {
    // 녹화에서 나온 실제 버그: ‘우리의 대기번호’ + 을 → 를이어야 한다.
    expect(josa("우리의 대기번호", "을/를")).toBe("를");
    expect(josa("밤의 체크인", "을/를")).toBe("을");
    expect(josa("한 곡 더", "이/가")).toBe("가");
    expect(josa("분홍 영수증", "이/가")).toBe("이");
    expect(josa("마지막 환승", "은/는")).toBe("은");
    expect(josa("새벽 두 칸", "은/는")).toBe("은");
    expect(josa("느린 불빛", "과/와")).toBe("과");
    expect(josa("종이달", "과/와")).toBe("과");
    expect(josa("여름선", "과/와")).toBe("과");
    expect(josa("모서리", "과/와")).toBe("와");
  });

  it("treats ㄹ as vowel-like for 으로/로", () => {
    expect(josa("서울", "으로/로")).toBe("로");
    expect(josa("보관함", "으로/로")).toBe("으로");
    expect(josa("스튜디오", "으로/로")).toBe("로");
  });

  it("ignores trailing quotes, brackets and spaces", () => {
    expect(withJosa("‘우리의 대기번호’", "을/를")).toBe("‘우리의 대기번호’를");
    expect(josa("밤의 체크인 (live)", "을/를")).toBe("를");
    expect(josa("한 곡 더   ", "이/가")).toBe("가");
  });

  it("reads digits and Latin letters by their Korean pronunciation", () => {
    expect(josa("TJ 91001", "을/를")).toBe("을"); // 일
    expect(josa("방 302", "을/를")).toBe("를"); // 이
    expect(josa("Mr. Kim", "이/가")).toBe("이"); // 엠
    expect(josa("Lady", "이/가")).toBe("가"); // 와이
  });

  it("falls back to the vowel form when nothing is decidable", () => {
    expect(hasFinalConsonant("♪♪")).toBeNull();
    expect(josa("♪♪", "을/를")).toBe("를");
    expect(josa("", "이/가")).toBe("가");
  });
});
