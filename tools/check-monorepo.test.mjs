#!/usr/bin/env node
/**
 * tools/check-monorepo.mjs 순수 술어 단위 테스트 — `node tools/check-monorepo.test.mjs`
 *
 * 가드가 **통과시키는지** 만 확인하면 의미가 없다. 초록불이 진짜 초록불인지 알려면
 * 깨진 입력을 넣었을 때 실제로 빨간불이 뜨는지를 봐야 한다. 저장소를 진짜로
 * 망가뜨려 보는 대신(다른 에이전트가 동시에 작업 중이다) 술어에 직접 넣는다.
 *
 * vitest 가 아니라 node:test 인 이유: 루트 vitest 는 `tests/**` 의 ts/tsx 만 include
 * 하므로(vitest.config.ts) 이 파일을 집어가지 않는다. 가드는 vitest 설정 자체를
 * 검사하는 물건이라 그 설정에 의존하지 않는 편이 맞다.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  easignoreRules,
  findPnpmResidueKeys,
  parseNpmrc,
  parseVitestProjects,
  ruleExcludesTopLevel,
  satisfiesNodeRange,
  significantLines,
} from "./check-monorepo.mjs";

test("significantLines: 주석과 빈 줄을 걷어낸다", () => {
  assert.deepEqual(significantLines("# c\n\n  a=1  \n; d\nb=2"), ["a=1", "b=2"]);
});

test("parseNpmrc: 주석 처리된 ignore-scripts 는 설정이 아니다", () => {
  // 실수로 켜진 것과 '켜지 말라고 적어 둔 것' 을 구분하지 못하면 가드가 거짓 경보를 낸다.
  assert.equal(
    parseNpmrc("# ignore-scripts=true\nengine-strict=true").has("ignore-scripts"),
    false,
  );
  assert.equal(parseNpmrc("ignore-scripts=true").get("ignore-scripts"), "true");
  assert.equal(parseNpmrc("engine-strict=true").get("engine-strict"), "true");
});

test("satisfiesNodeRange: 현재 저장소 값(22.13 ⊨ >=22.13)", () => {
  assert.equal(satisfiesNodeRange("22.13", ">=22.13").ok, true);
});

test("satisfiesNodeRange: 경계와 실패", () => {
  assert.equal(satisfiesNodeRange("22.12", ">=22.13").ok, false);
  assert.equal(satisfiesNodeRange("24.11.1", ">=22.13").ok, true);
  // 22.9 > 22.13 이 되는 문자열 비교 버그를 막는다 — 숫자로 비교해야 한다.
  assert.equal(satisfiesNodeRange("22.9", ">=22.13").ok, false);
  assert.equal(satisfiesNodeRange("23.0.0", ">=22.13 <23").ok, false);
  assert.equal(satisfiesNodeRange("22.13.0", "^22.13").ok, true);
  assert.equal(satisfiesNodeRange("23.0.0", "^22.13").ok, false);
});

test("findPnpmResidueKeys: `//` 주석 키의 산문은 잔재가 아니다", () => {
  // 실제 루트 package.json 이 이 형태다. 원문 includes('pnpm') 이면 영원히 실패한다.
  const pkg = { "//overrides": "pnpm 에서는 문제가 없었지만 npm 은…", overrides: {} };
  assert.deepEqual(findPnpmResidueKeys(pkg), []);
});

test("findPnpmResidueKeys: 진짜 잔재는 잡는다", () => {
  assert.equal(findPnpmResidueKeys({ packageManager: "pnpm@9.0.0" }).length, 1);
  assert.equal(findPnpmResidueKeys({ pnpm: { overrides: {} } }).length, 1);
  assert.equal(findPnpmResidueKeys({ scripts: { build: "pnpm run x" } }).length, 1);
  assert.equal(findPnpmResidueKeys({ scripts: { build: "npm run x" } }).length, 0);
});

test("easignoreRules: 주석을 먼저 걷어낸다", () => {
  // 우리가 .easignore 하단에 쓴 경고 주석 그 자체.
  const text = "/docs\n\n# ⚠ /apps 와 /packages 는 절대 제외하지 말 것\n/coverage\n";
  assert.deepEqual(easignoreRules(text), ["/docs", "/coverage"]);
});

test("ruleExcludesTopLevel: 디렉터리 통째 제외만 위반이다", () => {
  for (const rule of ["/apps", "apps", "apps/", "apps/**", "apps/*", "*", "**"]) {
    assert.equal(ruleExcludesTopLevel(rule, "apps"), true, `${rule} 는 위반이어야 한다`);
  }
  // 하위 경로 제외는 정상 — 오히려 우리가 원하는 규칙이다.
  for (const rule of ["apps/app/android", "/apps/app/public/*.apk", "!/apps", "packages"]) {
    assert.equal(ruleExcludesTopLevel(rule, "apps"), false, `${rule} 는 통과여야 한다`);
  }
  assert.equal(ruleExcludesTopLevel("/packages", "packages"), true);
});

test("parseVitestProjects: 필드가 없으면 null(검사 대상 없음)", () => {
  assert.equal(parseVitestProjects("export default { test: { include: ['a'] } }"), null);
});

test("parseVitestProjects: 문자열 항목은 그대로 경로다", () => {
  const text = `export default { test: { projects: ["packages/*", './apps/app'] } }`;
  assert.deepEqual(parseVitestProjects(text), [
    { label: "packages/*", dir: "packages/*" },
    { label: "./apps/app", dir: "./apps/app" },
  ]);
});

test("parseVitestProjects: 객체 항목은 root 만 경로다", () => {
  // 이 가드의 첫 판이 정확히 여기서 틀렸다 — name/environment/include 까지 경로로
  // 오인해 'next', 'node' 같은 디렉터리가 없다고 거짓 신고했다.
  const text = `
    test: {
      projects: [
        { extends: true, test: { name: "next", environment: "node", include: ["tests/**/*.test.ts"] } },
        { extends: true, test: { name: "store", root: path.resolve(root, "packages/store"), include: ["test/**/*.test.ts"] } },
      ],
    }`;
  assert.deepEqual(parseVitestProjects(text), [
    { label: "next", dir: null }, // root 없음 → 상속, 검사 대상 아님
    { label: "store", dir: "packages/store" },
  ]);
});

test("parseVitestProjects: 주석 속 괄호에 속지 않는다", () => {
  // 실제 vitest.config.ts 의 alias 주석에 `entries.find(matches)` 가 들어 있다.
  const text = `
    test: {
      // 배열을 닫는 ] 처럼 보이는 주석 ] 과 entries.find(matches)
      projects: ["packages/store"],
    }`;
  assert.deepEqual(parseVitestProjects(text), [{ label: "packages/store", dir: "packages/store" }]);
});
