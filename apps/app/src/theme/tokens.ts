import { CONSTANT_TOKENS, THEMED_TOKENS } from "@singsong/tokens";

/**
 * 네이티브용 이름만 얇게 붙인다. 색과 반경의 값은 packages/tokens 생성물을
 * 정본으로 삼아 웹 CSS와 네이티브 사이에 두 번째 리터럴 복사본을 만들지 않는다.
 */
export const palette = {
  light: {
    canvas: THEMED_TOKENS["--canvas"].light,
    paper: THEMED_TOKENS["--paper"].light,
    surfaceMuted: THEMED_TOKENS["--surface-muted"].light,
    ink: THEMED_TOKENS["--ink"].light,
    inkMuted: THEMED_TOKENS["--ink-muted"].light,
    accentFill: THEMED_TOKENS["--accent-fill"].light,
    accentText: THEMED_TOKENS["--accent-text"].light,
    onAccent: THEMED_TOKENS["--on-accent"].light,
    danger: THEMED_TOKENS["--danger"].light,
    focus: THEMED_TOKENS["--focus"].light,
    moneyText: THEMED_TOKENS["--money-text"].light,
    borderSubtle: THEMED_TOKENS["--border-subtle"].light,
    borderControl: THEMED_TOKENS["--border-control"].light,
  },
  dark: {
    canvas: THEMED_TOKENS["--canvas"].dark,
    paper: THEMED_TOKENS["--paper"].dark,
    surfaceMuted: THEMED_TOKENS["--surface-muted"].dark,
    ink: THEMED_TOKENS["--ink"].dark,
    inkMuted: THEMED_TOKENS["--ink-muted"].dark,
    accentFill: THEMED_TOKENS["--accent-fill"].dark,
    accentText: THEMED_TOKENS["--accent-text"].dark,
    onAccent: THEMED_TOKENS["--on-accent"].dark,
    danger: THEMED_TOKENS["--danger"].dark,
    focus: THEMED_TOKENS["--focus"].dark,
    moneyText: THEMED_TOKENS["--money-text"].dark,
    borderSubtle: THEMED_TOKENS["--border-subtle"].dark,
    borderControl: THEMED_TOKENS["--border-control"].dark,
  },
} as const;

export type Scheme = keyof typeof palette;
export type Palette = (typeof palette)[Scheme];

/** 티켓 팔레트는 PNG·OG가 항상 라이트로 나가므로 별도 스코프다(정본 §9-2). */
export const ticketPalette = {
  light: {
    paper: THEMED_TOKENS["--ticket-paper"].light,
    ink: THEMED_TOKENS["--ticket-ink"].light,
    inkMuted: THEMED_TOKENS["--ticket-ink-muted"].light,
    accentFill: THEMED_TOKENS["--ticket-accent-fill"].light,
    accentText: THEMED_TOKENS["--ticket-accent-text"].light,
    moneyText: THEMED_TOKENS["--ticket-money-text"].light,
    borderControl: THEMED_TOKENS["--ticket-border-control"].light,
    canvas: THEMED_TOKENS["--ticket-canvas"].light,
    surfaceMuted: THEMED_TOKENS["--ticket-surface-muted"].light,
    borderSubtle: THEMED_TOKENS["--ticket-border-subtle"].light,
  },
  dark: {
    paper: THEMED_TOKENS["--ticket-paper"].dark,
    ink: THEMED_TOKENS["--ticket-ink"].dark,
    inkMuted: THEMED_TOKENS["--ticket-ink-muted"].dark,
    accentFill: THEMED_TOKENS["--ticket-accent-fill"].dark,
    accentText: THEMED_TOKENS["--ticket-accent-text"].dark,
    moneyText: THEMED_TOKENS["--ticket-money-text"].dark,
    borderControl: THEMED_TOKENS["--ticket-border-control"].dark,
    canvas: THEMED_TOKENS["--ticket-canvas"].dark,
    surfaceMuted: THEMED_TOKENS["--ticket-surface-muted"].dark,
    borderSubtle: THEMED_TOKENS["--ticket-border-subtle"].dark,
  },
} as const;

function px(token: string): number {
  return Number(token.endsWith("px") ? token.slice(0, -2) : token);
}

export const radius = {
  control: px(CONSTANT_TOKENS["--radius-control"]),
  action: px(CONSTANT_TOKENS["--radius-action"]),
  strip: px(CONSTANT_TOKENS["--radius-strip"]),
  ticket: px(CONSTANT_TOKENS["--radius-ticket"]),
  full: px(CONSTANT_TOKENS["--radius-full"]),
} as const;

/**
 * `--primary-nav-height: calc(3.75rem + safe-bottom)` → 콘텐츠 높이 60dp + 하단 인셋.
 * 인셋은 런타임에 더한다.
 */
export const PRIMARY_NAV_CONTENT_HEIGHT = 60;

/** Android 접근성 스캐너 기준으로 44 대신 48dp로 의도적 상향(계획 §3.5). */
export const MIN_TOUCH_TARGET = 48;
