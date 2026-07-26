# Windows 로컬 설치 — `--ignore-scripts` 가 필수인 이유

**로컬(Windows)에서는 `npm install --ignore-scripts`(= `npm run install:local`)를 쓴다.
CI·EAS 리눅스 워커에서는 평범한 `npm ci` 를 그대로 쓴다.**

## 증상

`npm install` 이 `@shopify/react-native-skia@2.6.2` 의 postinstall 에서 죽는다.

```
npm error code 3221226505
npm error command C:\Windows\system32\cmd.exe /d /s /c node scripts/install-libs.js
npm error -- Skia iOS package: ...\node_modules\react-native-skia-apple-ios
npm error -- Skia macOS package: ...\node_modules\react-native-skia-apple-macos
npm verbose exit -1073740791
```

`3221226505` = `0xC0000409` = `STATUS_STACK_BUFFER_OVERRUN` — Node 프로세스가 Windows fast-fail 로
즉사한 것이라 예외도 스택도 남지 않는다.

## 원인

Skia 2.6.x 는 프리빌트 바이너리를 별도 패키지 4개로 분리했다
(`react-native-skia-android` / `-apple-ios` / `-apple-macos` / `-apple-tvos`, 전부 `147.1.0`).
postinstall `scripts/install-libs.js` 가 그 바이너리를 `libs/` 로 복사한다.

크래시 지점은 **애플 프레임워크 복사의 첫 `fs.cpSync`** 다. 로그의 마지막 두 줄이
iOS·macOS 패키지 경로 출력(스크립트 66–67행)이고 그 다음 문장이 첫 `copySync` 다.

배제한 가설:

| 가설                    | 실측                                                        | 판정       |
| ----------------------- | ----------------------------------------------------------- | ---------- |
| 디스크 부족             | 여유 6.1 GB 에서도 동일 실패                                | 기각       |
| MAX_PATH 초과           | 최장 경로 153자, `LongPathsEnabled=0x1`                     | 기각       |
| 순환 심볼릭 링크 역참조 | `.xcframework` 안 심볼릭 링크 0개                           | 기각       |
| 대용량 파일 `cpSync`    | `libskia.xcframework` **한 개**만 직접 복사해도 동일 크래시 | **재현됨** |

즉 Node v24.11.1 의 `fs.cpSync` 가 이 트리를 Windows 에서 복사하다 네이티브 레벨에서 죽는다.
`0xC0000409` 는 /GS 스택 쿠키 전용이 아니라 Windows 의 공용 fail-fast 코드라
`abort()`/`RaiseFailFastException` 경로도 같은 값을 낸다 — 즉 JS 예외가 아니라 런타임 하드 중단이다.

알려진 계열: [nodejs/node#54476](https://github.com/nodejs/node/issues/54476)(Windows `fs.cpSync` 무출력 크래시),
[#61878](https://github.com/nodejs/node/issues/61878)(악센트 문자 경로에서 파일 누락),
[#54285](https://github.com/nodejs/node/issues/54285) · [#55267](https://github.com/nodejs/node/issues/55267).
Skia 쪽에도 Windows postinstall 선례가 있다 — [Shopify/react-native-skia#3779](https://github.com/Shopify/react-native-skia/issues/3779)
(2.5.3 에서 Unix `rm` 호출로 실패 → 순수 `fs.rmSync`/`fs.cpSync` 로 재작성). 그 재작성이 지금의 경로를 만들었다.

## 왜 그냥 건너뛰어도 되는가

1. `install-libs.js` 가 만드는 `libs/` 는 **네이티브 빌드(Xcode·Gradle)만** 읽는다.
   로컬에서 우리가 하는 일은 Metro 번들링과 `tsc` 뿐이라 JS 만 있으면 된다.
2. 이 PC 에는 JDK·Android SDK·Xcode 가 없다. 네이티브 빌드는 **전량 EAS 클라우드**다.
   EAS 워커는 프로젝트를 받아 **자체적으로 리눅스에서 설치를 다시 돌리므로** 거기서는
   postinstall 이 정상 실행되고 `libs/` 가 채워진다.
3. 이 의존성 트리에서 install-time 스크립트를 가진 패키지는 **Skia 하나뿐**이다(실측).
   따라서 `--ignore-scripts` 가 부수적으로 망가뜨리는 것이 없다.

```bash
# 확인 명령 — 새 패키지를 추가한 뒤에는 다시 돌려서 하나뿐인지 검증한다
node -e "const fs=require('fs'),p=require('path');const h=[];(function s(d,l){if(l>2)return;for(const x of fs.readdirSync(d,{withFileTypes:true})){if(!x.isDirectory())continue;const q=p.join(d,x.name);if(x.name[0]==='@'){s(q,l);continue}const j=p.join(q,'package.json');if(fs.existsSync(j)){const m=JSON.parse(fs.readFileSync(j,'utf8')).scripts||{};for(const k of ['preinstall','install','postinstall'])if(m[k])h.push(m.name||x.name)}}})('node_modules',0);console.log(h)"
```

## 하지 않은 것

- **`.npmrc` 에 `ignore-scripts=true` 를 넣지 않았다.** 그 파일은 EAS 워커에도 그대로 올라가므로
  리눅스에서까지 Skia 바이너리 복사가 꺼지고 Gradle 이 링크 단계에서 깨진다.
  플래그는 반드시 **명령줄에서만** 준다.
- Skia 버전을 올리지 않았다. `2.10.0` 은 SDK 57 버전맵 밖이고 네이티브 바이너리가 `150.0.0` 이라
  dev-client 를 다시 빌드해야 한다. 계획 문서 D3 의 "2.10.0" 은 **오기이며 정본은 2.6.2** 다.

## 새 의존성을 추가할 때

`npx expo install <pkg>` 는 내부적으로 `npm install` 을 호출하므로 같은 지점에서 죽는다. 순서:

```bash
npx expo install <pkg> --no-install   # package.json 에 SDK 정합 버전만 기록
npm run install:local                 # 실제 설치
npx expo-doctor                       # 20/20 확인
```
