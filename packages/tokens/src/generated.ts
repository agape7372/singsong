// 이 파일은 생성물이다. 손으로 고치지 마라.
// 생성: node tools/generate-tokens.mjs  (정본 = src/app/globals.css)
//
// 고유 토큰 56개 / 선언 102개.
// 재구축 계획서의 "토큰 102개" 는 선언 수를 센 것이고 고유 이름은 56개다.

/** 라이트/다크가 갈리는 토큰. */
export const THEMED_TOKENS = {
  "--canvas": { light: "#faf7f0", dark: "#16111c" },
  "--paper": { light: "#ffffff", dark: "#221b29" },
  "--ticket-cream": { light: "#f6efdc", dark: "#241c2a" },
  "--surface-muted": { light: "#f5efe7", dark: "#2a2130" },
  "--wash": { light: "#fff5f8", dark: "#281d27" },
  "--ink": { light: "#15131a", dark: "#f5eef3" },
  "--ink-muted": { light: "#665f68", dark: "#b8a9bc" },
  "--accent-fill": { light: "#ff3d6e", dark: "#ff6b9b" },
  "--accent-text": { light: "#d91f52", dark: "#ff8ab1" },
  "--on-accent": { light: "#15131a", dark: "#15131a" },
  "--money": { light: "#b76e00", dark: "#f5a623" },
  "--money-text": { light: "#8a5200", dark: "#f5a623" },
  "--money-decoration": { light: "#d99321", dark: "#f5a623" },
  "--border-subtle": { light: "#e2dbcf", dark: "#413547" },
  "--border-control": { light: "#817984", dark: "#88798d" },
  "--danger": { light: "#b82f39", dark: "#ff8177" },
  "--focus": { light: "#15131a", dark: "#f5eef3" },
  "--shadow-strip": {
    light: "0 16px 45px rgb(67 32 50 / 9%)",
    dark: "0 18px 48px rgb(0 0 0 / 22%)",
  },
  "--shadow-ticket": {
    light: "0 14px 32px rgb(50 25 39 / 14%)",
    dark: "0 14px 34px rgb(0 0 0 / 32%)",
  },
  "--ticket-paper": { light: "#f6efdc", dark: "#241c2a" },
  "--ticket-ink": { light: "#15131a", dark: "#f5eef3" },
  "--ticket-ink-muted": { light: "#665f68", dark: "#b8a9bc" },
  "--ticket-accent-fill": { light: "#ff3d6e", dark: "#ff6b9b" },
  "--ticket-accent-text": { light: "#d91f52", dark: "#ff8ab1" },
  "--ticket-money-text": { light: "#8a5200", dark: "#f5a623" },
  "--ticket-border-control": { light: "#817984", dark: "#88798d" },
  "--ticket-canvas": { light: "#faf7f0", dark: "#16111c" },
  "--ticket-surface-muted": { light: "#fff5f8", dark: "#281d27" },
  "--ticket-border-subtle": { light: "#e2dbcf", dark: "#413547" },
} as const;

/** `:root` 에만 있고 다크에서 재선언되지 않는 값 — 반경·모션·레이아웃. */
export const CONSTANT_TOKENS = {
  "--radius-control": "8px",
  "--radius-action": "10px",
  "--radius-strip": "14px",
  "--radius-ticket": "24px",
  "--radius-full": "999px",
  "--layout-gutter": "clamp(1rem, 4vw, 1.5rem)",
  "--safe-bottom": "max(0.75rem, env(safe-area-inset-bottom))",
  "--primary-nav-height": "calc(3.75rem + var(--safe-bottom))",
  "--bottom-slot-height": "0px",
  "--motion-fast": "120ms",
  "--motion-state": "160ms",
  "--motion-route": "180ms",
  "--motion-sheet-in": "260ms",
  "--motion-sheet-out": "180ms",
  "--motion-flip": "460ms",
  "--ease-standard": "cubic-bezier(0.22, 1, 0.36, 1)",
  "--ease-in": "cubic-bezier(0.64, 0, 0.78, 0)",
} as const;

/** `.ticket-card` 스코프 별칭. 티켓 팔레트의 정본은 src/features/ticket/ticket-artwork.json 이고
 *  이 별칭들은 그 값을 CSS 변수로 다시 부르는 이름일 뿐이다. 여기서 색을 새로 정의하지 않는다. */
export const TICKET_CARD_ALIASES = {
  "--card-paper": "var(--ticket-paper, var(--ticket-cream, var(--paper)))",
  "--card-muted": "var(--ticket-surface-muted, var(--wash))",
  "--card-ink": "var(--ticket-ink, var(--ink))",
  "--card-ink-muted": "var(--ticket-ink-muted, var(--ink-muted))",
  "--card-accent": "var(--ticket-accent-fill, var(--accent-fill))",
  "--card-accent-text": "var(--ticket-accent-text, var(--accent-text))",
  "--card-money": "var(--ticket-money-text, var(--money-text))",
  "--card-border": "var(--ticket-border-control, var(--border-control))",
  "--card-hole": "var(--ticket-canvas, var(--canvas))",
  "--card-pad": "clamp(1.25rem, 6vw, 1.85rem)",
} as const;

/** 뷰포트 폭에 따른 재선언. */
export const RESPONSIVE_OVERRIDES = {
  "max-width: 359px": {
    "--layout-gutter": "0.75rem",
  },
  "min-width: 900px": {
    "--primary-nav-height": "0px",
    "--bottom-slot-height": "0px",
  },
} as const;

/** `forced-colors: active` 에서 CSS 시스템 색으로 갈아끼우는 매핑.
 *  네이티브에는 등가물이 없다 — RN 에서는 고대비 테마를 별도로 제공하며 "패리티" 라 부르지 않는다. */
export const FORCED_COLOR_TOKENS = {
  "--canvas": "Canvas",
  "--paper": "Canvas",
  "--surface-muted": "Canvas",
  "--wash": "Canvas",
  "--ink": "CanvasText",
  "--ink-muted": "CanvasText",
  "--accent-fill": "Highlight",
  "--accent-text": "LinkText",
  "--on-accent": "HighlightText",
  "--money-text": "CanvasText",
  "--border-subtle": "ButtonText",
  "--border-control": "ButtonText",
  "--danger": "LinkText",
  "--focus": "Highlight",
} as const;
