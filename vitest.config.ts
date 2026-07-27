import path from "node:path";
import { defineConfig } from "vitest/config";

const root = process.cwd();

/**
 * 모노레포 전환 중이라 스위트가 두 곳에 산다 — 아직 Next 트리에 남은 `tests/**` 와
 * 새로 생긴 `packages/*`. `test.projects` 로 한 번에 돌리고 커버리지는 루트에서 합산한다.
 *
 * ★ `test.workspace` 가 아니라 `test.projects` 다. vitest 4 에서 `workspace` 는 런타임 throw.
 *
 * ★ **존재하는 패키지만 등록한다.** vitest 는 root 디렉터리가 없는 project 를 경고 없이
 *   건너뛰고 exit 0 을 낸다. 오타 하나가 게이트 전체를 무음 no-op 으로 만들고, 그 상태로
 *   green 서명이 나간다. `tools/check-monorepo.mjs` 가 이 목록과 실제 디렉터리를 대조한다.
 */
export default defineConfig({
  resolve: {
    alias: {
      // ★ `@/domain` 이 `@` 보다 **앞**에 있어야 한다. vite 의 `normalizeAlias` 가
      // `Object.keys` 순서를 보존하고 `entries.find(matches)` 가 first-match-wins 라,
      // 뒤에 두면 `@/domain/...` 이 비워진 `src/domain` 으로 조용히 해석되어
      // git mv 가 실패한 것처럼 보인다. (tsconfig `paths` 는 longest-prefix 라 순서 무관.)
      //
      // 이 shim 은 영구물이 아니다. `@/domain` 임포터 37개 중 상당수는 어차피 이동 대상이라
      // (M4 services/share-api, M1 packages/store) 그때 specifier 가 재작성된다.
      // **마지막 임포터가 옮겨진 시점에 이 줄을 지운다** — M4/M6 체크리스트에 등록.
      "@/domain": path.resolve(root, "packages/domain/src"),
      // ★ `@/store` 도 `@` 보다 앞. src/data/plan-database.ts 가 C8 에서 `@/store/policy` 를 물고,
      //   next project 의 통합 테스트가 그 파일을 거쳐 이 별칭을 탄다. `@/domain` 과 같은 shim 이라
      //   마지막 임포터(src/)가 M6 에 사라지면 함께 지운다.
      "@/store": path.resolve(root, "packages/store/src"),
      "@": path.resolve(root, "src"),
      "server-only": path.resolve(root, "tests/setup/server-only.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "next",
          environment: "node",
          include: ["tests/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "store",
          root: path.resolve(root, "packages/store"),
          environment: "node",
          include: ["test/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "tokens",
          root: path.resolve(root, "packages/tokens"),
          environment: "node",
          include: ["test/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ticket-art",
          root: path.resolve(root, "packages/ticket-art"),
          environment: "node",
          include: ["test/**/*.test.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      // 테스트 하네스를 프로덕션 코드로 세지 않는다. `packages/store/test/node-sql-executor.ts`
      // 는 SqlExecutor 의 두 번째 구현(node:sqlite)이지 배포물이 아닌데, 빼지 않으면
      // 커버리지 분모에 들어가 임계를 실제 코드와 무관하게 흔든다.
      exclude: ["**/test/**", "**/tests/**", "**/*.config.*", "**/dist/**"],
      // 임계값 = P3 착지 직후(트랙 A·B·C·E 완료) `npx vitest run --coverage` 실측값을
      // 정수로 내린 것. 실측 2026-07-27, Node v24.11.1:
      //   Statements 80.82% (2416/2989) · Branches 72.09% (1462/2028)
      //   Functions  82.02% ( 552/673 ) · Lines    83.37% (2271/2724)
      // 정수 내림 이유: v8 커버리지가 Node 패치버전 간 소수점 아래에서 미세하게 흔들려
      // 정확한 실측값을 그대로 박으면 무관한 런타임 차이로 red 가 뜬다.
      //
      // ★ 이전 주석이 근거로 든 "82.27%/75.47%"(정본 §3.6)는 폐기했다 — 그 수치는 M1
      //   이동 **이전**(packages/domain·store 가 아직 src/ 에 있던 때) 측정치라 현 트리와
      //   대응하지 않는다. 게다가 이 임계 4개는 여태 **한 번도 평가된 적이 없었다**:
      //   `test` 스크립트도 `verify` 체인도 `--coverage` 를 넘기지 않았기 때문. 즉 죽은
      //   설정이었고, .github/workflows/ci.yml 의 checks job 이 `npx vitest run --coverage`
      //   로 처음으로 **강제**한다.
      //
      // branches 만 75 → 72 로 **완화**했다. 나머지 셋(functions 80→82, lines 80→83,
      // statements 80 유지)은 실측이 넘겨 래칫이 강화됐다. branches 를 내린 것은 75 가
      // 한 번도 평가된 적 없는 죽은 값이었고, 근거로 인용되던 베이스라인이 M1 이동 이전
      // 측정치라 현 트리와 무관하기 때문이다. 실제 회귀 방지선은 실측 72 다.
      //
      // 글로브 키로 특정 패키지만 올리는 것은 하지 않는다 — 상향 래칫이라 되돌릴 수 없고,
      // 커버리지는 전역 합산 1개라(coverage-summary.json total 1개) 새 패키지가 분모에
      // 희석된다. 패키지별 게이트는 vitest project 분리 이후 사안.
      thresholds: {
        statements: 80,
        branches: 72,
        functions: 82,
        lines: 83,
      },
    },
  },
});
