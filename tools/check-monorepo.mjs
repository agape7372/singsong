#!/usr/bin/env node
/**
 * 모노레포 구조 가드 — `node tools/check-monorepo.mjs`
 *
 * 이 저장소는 pnpm 단일 패키지에서 npm 워크스페이스로 넘어왔고(`9fde82b`),
 * 그 전환은 **파일이 있고 없고**로만 유지된다. 타입 검사도 테스트도 잡아 주지 않는
 * 종류의 퇴행이라, 되돌아가는 걸 막으려면 별도의 검사가 필요하다.
 *
 * 설계 원칙 두 가지:
 *
 * 1. **주석은 판정에서 뺀다.** 이 저장소의 설정 파일은 한국어 주석으로 이유를 남기는
 *    관례가 있다. 원문에 `includes()` 를 때리면 자기가 쓴 설명문에 자기가 걸린다.
 *    실제로 루트 `package.json` 의 `//overrides` 는 "pnpm 에서는 문제가 없었지만" 이라는
 *    문장을 담고 있어, 순진한 부분문자열 검사면 영원히 빨간불이다. 그래서 모든 검사는
 *    주석을 걷어낸 뒤의 **의미 단위**(JSON 키, 설정 키, ignore 규칙)를 본다.
 *
 * 2. **실패 메시지는 할 일을 적는다.** 무엇이 틀렸는지가 아니라 무엇을 하라는 건지.
 *
 * 종료 코드: 통과 0 / 실패 1(모든 실패를 다 출력한 뒤).
 */

import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ────────────────────────────── 순수 술어 ──────────────────────────────
 * 아래 함수들은 파일 시스템을 만지지 않는다. tools/check-monorepo.test.mjs 가
 * 이것만 따로 불러서 검증한다 — 진짜 저장소를 망가뜨려 보지 않고도 가드가
 * 실제로 잡아내는지 확인할 수 있어야 하기 때문. */

/** `#`/`;` 주석과 빈 줄을 걷어낸 유효 줄만 돌려준다. */
export function significantLines(text, commentPrefixes = ["#", ";"]) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !commentPrefixes.some((prefix) => line.startsWith(prefix)));
}

