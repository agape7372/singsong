// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require("expo/metro-config");

/**
 * SDK 57의 expo/metro-config는 on-demand filesystem과 tsconfig paths를 직접 지원한다.
 * 수동 watchFolders/nodeModulesPaths는 Linux의 상위 경로·symlink 정규화와 충돌할 수 있으므로
 * 설정하지 않는다. 앱은 공유 패키지와 그 런타임 의존성을 package.json/tsconfig에 명시한다.
 */
module.exports = getDefaultConfig(__dirname);
