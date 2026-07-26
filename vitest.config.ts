import { defineConfig } from "vitest/config";
import path from "node:path";

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
      "@/domain": path.resolve(process.cwd(), "packages/domain/src"),
      "@": path.resolve(process.cwd(), "src"),
      "server-only": path.resolve(process.cwd(), "tests/setup/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
