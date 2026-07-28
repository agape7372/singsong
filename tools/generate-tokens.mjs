/**
 * `src/app/globals.css` 에서 `packages/tokens/src/generated.ts` 를 만든다.
 *
 * 손으로 옮기지 않는 이유 — 이 repo 는 이미 전사 드리프트를 겪었다.
 * `docs/design/VISUAL_MOTION_DIRECTION.md` §3-1 의 radius 12/12/20 은 실제 10/14/24 와 다르고,
 * 재구축 계획서의 "토큰 102개"도 실은 *선언* 102개이지 고유 이름은 56개다.
 * 사람이 세면 틀린다.
 *
 * 생성물은 커밋한다(런타임에 CSS 를 읽을 수 없으므로). 대신
 * `packages/tokens/test/generated.test.ts` 가 같은 파서를 다시 돌려 커밋본과 대조하므로,
 * CSS 만 고치고 재생성을 잊으면 테스트가 깨진다.
 *
 * 실행: node tools/generate-tokens.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const CSS = path.join(repo, "src", "app", "globals.css");
const OUT = path.join(repo, "packages", "tokens", "src", "generated.ts");

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitTopLevelRules(text) {
  const rules = [];
  let depth = 0;
  let start = 0;
  let preludeStart = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        rules.push({
          prelude: text.slice(preludeStart, start - 1).trim(),
          body: text.slice(start, i),
        });
        preludeStart = i + 1;
      }
    }
  }
  return rules;
}

function readDeclarations(body) {
  const out = new Map();
  for (const match of body.matchAll(/(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(match[1], match[2].trim().replace(/\s+/g, " "));
  }
  return out;
}

export function parseTokenBlocks(css) {
  const clean = stripComments(css);
  const blocks = [];
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

const CONTEXTS = {
  light: ":root",
  dark: "@media (prefers-color-scheme: dark) :root",
  ticketCard: ".ticket-card",
  narrow: "@media (max-width: 359px) :root",
  wide: "@media (min-width: 900px) :root",
  forcedColors: "@media (forced-colors: active) :root",
};

export function buildModel(css) {
  const blocks = parseTokenBlocks(css);
  const byContext = new Map(blocks.map((block) => [block.context, block.declarations]));

  for (const [key, context] of Object.entries(CONTEXTS)) {
    if (!byContext.has(context)) {
      throw new Error(
        `globals.css 에서 '${context}' 블록(${key})을 못 찾았다 — 파서나 CSS 구조가 바뀌었다`,
      );
    }
  }

  const light = byContext.get(CONTEXTS.light);
  const dark = byContext.get(CONTEXTS.dark);

  /** 라이트에만 있고 다크에 없으면 테마 무관 상수다. */
  const themed = [];
  const constants = [];
  for (const [name, value] of light) {
    if (dark.has(name)) themed.push([name, value, dark.get(name)]);
    else constants.push([name, value]);
  }

  return {
    themed,
    constants,
    ticketCard: [...byContext.get(CONTEXTS.ticketCard)],
    narrow: [...byContext.get(CONTEXTS.narrow)],
    wide: [...byContext.get(CONTEXTS.wide)],
    forcedColors: [...byContext.get(CONTEXTS.forcedColors)],
    uniqueCount: new Set(blocks.flatMap((block) => [...block.declarations.keys()])).size,
    declarationCount: blocks.reduce((sum, block) => sum + block.declarations.size, 0),
  };
}

function entries(pairs, indent = "  ") {
  return pairs.map(([name, value]) => `${indent}"${name}": ${JSON.stringify(value)},`).join("\n");
}

function themedEntries(rows) {
  return rows
    .map(
      ([name, lightValue, darkValue]) =>
        `  "${name}": { light: ${JSON.stringify(lightValue)}, dark: ${JSON.stringify(darkValue)} },`,
    )
    .join("\n");
}

export function render(model) {
  return `// 이 파일은 생성물이다. 손으로 고치지 마라.
// 생성: node tools/generate-tokens.mjs  (정본 = src/app/globals.css)
//
// 고유 토큰 ${model.uniqueCount}개 / 선언 ${model.declarationCount}개.
// 재구축 계획서의 "토큰 102개" 는 선언 수를 센 것이고 고유 이름은 ${model.uniqueCount}개다.

/** 라이트/다크가 갈리는 토큰. */
export const THEMED_TOKENS = {
${themedEntries(model.themed)}
} as const;

/** \`:root\` 에만 있고 다크에서 재선언되지 않는 값 — 반경·모션·레이아웃. */
export const CONSTANT_TOKENS = {
${entries(model.constants)}
} as const;

/** \`.ticket-card\` 스코프 별칭. 티켓 팔레트의 정본은 src/features/ticket/ticket-artwork.json 이고
 *  이 별칭들은 그 값을 CSS 변수로 다시 부르는 이름일 뿐이다. 여기서 색을 새로 정의하지 않는다. */
export const TICKET_CARD_ALIASES = {
${entries(model.ticketCard)}
} as const;

/** 뷰포트 폭에 따른 재선언. */
export const RESPONSIVE_OVERRIDES = {
  "max-width: 359px": {
${entries(model.narrow, "    ")}
  },
  "min-width: 900px": {
${entries(model.wide, "    ")}
  },
} as const;

/** \`forced-colors: active\` 에서 CSS 시스템 색으로 갈아끼우는 매핑.
 *  네이티브에는 등가물이 없다 — RN 에서는 고대비 테마를 별도로 제공하며 "패리티" 라 부르지 않는다. */
export const FORCED_COLOR_TOKENS = {
${entries(model.forcedColors)}
} as const;
`;
}

const css = fs.readFileSync(CSS, "utf8");
const model = buildModel(css);

// prettier 를 거쳐서 쓴다. 안 그러면 생성기와 `format:check` 가 서로 다른 포맷을 주장해서
// 생성 직후에 `--check` 가 실패하는 교착이 생긴다. 포맷 정본은 prettier 하나여야 한다.
const prettier = await import("prettier");
const options = (await prettier.resolveConfig(OUT)) ?? {};
const output = await prettier.format(render(model), { ...options, filepath: OUT });

const check = process.argv.includes("--check");
if (check) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current.replace(/\r\n/g, "\n") !== output) {
    console.error(
      "packages/tokens/src/generated.ts 가 globals.css 와 어긋났다. `node tools/generate-tokens.mjs` 를 다시 돌려라.",
    );
    process.exit(1);
  }
  console.log(`생성물 최신 · 고유 ${model.uniqueCount} / 선언 ${model.declarationCount}`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, output, "utf8");
  console.log(
    `생성 완료 → ${path.relative(repo, OUT)} · 고유 ${model.uniqueCount} / 선언 ${model.declarationCount}`,
  );
}
