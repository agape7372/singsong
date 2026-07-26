/**
 * WCAG 2.x 상대 휘도와 대비비. 순수 함수, 의존성 없음.
 *
 * 왜 필요한가 — 정본 §12-2 가 대비 테스트를 요구하는데 repo 에 그런 테스트가 없었다.
 * 팔레트를 바꾸다 AA 를 깨는 걸 사람 눈으로는 못 잡는다.
 */

export type Rgb = readonly [number, number, number];

export function parseHex(css: string): Rgb {
  const hex = css.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`6자리 hex 가 아니다: ${JSON.stringify(css)}`);
  }
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG 2.x 정의 그대로. sRGB 채널을 선형화한 뒤 가중합. */
export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as unknown as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 1:1 ~ 21:1. 인자 순서는 결과에 영향을 주지 않는다. */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const la = relativeLuminance(typeof a === "string" ? parseHex(a) : a);
  const lb = relativeLuminance(typeof b === "string" ? parseHex(b) : b);
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/** 소수 둘째 자리까지. 테스트에서 부동소수 잡음을 없애려고 쓴다. */
export function ratio2(a: string | Rgb, b: string | Rgb): number {
  return Math.round(contrastRatio(a, b) * 100) / 100;
}

export const WCAG = {
  /** 일반 텍스트 AA. */
  aaNormal: 4.5,
  /** 큰 텍스트(18.66px bold 또는 24px 이상) AA. */
  aaLarge: 3,
  /** UI 컴포넌트·그래픽 객체 경계. */
  aaNonText: 3,
} as const;
