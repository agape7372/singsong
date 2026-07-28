// Metro loads this config through CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require("expo/metro-config");

const appRoot = __dirname;
const repoRoot = path.resolve(appRoot, "../..");
const packagesRoot = path.join(repoRoot, "packages");

/**
 * Metro는 앱 디렉터리 밖을 기본 감시하지 않는다. 네이티브 앱은 살아남는 순수 패키지의
 * TypeScript 소스를 직접 번들하므로 repo 패키지 루트를 명시적으로 연다.
 *
 * 앱 소스는 apps/app/node_modules를 먼저 보고, 순수 패키지는 루트 의존성까지 볼 수 있다.
 * packages/*는 lint 경계상 React를 import하지 않으므로 React 패치 버전 두 벌이 섞이지 않는다.
 * 계층 탐색은 expo-router의 중첩된 Metro 런타임을 찾는 데 필요하다.
 */
const config = getDefaultConfig(appRoot);

config.watchFolders = [packagesRoot];
config.resolver.nodeModulesPaths = [
  path.join(appRoot, "node_modules"),
  path.join(repoRoot, "node_modules"),
];

module.exports = config;
