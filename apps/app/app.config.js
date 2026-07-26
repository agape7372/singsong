/**
 * 싱송 네이티브 앱 설정.
 *
 * 정본 계획: `.claude/plans/singsong-mossy-metcalfe.md`
 * 웹 플랫폼은 의도적으로 미포함(D2) — 웹 표면은 `services/share-api` 의 `/s/[slug]` 랜딩 한 장뿐이다.
 *
 * **왜 `.ts` 가 아니라 `.js` 인가.** eas-cli 는 자체 번들 `@expo/config` 로 이 파일을 읽는데,
 * SDK 57 템플릿이 깔아 준 TypeScript 6 과 그쪽 TS 로더가 맞지 않아
 * `Cannot read properties of undefined (reading 'CommonJS')` 로 죽는다.
 * expo CLI 는 멀쩡히 읽으므로 증상이 명령마다 갈린다. JS 로 두면 어느 도구도 TS 로더를 타지 않는다.
 * 타입은 아래 JSDoc 이 대신하므로 편집기 자동완성은 그대로 남는다.
 *
 * @type {import("expo/config").ExpoConfig}
 */
const config = {
  name: "싱송",
  slug: "singsong",
  owner: "jiring",
  // 딥링크: singsong://s/{slug} — 정규식 정본은 packages/domain 이 갖는다(M5).
  scheme: "singsong",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  // 네이티브 산출물에만 반영된다. OTA 로는 바뀌지 않으므로 아이콘 교체 시 재빌드가 필요하다.
  icon: "./assets/images/icon.png",
  // 네이티브 지문이 바뀌면 런타임도 갈라진다 — 새 네이티브 모듈을 넣은 빌드에 옛 JS 번들이
  // 내려가 죽는 사고를 구조적으로 막는다. `appVersion` 정책이면 버전만 안 올리면 그게 벌어진다.
  runtimeVersion: { policy: "fingerprint" },
  updates: {
    url: "https://u.expo.dev/d107ba77-525d-4f79-9083-23cfaa428adc",
  },
  extra: {
    // eas-cli 가 동적 설정에는 자동 기입을 못 해서 손으로 넣는다.
    eas: { projectId: "d107ba77-525d-4f79-9083-23cfaa428adc" },
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.singsong.app",
  },
  android: {
    package: "com.singsong.app",
    // `edgeToEdgeEnabled` 는 SDK 57 설정 타입에서 사라졌다 — SDK 56+ 는 항상 edge-to-edge 라
    // 끌 수 있는 스위치가 아니다. 인셋은 safe-area-context 로 처리한다.
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundColor: "#faf7f0",
    },
  },
  plugins: [
    "expo-router",
    [
      "expo-build-properties",
      {
        android: {
          // 기본값은 ABI 4개(armeabi-v7a, arm64-v8a, x86, x86_64)이고 Skia 정적 라이브러리가
          // ABI 당 48~61MB 라 dev-client APK 가 318MB 까지 부푼다. 실기기는 전부 arm64-v8a 이고
          // x86 계열은 에뮬레이터 전용인데 이 PC 에는 Android SDK 가 없어 에뮬레이터를 못 띄운다.
          //
          // 이 플러그인이 gradle.properties 의 `reactNativeArchitectures` 를 직접 쓴다는 점이
          // 핵심이다. eas.json 의 `env: ORG_GRADLE_PROJECT_reactNativeArchitectures` 로는 안 된다 —
          // Gradle 우선순위가 "명령줄 > 시스템 속성 > gradle.properties > 환경변수" 라
          // prebuild 가 생성한 gradle.properties 가 환경변수를 이긴다. 조용히 무시되고
          // 318MB 가 한 번 더 나온다.
          //
          // ⚠ 이 값은 프로파일과 무관하게 전 빌드에 적용된다. 프로파일별로 가르려면
          // `process.env.EAS_BUILD_PROFILE` 분기를 넣어야 하는데, 환경변수로 갈리는 설정은
          // 조용히 어긋난 채 배포되는 사고를 낸다(종이톡 데모모드 6일 회귀가 그 사례다).
          // 그래서 하나로 못박는다. **첫 스토어 릴리스 전에 armeabi-v7a 복원 여부를 결정할 것** —
          // 32비트 전용 기기는 긴 꼬리지만 스토어 배포는 내부 설치와 커버리지 기준이 다르다.
          buildArchs: ["arm64-v8a"],
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 160,
        backgroundColor: "#faf7f0",
        dark: { backgroundColor: "#16111c" }, // --canvas (dark)
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    // React Compiler 는 SDK 57 템플릿 기본값이지만 M0 스파이크에서는 끈다.
    // Skia/worklets 실패를 컴파일러 탓으로 오귀인하지 않기 위한 변수 축소이며,
    // M2 진입 시 켜고 재측정한다.
    reactCompiler: false,
  },
};

module.exports = config;
