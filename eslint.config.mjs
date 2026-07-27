import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * `packages/*` 의 수입 경계.
 *
 * 이 저장소는 Next PWA 를 Expo 네이티브로 재구축하는 중이고, `packages/*` 는 **양쪽 다에서
 * 돌아야 하는 순수 코드**다. 그런데 지금 트리에는 Next 트리(`src/`)가 그대로 살아 있어서
 * (M6 까지 유지) `react` 도 `dexie` 도 `next` 도 루트 node_modules 에 있다. 즉
 * `packages/store` 에 `import Dexie from "dexie"` 를 적어도 **설치돼 있으니 그냥 돌아간다** —
 * typecheck 도 테스트도 통과한다. 깨지는 건 M2 에서 Metro 가 그 패키지를 번들할 때다.
 *
 * 그래서 lint 로 막는다. 여기 걸리는 규칙 3종은 전부 "지금은 조용하고 나중에 비싼" 종류다.
 *
 * ★ `\p{}` 정규식 금지는 **의도적으로 넣지 않았다.** 계획 §3.4 가 `catalog.ts:12` 의
 *   `/[\p{P}\p{S}]+/gu` 를 "Hermes 모듈 로드 실패 · M1 하드 블로커" 로 지목했으나 실측으로
 *   반증됐다 — 앱이 싣는 hermesc(hermes-v0.17.0)로 컴파일 exit 0 이고,
 *   `-dump-bytecode` 결과 그 문자 클래스는 **컴파일 시점에 339 개의 명시 코드포인트 범위로
 *   전개된다**(`U16Bracket`). 즉 기기 ICU 와 무관하다. 규칙을 넣었다면 근거 없이
 *   `catalog.ts:12` 를 빨간불로 만들었을 것이다. 자세한 실측은 그 파일 주석에 있다.
 */
const packageBoundaries = {
  files: ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "react",
            message:
              "packages/* 는 UI 프레임워크를 모른다. 훅이 필요하면 순수 모듈로 내려 쓰고 훅은 앱에서 감싸라.",
          },
          {
            name: "react-dom",
            message: "packages/* 는 UI 프레임워크를 모른다.",
          },
          {
            name: "react-native",
            message:
              "packages/* 는 Next 트리와 네이티브 앱 양쪽에서 돈다. 플랫폼 API 는 포트로 주입하라.",
          },
          {
            name: "dexie",
            message: "Dexie 는 M6 에 폐기된다. 저장은 packages/store 의 SqlExecutor 포트를 거친다.",
          },
          {
            name: "next",
            message: "packages/* 는 프레임워크를 모른다.",
          },
          {
            name: "server-only",
            message: "packages/* 는 서버 전용이 아니다. 같은 코드가 기기에서도 돌아야 한다.",
          },
        ],
        patterns: [
          {
            group: ["next/*", "react-native/*", "expo", "expo-*", "@shopify/react-native-skia"],
            message: "packages/* 는 프레임워크·네이티브 모듈을 모른다. 필요하면 포트로 주입하라.",
          },
          {
            // `packages/store/src/x.ts` 에서 `../../../src/...` 로 나가는 것을 막는다.
            // 실제로 `packages/ticket-art/src/artwork.ts` 가 이 모양으로 Next 트리의 JSON 을
            // 물고 있었다(M6 에 삭제될 트리). 패키지 경계 = 디렉터리 경계여야
            // "M6 에 src/ 를 지웠더니 패키지가 빌드 불가" 가 생기지 않는다.
            group: ["../../*", "../../../*", "../../../../*"],
            message:
              "패키지 디렉터리 밖으로 나가는 상대경로 금지. 필요한 것은 패키지 안으로 옮기거나 다른 워크스페이스 패키지로 선언해 import 하라.",
          },
          {
            // Node 빌트인은 Metro 번들에 없다. 루트 tsconfig(TS 5.9.3)는 @types/node 를
            // 자동 포함해서 통과시키지만, apps/app 의 TS 6.0.3 은 자동 포함을 제거했다.
            // 지금 이 규칙에 걸리는 소스는 0건이다 — 0건일 때 못박는 것이 요점.
            group: ["node:*"],
            message:
              "packages/*/src 는 Node 빌트인을 쓰지 않는다(Metro 번들에 없다). 테스트 하네스에서만 허용된다.",
          },
        ],
      },
    ],
  },
};

