/**
 * 토큰 서술자의 공통 형태.
 *
 * 어떤 토큰이든 `cssVar` 를 들고 다닌다. 지금 소비자는 RN 이라 CSS 변수명이 쓸모없어
 * 보이지만, `src/app/globals.css` 가 아직 정본이고 나중에 코드젠으로 그 파일을 되찍을 때
 * 이름이 없으면 왕복이 불가능하다. 값보다 이름이 먼저 사라지지 않게 붙여 둔다.
 */

export type Theme = "light" | "dark";

export type CssVarName = `--${string}`;

/** 테마와 무관한 상수(반경·모션·간격). */
export interface StaticToken<V extends string = string> {
  readonly cssVar: CssVarName;
  readonly value: V;
}

/** 라이트/다크가 갈리는 토큰. */
export interface ThemedToken<V extends string = string> {
  readonly cssVar: CssVarName;
  readonly light: V;
  readonly dark: V;
}

/** `@media (max-width: 359px)` / `@media (min-width: 900px)` 두 종류만 실제로 쓰인다. */
export type MediaCondition = { readonly maxWidthPx: number } | { readonly minWidthPx: number };

/** 뷰포트 폭에 따라 재선언되는 토큰(globals.css:3547, 3652-3653). */
export interface ResponsiveToken<V extends string = string> extends StaticToken<V> {
  readonly overrides: readonly { readonly at: MediaCondition; readonly value: V }[];
}

/** `forced-colors: active` 에서 갈아끼우는 CSS 시스템 색 키워드(globals.css:3774-3787). */
export interface ForcedColorToken {
  readonly cssVar: CssVarName;
  readonly systemColor: string;
}

/**
 * `var(--a, var(--b, var(--c)))` 폴백 사슬. 값이 아니라 **참조 순서**가 내용이므로
 * 해석된 색을 적어 두면 안 된다 — 사슬의 첫 항이 정의돼 있는지가 곧 스코프 판정이다.
 */
export interface AliasToken {
  readonly cssVar: CssVarName;
  readonly chain: readonly CssVarName[];
}

export function pick<V extends string>(token: ThemedToken<V>, theme: Theme): V {
  return theme === "dark" ? token.dark : token.light;
}

/** `--a: var(--b, var(--c))` 의 우변을 복원한다. 코드젠이 CSS 로 되찍을 때 쓴다. */
export function aliasToCssValue(token: AliasToken): string {
  return token.chain.reduceRight(
    (inner, name) => (inner ? `var(${name}, ${inner})` : `var(${name})`),
    "",
  );
}