/** ini 형태의 `.npmrc` 를 키→값 Map 으로. 주석 처리된 줄은 애초에 들어오지 않는다. */
export function parseNpmrc(text) {
  const settings = new Map();
  for (const line of significantLines(text)) {
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    settings.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return settings;
}

/**
 * `22.13` 같은 버전이 `>=22.13` 같은 범위를 만족하는지.
 *
 * semver 를 의존성으로 들이지 않는다 — 이 가드가 검사하는 대상이 바로 "의존성이
 * 조용히 늘어나는 것" 이므로, 가드 자신은 표준 라이브러리만 쓴다. 우리가 실제로
 * 쓰는 표기(`>=`, `>`, `^`, `~`, `=`, 맨버전)만 다루고 나머지는 모른다고 답한다.
 */
export function satisfiesNodeRange(version, range) {
  const parse = (raw) => {
    const parts = String(raw)
      .trim()
      .replace(/^v/, "")
      .split(".")
      .map((piece) => Number.parseInt(piece, 10));
    if (parts.some((piece) => Number.isNaN(piece))) return null;
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };

  // [a,b,c] 사전식 비교. a>b 면 1, 같으면 0, 작으면 -1.
  const cmp = (a, b) => {
    for (let i = 0; i < 3; i += 1) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  };

  const actual = parse(version);
  if (!actual) return { ok: false, reason: `버전 '${version}' 을 읽을 수 없다` };

  // 공백/쉼표로 갈라진 여러 조건은 모두 만족해야 한다(`>=22.13 <23` 같은 표기).
  const clauses = String(range)
    .split(/[\s,]+/)
    .filter(Boolean);
  if (clauses.length === 0) return { ok: true };

  for (const clause of clauses) {
    const match = /^(>=|<=|>|<|\^|~|=)?\s*(.+)$/.exec(clause);
    const operator = match?.[1] ?? "=";
    const bound = parse(match?.[2] ?? "");
    if (!bound) return { ok: false, reason: `범위 '${clause}' 를 읽을 수 없다` };

    const order = cmp(actual, bound);
    let ok;
    if (operator === ">=") ok = order >= 0;
    else if (operator === ">") ok = order > 0;
    else if (operator === "<=") ok = order <= 0;
    else if (operator === "<") ok = order < 0;
    else if (operator === "=") ok = order === 0;
    else if (operator === "^") ok = order >= 0 && actual[0] === bound[0];
    else if (operator === "~") ok = order >= 0 && actual[0] === bound[0] && actual[1] === bound[1];
    else return { ok: false, reason: `연산자 '${operator}' 는 이 가드가 모른다` };

    if (!ok) return { ok: false, reason: `${version} 이 '${clause}' 를 만족하지 않는다` };
  }
  return { ok: true };
}

/**
 * `package.json` 안의 pnpm 잔재를 **키 기준**으로 찾는다.
 *
 * `//` 로 시작하는 키는 이 저장소의 주석 관례(루트 `package.json` 의 `//overrides`)라
 * 값이 산문이다. 산문에 등장하는 "pnpm" 은 잔재가 아니라 설명이므로 건너뛴다.
 */
export function findPnpmResidueKeys(pkg) {
  const found = [];
  for (const [key, value] of Object.entries(pkg ?? {})) {
    if (key.startsWith("//")) continue; // 주석 키 — 값은 산문이다
    if (key === "pnpm") found.push(`'pnpm' 필드`);
    if (key === "packageManager") found.push(`'packageManager' 필드(= ${JSON.stringify(value)})`);
    // scripts 처럼 값이 객체/문자열인 경우, 실제로 pnpm 을 호출하는지만 본다.
    if (key === "scripts" && value && typeof value === "object") {
      for (const [name, command] of Object.entries(value)) {
        if (/\bpnpm\b/.test(String(command))) found.push(`scripts.${name} 가 pnpm 을 호출`);
      }
    }
  }
  return found;
}

/**
 * `.easignore` 원문에서 판정 대상 규칙만 뽑는다.
 *
 * 주석을 반드시 먼저 걷어내야 한다. 이 파일 하단에는 "/apps 와 /packages 는 절대
 * 제외하지 말 것" 이라는 경고 주석이 들어가는데, 원문에 `includes('/apps')` 를 걸면
 * 그 경고문 자체가 위반으로 잡힌다.
 */
export function easignoreRules(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

/**
 * ignore 규칙 하나가 최상위 디렉터리 `name` 을 통째로 제외하는가?
 *
 * `apps/app/android` 처럼 **하위** 경로를 찍는 규칙은 제외가 아니다 — 그건 정상이고
 * 오히려 우리가 원하는 것이다. 잡아야 할 건 `/apps`, `apps/`, `apps/**`, `*` 처럼
 * 디렉터리 자체가 통째로 날아가는 형태뿐. `!` 로 시작하면 재포함이므로 무해하다.
 */
export function ruleExcludesTopLevel(rule, name) {
  if (rule.startsWith("!")) return false; // 재포함(negation)
  const normalized = rule.replace(/^\/+/, "").replace(/\/+$/, "");
  if (normalized === "*" || normalized === "**") return true; // 전부 제외

  // 앞의 `**/` 는 "어느 깊이에서든" 이라 최상위도 포함한다. `**/apps` 가 `/apps` 와
  // 같은 효과를 내는데 리터럴 비교만 하면 통과한다 — 실제로 우회에 성공했던 형태다.
  const anchored = normalized.replace(/^(\*\*\/)+/, "");
  if (anchored === name) return true;

  // `apps/**/*`·`apps/*/`·`apps/**/**` 처럼 뒤에 와일드카드만 남는 형태도 전부 제외다.
  // 첫 세그먼트가 이름이고 나머지가 와일드카드뿐이면 디렉터리가 통째로 날아간다.
  const segments = anchored.split("/");
  if (segments[0] === name && segments.length > 1) {
    const rest = segments.slice(1);
    if (rest.every((segment) => segment === "*" || segment === "**" || segment === "")) return true;
  }
  return false;
}

/**
 * 따옴표를 존중하며 JS 주석을 걷어낸다.
 *
 * 이걸 먼저 하지 않으면 뒤의 괄호 짝 맞추기가 주석 속 괄호에 속는다. vitest.config.ts
 * 의 alias 주석에는 `entries.find(matches)` 같은 문장이 실제로 들어 있다.
 */
export function stripJsComments(text) {
  let out = "";
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * `key: <값>` 에서 값 전체를 깊이를 세며 잘라낸다.
 *
 * 단순히 다음 쉼표까지 자르면 `root: path.resolve(root, "packages/store")` 가
 * `path.resolve(root` 에서 끊긴다 — 인자 구분 쉼표가 값 안에 있기 때문. 실제로 이
 * 가드가 그렇게 틀려서 store project 의 root 를 놓쳤다.
 */
function extractValue(source, key) {
  const at = new RegExp(`\\b${key}\\s*:\\s*`).exec(source);
  if (!at) return null;
  const start = at.index + at[0].length;
  let depth = 0;
  let quote = null;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{" || ch === "[" || ch === "(") depth += 1;
    else if (ch === "}" || ch === "]" || ch === ")") {
      if (depth === 0) return source.slice(start, i).trim();
      depth -= 1;
    } else if (ch === "," && depth === 0) return source.slice(start, i).trim();
  }
  return source.slice(start).trim();
}

/** 배열/객체 본문을 깊이 0 의 쉼표로만 가른다(따옴표·중첩 무시). */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let quote = null;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{" || ch === "[" || ch === "(") depth += 1;
    else if (ch === "}" || ch === "]" || ch === ")") depth -= 1;
    else if (ch === "," && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * `vitest.config.ts` 를 **텍스트로** 읽어 각 project 가 가리키는 디렉터리를 뽑는다.
 *
 * import 하지 않는 이유: 설정이 `process.cwd()` 나 플러그인에 의존해서, 불러오는 것
 * 자체가 부작용이고 실패 지점이다. 가드는 부작용 없이 돌아야 한다.
 *
 * project 항목은 두 형태다:
 *   - 문자열/글롭 (`"packages/*"`) → 그 자체가 경로
 *   - 객체 (`{ test: { name, root, include } }`) → **`root` 만** 경로다
 *
 * 객체에서 모든 문자열을 긁으면 `name: "next"` 나 `environment: "node"` 까지 경로로
 * 오인해 존재하지 않는 디렉터리로 신고한다(실제로 처음에 그렇게 틀렸다). `root` 가
 * 없는 project 는 설정 파일 위치를 물려받으므로 검사 대상이 아니다.
 *
 * 반환: `projects` 가 없으면 null, 있으면 `{ label, dir }[]` (dir 이 null 이면 상속).
 */
export function parseVitestProjects(source) {
  const text = stripJsComments(source);
  const key = /(^|[\s{,])projects\s*:\s*\[/.exec(text);
  if (!key) return null;

  // 여는 대괄호부터 짝이 맞는 닫는 대괄호까지 잘라낸다(따옴표 존중).
  const open = text.indexOf("[", key.index);
  let depth = 0;
  let close = -1;
  let quote = null;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return [];

  return splitTopLevel(text.slice(open + 1, close)).map((entry) => {
    const literal = /^["'`]([^"'`]+)["'`]$/.exec(entry);
    if (literal) return { label: literal[1], dir: literal[1] };

    const name = /\bname\s*:\s*["'`]([^"'`]+)["'`]/.exec(entry)?.[1];
    const label = name ?? entry.slice(0, 30).replace(/\s+/g, " ");

    const root = extractValue(entry, "root");
    if (!root) return { label, dir: null }; // root 없음 = 설정 파일 위치 상속

    // `path.resolve(root, "packages/store")` 의 마지막 문자열 인자가 실제 경로다.
    const resolved = [...root.matchAll(/["'`]([^"'`]+)["'`]/g)].map((match) => match[1]);
    return { label, dir: resolved.at(-1) ?? null };
  });
}

/**
 * 테스트 디렉터리를 가진 패키지 중 vitest project 로 **등록되지 않은** 것.
 *
 * 위 5번 검사(`vitest projects 가 모두 실재하는 디렉터리`)의 **역방향**이다.
 * 그쪽은 "선언됐는데 디렉터리가 없다"를 잡고, 이쪽은 "디렉터리가 있는데 선언이 없다"를 잡는다.
 *
 * ★ 이 방향이 더 위험하다. 선언 오타는 vitest 가 project 를 조용히 건너뛰고 0 으로 끝내지만
 *   (그래도 다른 project 는 돈다), 미등록은 **테스트 파일을 쓴 사람이 초록불을 보면서
 *   자기 테스트가 한 번도 실행되지 않았다는 걸 모른다**. 검사 5번은 이걸 못 잡는다 —
 *   등록된 것만 순회하기 때문이다.
 *
 * `packages/domain` 이 정확히 이 상태였다(실측 2026-07-27: projects = next·store·tokens·
 * ticket-art, domain 없음). 지금은 `packages/domain/test/` 가 없어서 무해하지만,
 * 도메인 테스트를 패키지 안에 만드는 순간 무음 no-op 이 된다.
 *
 * @param packagesWithTests 테스트 디렉터리를 가진 패키지 이름들 (예: ["store", "tokens"])
 * @param projects `parseVitestProjects` 결과
 * @returns 등록되지 않은 패키지 이름들
 */
export function packagesMissingVitestProject(packagesWithTests, projects) {
  if (projects === null) return [...packagesWithTests];
  // project 의 root 는 `packages/<name>` 형태로 적힌다. 글롭(`packages/*`)이 있으면
  // 그 하나가 전부를 덮으므로 미등록이 없다.
  const covered = new Set();
  let glob = false;
  for (const { dir } of projects) {
    if (!dir) continue;
    const normalized = String(dir).replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized.includes("*")) {
      if (/^packages\/\*+$/.test(normalized)) glob = true;
      continue;
    }
    const match = /^packages\/([^/]+)$/.exec(normalized);
    if (match) covered.add(match[1]);
  }
  if (glob) return [];
  return packagesWithTests.filter((name) => !covered.has(name));
}

/**
 * `packages/*` 가 선언한 런타임 의존 중 `apps/app` 에 없는 것.
 *
 * 왜 이걸 검사하는가 — `apps/app` 은 워크스페이스 멤버가 아니고 자기 lockfile 로 따로
 * 설치된다(설계, 7번 검사 참조). 로컬에서는 앱이 `@singsong/domain` 을 import 했을 때
 * Node/Metro 가 상위 디렉터리로 걸어 올라가 루트 `node_modules/zod` 를 우연히 찾아낸다.
 * **EAS 워커에는 그 루트가 없다** — `.easignore` 가 `node_modules` 를 업로드에서 빼고
 * 워커는 `apps/app/package-lock.json` 으로만 설치한다. 결과는 10~20분 클라우드 빌드를
 * 왕복한 뒤에야 보이는 모듈 해석 실패다.
 *
 * 그래서 "패키지의 런타임 의존은 앱에도 선언돼 있어야 한다"를 로컬에서 즉시 강제한다.
 * devDependencies 는 보지 않는다 — 번들에 안 들어간다.
 *
 * @param packageManifests [{ name, dependencies }] 형태의 packages/* 매니페스트
 * @param appDependencies apps/app 의 dependencies 객체
 * @returns [{ package, dependency, wanted, appHas }] 누락 목록
 */
export function missingAppDependencies(packageManifests, appDependencies) {
  const missing = [];
  for (const manifest of packageManifests) {
    for (const [dependency, wanted] of Object.entries(manifest.dependencies ?? {})) {
      // 워크스페이스 내부 참조는 앱이 따로 설치하는 대상이 아니다(M2 에서 경로로 노출된다).
      if (dependency.startsWith("@singsong/")) continue;
      const appHas = appDependencies?.[dependency];
      if (!appHas) missing.push({ package: manifest.name, dependency, wanted, appHas: null });
    }
  }
  return missing;
}

/* ─────────────────────────── 파일 시스템 헬퍼 ─────────────────────────── */

const exists = (relative) => existsSync(join(ROOT, relative));

const readIfExists = (relative) => {
  const absolute = join(ROOT, relative);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
};

/**
 * 한 해석 영역(realm) 안에 패키지가 몇 벌 있는지 센다.
 *
 * 루트 직속과 **중첩 한 겹**(`node_modules/<any>/node_modules/<pkg>`)을 본다. npm 이
 * peer 충돌을 풀 때 만드는 게 정확히 그 중첩 형태이고, 이 저장소는 이미 그걸로 한 번
 * 당했다 — 루트 `package.json` 의 `//overrides` 가 기록한 playwright-core 두 벌 사건.
 * 타입이 두 벌이 되면 같은 이름의 서로 다른 타입 사이에서 TS2322 가 난다.
 */
function countPackageCopies(realmDirectory, packageName) {
  const modules = join(realmDirectory, "node_modules");
  if (!existsSync(modules)) return [];

  const copies = new Set();
  const record = (candidate) => {
    if (!existsSync(join(candidate, "package.json"))) return;
    try {
      copies.add(realpathSync(candidate));
    } catch {
      copies.add(candidate);
    }
  };

  record(join(modules, packageName));

  let entries;
  try {
    entries = readdirSync(modules, { withFileTypes: true });
  } catch {
    return [...copies];
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === packageName) continue;
    // @scope/pkg 는 한 겹 더 들어간다.
    const owners = entry.name.startsWith("@")
      ? readdirSync(join(modules, entry.name), { withFileTypes: true })
          .filter((child) => child.isDirectory())
          .map((child) => join(modules, entry.name, child.name))
      : [join(modules, entry.name)];
    for (const owner of owners) record(join(owner, "node_modules", packageName));
  }
  return [...copies];
}

/* ──────────────────────────────── 실행부 ──────────────────────────────── */

const failures = [];
let passCount = 0;

/** 검사 하나. `run` 은 통과면 부가 설명 문자열(또는 undefined), 실패면 throw. */
function check(label, run) {
  try {
    const note = run();
    passCount += 1;
    console.log(`  PASS  ${label}${note ? ` — ${note}` : ""}`);
  } catch (error) {
    failures.push({ label, message: error.message });
    console.log(`  FAIL  ${label}`);
    for (const line of String(error.message).split("\n")) console.log(`        ${line}`);
  }
}

const fail = (message) => {
  throw new Error(message);
};

/**
 * 검사 본체. 직접 실행할 때만 돈다.
 *
 * 위 순수 술어들은 tools/check-monorepo.test.mjs 가 import 해서 검증하는데,
 * 최상위에서 바로 실행하면 그 import 만으로 저장소 전체 검사가 돌고 process.exit 까지
 * 불려 테스트가 죽는다. 그래서 진입점 여부를 보고 나눈다.
 */
function main() {
  console.log(`\n모노레포 구조 가드 — ${ROOT}\n`);

  // ── 1. pnpm 잔재 ────────────────────────────────────────────────────────
  check("pnpm 잔재 파일 없음", () => {
    const residue = [
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      ".pnpm-store",
      "node_modules.pnpm-bak",
    ];
    const present = residue.filter((entry) => exists(entry));
    if (present.length > 0) {
      fail(
        `다음을 삭제하라: ${present.join(", ")}\n` +
          `  → git rm -r --cached ${present.join(" ")} 후 실제 삭제. ` +
          `npm 워크스페이스로 넘어온 뒤(9fde82b) 이 파일들은 아무도 읽지 않지만, ` +
          `남아 있으면 다음 사람이 pnpm 저장소로 착각한다.`,
      );
    }
    return `${residue.length}종 모두 부재`;
  });

  check("루트 package.json 에 pnpm 설정 없음", () => {
    const pkg = JSON.parse(readIfExists("package.json") ?? "{}");
    const residue = findPnpmResidueKeys(pkg);
    if (residue.length > 0) {
      fail(
        `루트 package.json 에서 다음 키를 지워라: ${residue.join(", ")}\n` +
          `  → packageManager 가 남아 있으면 corepack 이 pnpm 을 되살린다.`,
      );
    }
    return "pnpm/packageManager 필드 없음 (`//` 주석 키는 산문이라 제외)";
  });

  // ── 2. .npmrc ───────────────────────────────────────────────────────────
  check("`.npmrc` 에 ignore-scripts 없음", () => {
    // 루트뿐 아니라 apps/app 것도 본다 — EAS 업로드 번들에는 둘 다 들어간다.
    const offenders = [];
    for (const relative of [".npmrc", "apps/app/.npmrc"]) {
      const text = readIfExists(relative);
      if (text === null) continue;
      if (parseNpmrc(text).has("ignore-scripts")) offenders.push(relative);
    }
    if (offenders.length > 0) {
      fail(
        `${offenders.join(", ")} 에서 ignore-scripts 를 제거하라.\n` +
          `  → 이 파일은 EAS 리눅스 워커로 그대로 올라간다. 거기서 스크립트가 막히면 ` +
          `Skia 네이티브 링크 단계가 깨진다. 로컬 설치를 빠르게 하고 싶으면 ` +
          `--ignore-scripts 를 명령줄에 붙여라(파일에 박지 말고).`,
      );
    }
    return "루트/apps/app 모두 깨끗";
  });

  check("`.npmrc` 에 engine-strict=true 있음", () => {
    const text = readIfExists(".npmrc");
    if (text === null) fail("루트 `.npmrc` 가 없다. `engine-strict=true` 를 담아 생성하라.");
    const value = parseNpmrc(text).get("engine-strict");
    if (value !== "true") {
      fail(
        `루트 \`.npmrc\` 에 engine-strict=true 를 넣어라(현재: ${value ?? "미설정"}).\n` +
          `  → 없으면 engines.node 범위가 경고로 격하되어, 잘못된 Node 로 설치한 ` +
          `node_modules 가 CI 까지 흘러간다.`,
      );
    }
    return "engine-strict=true";
  });

  // ── 3. .nvmrc ↔ engines.node ────────────────────────────────────────────
  check("`.nvmrc` 가 engines.node 범위를 만족", () => {
    const nvmrc = readIfExists(".nvmrc");
    if (nvmrc === null) fail("`.nvmrc` 가 없다. engines.node 를 만족하는 버전을 적어라.");
    const version = significantLines(nvmrc, ["#"])[0];
    const range = JSON.parse(readIfExists("package.json") ?? "{}").engines?.node;
    if (!range) fail("루트 package.json 에 engines.node 가 없다. 먼저 그것부터 선언하라.");

    const verdict = satisfiesNodeRange(version, range);
    if (!verdict.ok) {
      fail(
        `\`.nvmrc\`(${version}) 를 engines.node("${range}") 에 맞춰 올려라.\n` +
          `  → ${verdict.reason}. 두 값이 어긋나면 nvm 사용자가 engine-strict 에 걸려 ` +
          `설치조차 못 한다.`,
      );
    }
    return `${version} ⊨ "${range}"`;
  });

  // ── 4. 루트 metro 설정 ──────────────────────────────────────────────────
  check("루트에 metro.config.* 없음", () => {
    const strays = readdirSync(ROOT).filter((entry) => /^metro\.config\./.test(entry));
    if (strays.length > 0) {
      fail(
        `루트의 ${strays.join(", ")} 를 apps/app/ 으로 옮겨라.\n` +
          `  → Metro 설정은 Expo 앱의 것이다. 루트에 있으면 워크스페이스 해석 기준점이 ` +
          `저장소 루트로 잡혀, apps/app 이 워크스페이스 멤버가 아니라는 M1 전제와 충돌한다.`,
      );
    }
    return "없음";
  });

  // ── 5. vitest projects ↔ 실재 디렉터리 ──────────────────────────────────
  check("vitest projects 가 모두 실재하는 디렉터리", () => {
    const text = readIfExists("vitest.config.ts");
    if (text === null) fail("vitest.config.ts 가 없다.");
    const projects = parseVitestProjects(text);
    if (projects === null) return "`test.projects` 미사용 — 검사 대상 없음";

    const missing = [];
    let checked = 0;
    for (const { label, dir } of projects) {
      if (!dir) continue; // root 미지정 = 설정 파일 위치 상속, 늘 존재한다
      // 글롭이면 고정 접두 디렉터리까지만 확인한다(`packages/*` → `packages`).
      const globAt = dir.search(/[*?[]/);
      const probe = globAt === -1 ? dir : dir.slice(0, globAt).replace(/\/+$/, "");
      if (!probe) continue;
      checked += 1;
      if (!existsSync(resolve(ROOT, probe))) missing.push(`${label} → ${dir}`);
    }
    if (missing.length > 0) {
      fail(
        `vitest.config.ts 의 projects 경로를 고쳐라: ${missing.join(", ")}\n` +
          `  → vitest 는 root 가 없는 project 를 조용히 건너뛰고 그래도 0 으로 끝난다. ` +
          `오타 하나가 게이트 전체를 초록불 no-op 으로 만든다.`,
      );
    }
    return `project ${projects.length}개 중 경로 지정 ${checked}개 실재`;
  });

  check("test 디렉터리를 가진 패키지가 모두 vitest project 로 등록됨", () => {
    const text = readIfExists("vitest.config.ts");
    if (text === null) fail("vitest.config.ts 가 없다.");
    const projects = parseVitestProjects(text);

    const packagesDirectory = join(ROOT, "packages");
    const packagesWithTests = existsSync(packagesDirectory)
      ? readdirSync(packagesDirectory, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .filter((name) => existsSync(join(packagesDirectory, name, "test")))
      : [];

    const missing = packagesMissingVitestProject(packagesWithTests, projects);
    if (missing.length > 0) {
      fail(
        `vitest.config.ts 의 projects 에 다음 패키지를 등록하라: ${missing.join(", ")}\n` +
          `  → 검사 5번의 역방향이다. 등록되지 않은 패키지의 test/ 는 어떤 project 의 ` +
          `include 에도 안 걸려 vitest 가 **수집조차 하지 않는다**. 테스트를 쓴 사람은 ` +
          `초록불을 보고 통과했다고 믿지만 그 파일은 한 번도 실행되지 않았다. ` +
          `\`next\` project 의 include 는 tests/** 라 packages/*/test 를 덮지 않는다.`,
      );
    }
    return packagesWithTests.length > 0
      ? `test/ 보유 ${packagesWithTests.length}개 전부 등록 (${packagesWithTests.join(", ")})`
      : "test/ 를 가진 패키지 없음";
  });

  // ── 6. 패키지 중복 ──────────────────────────────────────────────────────
  /**
   * 영역(realm)을 나눠서 센다. apps/app 은 M1 에서 **의도적으로** 워크스페이스 멤버가
   * 아니고 자기 lockfile 로 따로 설치되므로, react/react-native 가 거기 있는 건 정상이다.
   * 루트에서 react-native 가 보이면 오히려 apps/app 이 워크스페이스로 새어 들어온 것.
   */
  check("react 가 루트 영역에 정확히 한 벌", () => {
    const copies = countPackageCopies(ROOT, "react");
    if (copies.length !== 1) {
      fail(
        copies.length === 0
          ? "루트에서 react 를 찾을 수 없다. 설치가 깨졌다."
          : `react 가 ${copies.length}벌이다:\n` +
              copies.map((path) => `        - ${path}`).join("\n") +
              `\n  → 루트 package.json 의 overrides 로 한 벌로 고정하라. ` +
              `타입이 두 벌이면 같은 이름의 다른 타입 사이에서 TS2322 가 난다.`,
      );
    }
    return copies[0].replace(ROOT, ".");
  });

  check("react-native 가 루트 영역에 없음(apps/app 격리 유지)", () => {
    const copies = countPackageCopies(ROOT, "react-native");
    if (copies.length > 0) {
      fail(
        `루트에 react-native 가 설치됐다:\n` +
          copies.map((path) => `        - ${path}`).join("\n") +
          `\n  → M1 에서 apps/app 은 워크스페이스 멤버가 아니다. 루트로 올라왔다면 ` +
          `누군가 workspaces 에 apps/* 를 넣었다는 뜻이다. 되돌려라.`,
      );
    }
    return "루트 미설치 — 설계대로";
  });

  check("apps/app 영역에 react·react-native 각 한 벌", () => {
    const appDirectory = join(ROOT, "apps/app");
    if (!existsSync(join(appDirectory, "node_modules"))) {
      return "apps/app/node_modules 미설치 — 건너뜀";
    }
    const problems = [];
    for (const name of ["react", "react-native"]) {
      const copies = countPackageCopies(appDirectory, name);
      if (copies.length !== 1)
        problems.push(`${name}: ${copies.length}벌 ${JSON.stringify(copies)}`);
    }
    if (problems.length > 0) {
      fail(
        `apps/app 설치가 중복됐다: ${problems.join(" / ")}\n` +
          `  → apps/app/package.json 의 overrides 로 고정하고 apps/app 에서 재설치하라. ` +
          `react 가 두 벌이면 훅이 런타임에 깨진다.`,
      );
    }
    return "각 1벌";
  });

  // ── 7. apps/app lockfile ↔ workspaces 일관성 ────────────────────────────
  check("apps/app lockfile 과 workspaces 목록이 일치", () => {
    const hasLockfile = exists("apps/app/package-lock.json");
    const workspaces = JSON.parse(readIfExists("package.json") ?? "{}").workspaces ?? [];
    const patterns = Array.isArray(workspaces) ? workspaces : (workspaces.packages ?? []);
    // `apps/app` 을 덮는 패턴이 있는가. `apps/*`, `apps/app`, `apps/**` 모두 해당.
    const covered = patterns.some((pattern) =>
      /^apps(\/(\*{1,2}|app))?$/.test(String(pattern).replace(/\/+$/, "")),
    );

    if (hasLockfile && covered) {
      fail(
        `apps/app 이 workspaces(${JSON.stringify(patterns)})에 들어갔는데 ` +
          `apps/app/package-lock.json 이 아직 있다.\n` +
          `  → 둘 중 하나를 고르라. 워크스페이스로 편입할 거면 그 lockfile 을 지워라 ` +
          `(루트 lockfile 이 정본이 된다). 격리를 유지할 거면 workspaces 에서 apps 를 빼라. ` +
          `둘 다 두면 어느 lockfile 이 적용됐는지 아무도 모른다.`,
      );
    }
    if (!hasLockfile && !covered) {
      fail(
        `apps/app 이 워크스페이스 멤버도 아닌데 자기 lockfile 도 없다.\n` +
          `  → apps/app 에서 npm install 을 돌려 package-lock.json 을 만들어라. ` +
          `없으면 EAS 빌드가 매번 다른 버전을 집는다.`,
      );
    }
    return covered ? "워크스페이스 멤버 + 루트 lockfile" : "격리 + 자체 lockfile (M1 설계)";
  });

  check("packages/* 의 런타임 의존이 apps/app 에도 선언됨", () => {
    const packagesDirectory = join(ROOT, "packages");
    if (!existsSync(packagesDirectory)) return "packages/ 없음 — 검사 대상 없음";

    const manifests = readdirSync(packagesDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => readIfExists(join("packages", entry.name, "package.json")))
      .filter((text) => text !== null)
      .map((text) => JSON.parse(text));

    const appManifest = readIfExists("apps/app/package.json");
    if (appManifest === null) return "apps/app 없음 — 검사 대상 없음";

    const missing = missingAppDependencies(manifests, JSON.parse(appManifest).dependencies);
    if (missing.length > 0) {
      fail(
        `apps/app/package.json 의 dependencies 에 다음을 추가하라:\n` +
          missing
            .map(
              (entry) =>
                `        - ${entry.dependency}@${entry.wanted}  (${entry.package} 가 요구)`,
            )
            .join("\n") +
          `\n  → apps/app 은 워크스페이스 멤버가 아니라 자기 lockfile 로 따로 설치된다. ` +
          `로컬에서는 Node 가 상위로 걸어 올라가 루트 node_modules 에서 우연히 찾아내지만, ` +
          `EAS 워커에는 그 루트가 없다(.easignore 가 node_modules 를 업로드에서 제외). ` +
          `여기서 안 잡으면 클라우드 빌드 10~20분을 왕복한 뒤에야 모듈 해석 실패로 드러난다.`,
      );
    }
    return `패키지 ${manifests.length}개의 런타임 의존 전부 앱에 선언됨`;
  });

  check("ticket-artwork.json 사본이 정본과 바이트 동일", () => {
    const canonical = "packages/ticket-art/src/ticket-artwork.json";
    const copy = "apps/app/src/render/skia/ticket-artwork.json";
    if (!exists(canonical)) {
      fail(`정본 ${canonical} 이 없다. 옮겼다면 이 검사의 경로도 함께 고쳐라.`);
    }
    if (!exists(copy)) return "사본 없음 — 앱이 패키지를 직접 읽는다면 이 검사를 지워라";

    const canonicalBytes = readFileSync(join(ROOT, canonical));
    const copyBytes = readFileSync(join(ROOT, copy));
    if (!canonicalBytes.equals(copyBytes)) {
      fail(
        `${copy} 를 정본으로 다시 복사하라 — \`cp ${canonical} ${copy}\`\n` +
          `  → 이 사본은 apps/app 이 워크스페이스 멤버가 아니라 @singsong/* 를 해석할 수 ` +
          `없어서(M2 로 연기) 존재한다. 두 장이 어긋나면 화면 티켓과 네이티브 티켓이 ` +
          `다른 그림을 그리는데, 둘을 나란히 볼 수 있는 곳이 없어 아무도 눈치채지 못한다. ` +
          `M2 에서 앱이 패키지를 import 하게 되면 사본과 이 검사를 함께 지운다.`,
      );
    }
    return `${canonicalBytes.length} 바이트 동일`;
  });

  // ── 8. .easignore ───────────────────────────────────────────────────────
  check("`.easignore` 가 /apps·/packages 를 제외하지 않음", () => {
    const text = readIfExists(".easignore");
    if (text === null) {
      fail(
        "`.easignore` 가 없다. 저장소 루트에 만들어라.\n" +
          "  → 없으면 docs/design(147MB)까지 EAS 워커로 업로드된다.",
      );
    }
    const rules = easignoreRules(text);
    const offenders = [];
    for (const name of ["apps", "packages"]) {
      for (const rule of rules) {
        if (ruleExcludesTopLevel(rule, name)) offenders.push(`'${rule}' 가 /${name} 를 제외`);
      }
    }
    if (offenders.length > 0) {
      fail(
        `\`.easignore\` 에서 다음 규칙을 지워라: ${offenders.join(", ")}\n` +
          `  → /apps 와 /packages 는 빌드 대상 그 자체다. 제외하면 EAS 가 소스 없이 ` +
          `빌드를 시도하다 알아보기 힘든 모듈 해석 오류로 죽는다.`,
      );
    }
    return `규칙 ${rules.length}개 검사 (주석·빈 줄 제외 후)`;
  });

  /* ──────────────────────────────── 결과 ──────────────────────────────── */

  console.log("");
  if (failures.length === 0) {
    console.log(`통과 ${passCount}건, 실패 0건 — 모노레포 구조 정상\n`);
    return 0;
  }
  console.log(`통과 ${passCount}건, 실패 ${failures.length}건:`);
  for (const { label } of failures) console.log(`  - ${label}`);
  console.log("");
  return 1;
}

// 진입점으로 실행됐을 때만. import 되면(테스트) 아무것도 하지 않는다.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