/**
 * 표시 포맷의 결정성 경계 — `Intl` 과 tz 의존 `toLocale*` 금지.
 *
 * Intl 은 플랫폼 ICU 위임이라 Hermes(Android ICU4J · Apple NSNumberFormatter) · Node · 브라우저가
 * 같은 바이트를 낸다는 보장이 없다. 서브셋 폰트는 예상 못 한 구분자·전각 기호에 두부를 띄우고
 * (계획 §3.3), 만료 시각은 서버 tz(Vercel UTC)에 따라 다른 날짜를 그린다. 포맷은 전부
 * `@/domain/format`(순수 · import 0)을 거친다. C2·C3 이 마지막 사용처(Intl 4벌·toLocale 5곳)를
 * 걷어냈고 이 규칙이 되돌아오는 걸 막는다.
 *
 * apps/app/src 까지 거는 이유: 지금은 0건이지만 M2 에서 화면이 포팅되면 Intl 이 모듈 스코프
 * const 로 다시 들어와, 기기에서 throw 시 모듈 로드가 화이트스크린이 된다. 0건일 때 못박는 게 요점.
 *
 * ★ `toLocaleLowerCase`·`localeCompare` 도 금지한다(트랙 A 가 추가). 둘 다 플랫폼 ICU 위임이라
 *   기기별로 소문자화·정렬이 갈릴 수 있다. `catalog.ts:11,82` 가 마지막 사용처였고, 트랙 A 가
 *   각각 `toLowerCase()`·코드유닛 비교로 교체하면서(전 코드포인트 차이 0·순서쌍 전수 일치 실측)
 *   이 규칙으로 되돌아오는 걸 막는다. tools/·scripts/·tests/·M4 services/ 는 글롭 밖이다
 *   (테스트는 ICU 를 오라클로 써야 한다). 글롭이 각 패키지의 src 하위라 packages 의 test
 *   디렉터리는 자유롭고, design-lab 은 files 밖이라 제외된다.
 */
const formatterDiscipline = {
  files: ["src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}", "apps/app/src/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "MemberExpression[object.name='Intl']",
        message:
          "Intl 금지 — @/domain/format 의 순수 포맷터를 써라(기기별 ICU 로 골든·서브셋 폰트가 갈린다).",
      },
      {
        selector: "CallExpression[callee.property.name=/^toLocale(String|DateString|TimeString)$/]",
        message:
          "toLocale* 금지 — formatKstDate / formatKstDateTime 을 써라(서버 tz 의존이라 만료 시각이 어긋난다).",
      },
      {
        selector: "CallExpression[callee.property.name=/^toLocale(LowerCase|UpperCase)$/]",
        message:
          "toLocaleLowerCase/UpperCase 금지 — toLowerCase()/toUpperCase() 를 써라(플랫폼 ICU 위임이라 기기별로 갈린다. ko 로케일엔 조건부 casing 이 없어 결과도 같다).",
      },
      {
        selector: "CallExpression[callee.property.name='localeCompare']",
        message:
          "localeCompare 금지 — 코드유닛 비교(a < b ? -1 : …)를 써라(ICU 콜레이션은 기기별로 정렬 순서가 갈린다).",
      },
    ],
  },
};

/**
 * `apps/app`(Expo/React Native)에서 React Compiler 의 불변성 규칙을 끈다.
 *
 * 루트 eslint 는 `eslint-config-next` 를 쓰고 그게 `react-hooks/immutability` 를 켠다.
 * 그런데 Reanimated 의 SharedValue 는 **`.value` 대입이 곧 공개 API** 다 —
 * `progress.value = withRepeat(...)` 가 정본 사용법이고, 그 쓰기는 React 렌더 트리가 아니라
 * UI 스레드 런타임으로 간다. React Compiler 는 SharedValue 를 모델링하지 않아서 이걸 전부
 * "This value cannot be modified" 로 신고한다(실측: 스모크 3파일에서 8건).
 *
 * 파일마다 `eslint-disable` 을 뿌리면 M2 에서 화면이 늘 때마다 같은 줄이 번식한다.
 * 규칙 하나를 경로로 끄고 이유를 여기 한 번 적는 편이 정직하다.
 *
 * ★ 끄는 것은 이 규칙 **하나뿐**이다. 나머지 react-hooks 규칙(의존성 배열·조건부 훅 등)은
 *   그대로 살아 있다. 그리고 `src/**`(웹)에는 적용하지 않는다 — 거기엔 SharedValue 가 없다.
 *
 * 더 깊은 문제는 따로 있다: Expo 앱을 **Next 의 eslint 설정으로** 린트하고 있다는 것.
 * `apps/app/package.json` 에는 자체 `expo lint` 가 있는데 루트 체인이 그걸 안 부른다.
 * 정리는 M2 사안으로 남긴다(지금 바꾸면 앱 린트 커버리지가 통째로 흔들린다).
 */
const nativeMotionRules = {
  files: ["apps/app/src/**/*.{ts,tsx}"],
  rules: {
    "react-hooks/immutability": "off",
  },
};

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  packageBoundaries,
  formatterDiscipline,
  nativeMotionRules,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "public/sw.js",
    "docs/design/**",
  ]),
]);
