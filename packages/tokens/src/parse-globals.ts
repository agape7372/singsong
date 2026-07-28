/**
 * `src/app/globals.css` 에서 커스텀 프로퍼티를 뽑아내는 파서.
 *
 * 왜 파서인가 — 토큰을 손으로 옮기면 한 자리 틀려도 티가 안 나고, 그게 정확히
 * 이 repo 가 이미 겪은 드리프트다(`docs/design/VISUAL_MOTION_DIRECTION.md` §3-1 의
 * radius 12/12/20 은 실제 10/14/24 와 다르다). 그래서 값을 전사하지 않고 읽는다.
 * 같은 파서를 테스트가 다시 돌려 커밋된 토큰과 대조하므로, CSS 가 바뀌면 테스트가 깨진다.
 *
 * 정본은 여전히 `globals.css` 다. 이 패키지는 그 파일의 **파생물**이며,
 * M6 에서 CSS 가 사라질 때 정본 지위가 여기로 넘어온다.
 */

export type ParsedBlock = {
  /** 셀렉터/at-rule 을 그대로 — 어디서 나왔는지 추적용. */
  readonly context: string;
  readonly declarations: ReadonlyMap<string, string>;
};

const CUSTOM_PROPERTY = /(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g;

/**
 * 중괄호 깊이를 세며 최상위 규칙을 자른다. 정규식 하나로 블록을 잡으려 하면
 * `@media` 안의 중첩 규칙에서 바로 깨진다.
 */
function splitTopLevelRules(css: string): { prelude: string; body: string }[] {
  const rules: { prelude: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let preludeStart = 0;

  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") {
      if (depth === 0) {
        start = i + 1;
      }
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        rules.push({
          prelude: css.slice(preludeStart, start - 1).trim(),
          body: css.slice(start, i),
        });
        preludeStart = i + 1;
      }
    }
  }
  return rules;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function readDeclarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of body.matchAll(CUSTOM_PROPERTY)) {
    out.set(match[1]!, match[2]!.trim().replace(/\s+/g, " "));
  }
  return out;
}

/**
 * 커스텀 프로퍼티를 선언하는 모든 블록을 순서대로 돌려준다.
 * `@media` 안쪽까지 한 단계 내려가되, 그보다 깊은 중첩은 이 CSS 에 없다(실측).
 */
export function parseTokenBlocks(css: string): ParsedBlock[] {
  const clean = stripComments(css);
  const blocks: ParsedBlock[] = [];

  for (const rule of splitTopLevelRules(clean)) {
    if (rule.prelude.startsWith("@media") || rule.prelude.startsWith("@supports")) {
      for (const inner of splitTopLevelRules(rule.body)) {
        const declarations = readDeclarations(inner.body);
        if (declarations.size > 0) {
          blocks.push({ context: `${rule.prelude} ${inner.prelude}`.trim(), declarations });
        }
      }
      continue;
    }
    const declarations = readDeclarations(rule.body);
    if (declarations.size > 0) blocks.push({ context: rule.prelude, declarations });
  }

  return blocks;
}

/** 파일 전체에서 한 번이라도 선언된 커스텀 프로퍼티 이름 전부(선언 순서 유지). */
export function collectTokenNames(css: string): string[] {
  const seen = new Set<string>();
  for (const block of parseTokenBlocks(css)) {
    for (const name of block.declarations.keys()) seen.add(name);
  }
  return [...seen];
}
