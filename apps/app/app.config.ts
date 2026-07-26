import type { ExpoConfig } from "expo/config";

/**
 * 싱송 네이티브 앱 설정.
 *
 * 정본 계획: `.claude/plans/singsong-mossy-metcalfe.md`
 * 웹 플랫폼은 의도적으로 미포함(D2) — 웹 표면은 `services/share-api` 의 `/s/[slug]` 랜딩 한 장뿐이다.
 */
const config: ExpoConfig = {
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

export default config;
