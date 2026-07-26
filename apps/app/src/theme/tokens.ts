/**
 * M0 최소 토큰. 정본은 여전히 `src/app/globals.css` 이고,
 * 102개 전량 이관 + 대비 테스트는 M1 `packages/tokens` 에서 한다.
 * 여기 있는 값은 그 부분집합이며 리터럴이 어긋나면 M1 이관 때 걸린다.
 */
export const palette = {
  light: {
    canvas: "#faf7f0",
    paper: "#ffffff",
    surfaceMuted: "#f5efe7",
    ink: "#15131a",
    inkMuted: "#665f68",
    accentFill: "#ff3d6e",
    accentText: "#d91f52",
    borderSubtle: "#e2dbcf",
    borderControl: "#817984",
  },
  dark: {
    canvas: "#16111c",
    paper: "#221b29",
    surfaceMuted: "#2a2130",
    ink: "#f5eef3",
    inkMuted: "#b8a9bc",
    accentFill: "#ff6b9b",
    accentText: "#ff8ab1",
    borderSubtle: "#413547",
    borderControl: "#88798d",
  },
} as const;

export type Scheme = keyof typeof palette;
export type Palette = (typeof palette)[Scheme];

/** 티켓 팔레트는 PNG·OG 가 항상 라이트로 나가므로 별도 스코프다(정본 §9-2). */
export const ticketPalette = {
  light: {
    paper: "#f6efdc",
    ink: "#15131a",
    inkMuted: "#665f68",
    accentFill: "#ff3d6e",
    accentText: "#d91f52",
    moneyText: "#8a5200",
    borderControl: "#817984",
    canvas: "#faf7f0",
    surfaceMuted: "#fff5f8",
    borderSubtle: "#e2dbcf",
  },
  dark: {
    paper: "#241c2a",
    ink: "#f5eef3",
    inkMuted: "#b8a9bc",
    accentFill: "#ff6b9b",
    accentText: "#ff8ab1",
    moneyText: "#f5a623",
    borderControl: "#88798d",
    canvas: "#16111c",
    surfaceMuted: "#281d27",
    borderSubtle: "#413547",
  },
} as const;

export const radius = {
  control: 8,
  action: 10,
  strip: 14,
  ticket: 24,
  full: 999,
} as const;

/**
 * `--primary-nav-height: calc(3.75rem + safe-bottom)` → 콘텐츠 높이 60dp + 하단 인셋.
 * 인셋은 런타임에 더한다.
 */
export const PRIMARY_NAV_CONTENT_HEIGHT = 60;

/** Android 접근성 스캐너 기준으로 44 대신 48dp 로 의도적 상향(계획 §3.5). */
export const MIN_TOUCH_TARGET = 48;
