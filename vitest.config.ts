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
      // 임계값은 현행 유지. 전체 베이스라인이 82.27%/75.47% 라 90/85 로 올릴 근거가 없다
      // (정본 §3.6). 글로브 키로 특정 패키지만 올리는 것도 하지 않는다 — 상향 래칫이라
      // 되돌릴 수 없고, 아직 이식 중인 패키지에 걸면 이동 자체가 막힌다.
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
