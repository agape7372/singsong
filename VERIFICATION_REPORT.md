# SingSong Verification Report

이 문서는 실행 증거의 최종 진입점이다. 소스나 테스트 파일의 존재와 실제 명령 PASS를 구분하며 `docs/verification/QA_MATRIX_V3.md`의 최종 행 판정과 함께 읽는다. local fixture production artifact의 성공을 실제 release/production 성공으로 승격하지 않는다.

## 네이티브 저장소 완료 검증 — 2026-07-28

이 절이 현재 제품 경로의 최신 판정을 소유한다. 아래의 Next/PWA 절은 롤백 기준선과 과거
실행 기록이며 네이티브 배포 증거가 아니다.

| 항목 | 값 |
| --- | --- |
| Branch / base HEAD | `rebuild/expo-monorepo` / `1abfaca` |
| Runtime | Node `v24.11.1`, npm `11.6.2`, Windows, Asia/Seoul |
| 제품 경로 | `apps/app` + `services/share-api` + `packages/*` |
| 저장소 판정 | `NATIVE_REPOSITORY_READY` |
| Production 판정 | `BLOCKED_EXTERNAL` |

| Gate | 상태 | 실행 결과 |
| --- | --- | --- |
| Root frozen install | `PASS` | `npm ci --ignore-scripts --include=optional --no-audit`; 528 packages |
| Monorepo 구조 | `PASS` | 17/17, Linux/WASI optional lock 항목 포함 |
| Guard/tokens | `PASS` | guard tests 20/20; 고유 token 56, 선언 102 |
| Format/lint/type | `PASS` | Prettier 전체, ESLint warning 0, `tsc --noEmit` |
| M1 core | `PASS` | 맨 Node 헤드리스 gate 12/12 |
| Root coverage | `PASS` | 64 files / 504 tests; statements 83.53%, branches 76.02%, functions 84.11%, lines 85.69% |
| Expo app | `PASS` | lint, typecheck, 1 file / 15 tests |
| Expo dependency health | `PASS` | Expo doctor 20/20, `expo install --check` 최신 |
| Android bundle | `PASS` | React Compiler + Hermes, 2,220 modules, 약 5.6MB HBC |
| Share API | `PASS` | typecheck/build, 6 files / 144 tests, fixture route smoke |
| Share landing browser | `PASS` | 실제 API create, script-free HTML/SVG, absolute OG, axe, revoke/unknown 404 — 3/3 |
| Preserved Next build | `PASS` | Next 16.2.11 Webpack fixture production build, 모든 route 생성 |
| Runtime dependency audit | `PASS` | app 전체 0건, root `npm audit --omit=dev` 0건 |
| Full root audit | `TRACKED_DEV_ONLY` | 보존된 ESLint/minimatch 3의 `brace-expansion` high 9건 |
| Share production preflight | `PASS_FAIL_CLOSED` | 운영 입력 없이 `BLOCKED_EXTERNAL`, exit 1, blocker 이름만 출력 |
| EAS build hook | `PASS_FAIL_CLOSED` | local profile은 skip; production origin 없이는 `BLOCKED`, exit 1 |

전체 감사 숫자를 낮추기 위한 `brace-expansion` 5 전역 override는 사용하지 않는다.
`minimatch` 3은 CommonJS 함수 export를 호출하지만 5.x는 객체를 export하므로 실제
`TypeError`를 만든다. 대신 운영 취약점인 Next 내부 PostCSS를 `8.5.23`, Sharp를 `0.35.3`으로
패치했고 `minimatch` 3의 1.x 호출 계약도 별도 smoke로 확인했다. 개발 도구 체인은 upstream
교체 전까지 별도 추적한다.

첫 Playwright 실행은 managed sandbox가 Chromium spawn을 `EPERM`으로 막아 세 테스트가
브라우저 시작 전에 실패했다. 같은 source/server/assertion을 승인된 실행 경계에서 다시 돌려
3/3 PASS했으며 fixture server의 HTTP 200도 별도로 확인했다.

최종 코드 리뷰는 계산 저장 직후 provider observer가 늦게 반영되면 이전 revision 티켓까지
동결될 수 있는 P1 race를 발견했다. 플랜 화면이 mutation queue의 최신 committed plan을 읽어
`/ticket/<revision>`을 명시하고, 티켓 화면도 발권 직전에 SQLite active plan을 재조회하도록
고쳤다. 준비되지 않은 플랜은 route를 만들지 않는 계약을 추가한 뒤 앱 15/15를 재실행했다.

다음 항목은 저장소에서 닫을 수 없어 `BLOCKED_EXTERNAL`이다.

- 권리 승인 production catalog와 서명된 manifest
- 실제 Supabase migration/ACL/RPC/TTL, Redis와 trusted proxy 수신 헤더
- stable HTTPS origin의 association/OG crawler/Kakao preview와 운영 관측
- Expo 계정·release certificate·clean commit을 사용한 production APK와 OTA manifest
- Android/iOS 실기기 PNG 저장/공유, TalkBack/VoiceOver, IME, 폰 A→B handoff
- 위 증거가 닫힌 뒤의 Next/PWA 트리 삭제

## Folded Session S 아이콘 반영 최신 검증 — 2026-07-23

| Gate | 상태 | 최신 결과 |
| --- | --- | --- |
| Brand decision | `PASS` | 최종 후보 8안 중 Folded Session S를 현재 적용안으로 선택; 생성 PNG를 제어된 `public/icons/icon.svg`로 재작도 |
| Full Vitest | `PASS` | 39 files / 194 tests |
| Fixture build | `PASS` | public-origin Next.js 16.2.11 Webpack production build와 Serwist worker 재생성 |
| Built PWA artifact | `PASS` | precache 49, forbidden 0, `folded-session-s-{180,192,512}.png` 3개 필수 asset 포함 |
| Public responses | `PASS` | root·manifest·service worker·새 icon 200; manifest 192/512 refs, header/metadata와 Apple 180 ref 확인 |
| Public icon bytes | `PASS` | 192px 공개 SHA-256 `8C489B93735AEBCF1CFCC5205132DFB2DEB4F6346ACB87DA67CAD4349AD1E4FF`, local master 파생본과 일치 |
| Public Chromium PWA | `PASS` | Quick Tunnel 실제 origin에서 3/3; generic OG/security, offline shell/cache exclusion, explicit waiting-worker consent |
| Public visual | `PASS` | Pixel 5 캡처에서 헤더의 이전 hardcoded S가 Folded Session S로 교체됨 |
| Runtime | `ACTIVE_PREVIEW` | app PID 43664, tunnel PID 43376, `127.0.0.1:34173`; runtime cache `singsong-static-v2` |
| Native install sheet | `BLOCKED_EXTERNAL` | Android Chrome에서 기존 dialog 취소·재접속 뒤 새 icon 표시를 사용자가 실기기에서 최종 확인해야 함 |

이 변경은 두 원인을 분리해 닫았다. 설치 창은 같은 icon URL을 쓰던 기존 CacheFirst worker가 묵은 bytes를 반환했고, 헤더는 asset과 무관한 `S` 텍스트를 별도 렌더링했다. 새 고유 icon 경로, worker cache v2, 헤더 image 연결, production rebuild/restart를 함께 적용했다. 기존 icon 파일명은 이미 설치된 클라이언트 호환 alias로 남겼으며 사이트 데이터 삭제는 Dexie 플랜 손실 위험 때문에 해결 절차로 사용하지 않는다.

## Station 재게시 기준 검증 — 2026-07-23

이 절은 아래의 보존된 출시 후보 검증 이후 수행한 UI 리뉴얼의 최신 증거다. 제품·보안·release gate 판정은 바꾸지 않으며, 아래 기존 37-file/185-test 기록보다 이 절의 UI 회귀 결과가 최신이다.

| Gate | 상태 | 최신 결과 |
| --- | --- | --- |
| Format | `PASS` | 전체 Prettier check 통과 |
| Lint | `PASS` | 전체 ESLint, warning 0 |
| Typecheck | `PASS` | TypeScript `--noEmit` |
| Unit/integration/static | `PASS` | Vitest 39 files / 194 tests |
| Fixture build | `PASS` | `main` public-origin Next.js 16.2.11 Webpack production build, 모든 route 생성 |
| Public browser | `PASS` | Quick Tunnel 대상 Chromium 20 discovered: 13 pass / 7 intentional project-gated skip |
| Visual review | `PASS` | 공개 390px Station 화면, count 18.4px/900, 완료 중앙 오차 0px, overflow 0 |
| Existing public preview | `ACTIVE_PREVIEW` | app PID 43664와 tunnel PID 43376, 전용 34173 포트; 기존 public Chromium 13/7, 최신 PWA 3/3 |

첫 Chromium 재실행은 managed sandbox가 browser process spawn을 `EPERM`으로 차단했다. 동일 build/source를 승인된 실행 경계에서 재실행했고 3개 시나리오가 5.2초에 모두 통과했다. 임시 3100 서버와 캡처 스크립트는 검수 직후 정리했다.

사용자의 명시적 재게시 승인에 따라 기존 stale app PID 26232를 검증 후 종료하고 Station build를 재게시했다. 이후 싱송 프로세스가 종료된 공용 3000번 포트를 Podoal이 점유해 기존 터널이 다른 앱을 노출했다. 기존 tunnel PID 32848만 종료하고 Podoal은 건드리지 않았으며, Station을 전용 34173번 포트와 새 Quick Tunnel origin으로 다시 빌드·재게시했다. stable production gate 판정은 그대로 `BLOCKED_EXTERNAL`이다.

## 판정 어휘

| 상태               | 의미                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `PASS`             | 명령을 실제 실행했고 exit code와 artifact를 확인함                                                     |
| `FAIL`             | 실행 결과가 수용기준을 만족하지 못함                                                                   |
| `NOT_RUN`          | 저장소에서 실행할 수 있으나 이 최종 run의 증거가 아직 없음                                             |
| `BLOCKED_EXTERNAL` | 권리·credential·인프라·도메인·실기기·사람 권한이 필요함                                                |
| `ACTIVE_PREVIEW`   | 사용자가 확인 중인 임시 runtime을 owner가 의도적으로 유지함; production deploy나 clean shutdown이 아님 |

정적·fixture·mock 결과는 실제 Supabase, Turnstile, production domain, 실제 기기 또는 사용자 연구 PASS로 승격하지 않는다.

## 검증 subject

| 항목                    | 값                                                                                |
| ----------------------- | --------------------------------------------------------------------------------- |
| Run ID                  | `683054d4ee774d5ea65dedb69d21145c`                                                |
| Branch                  | `main`                                                                            |
| Verified app HEAD       | `125835d`                                                                         |
| Required Node pin       | `.nvmrc`의 `24.18.0`                                                              |
| Final runtime           | Node `v24.18.0`, pnpm `11.9.0`, Git `2.52.0.windows.1`                            |
| Profile contract        | `fixture` / `release`; 내부 release runtime은 production 호환값 사용              |
| Local capability        | `LOCAL_DEMO_READY`: verified fixture production release candidate                 |
| Production gate         | `BLOCKED_EXTERNAL`; permanent deploy not performed                                |
| Temporary phone preview | `ACTIVE_PREVIEW/READY`: app PID 43664, tunnel PID 43376, port 34173               |

## 최종 자동검증

| Gate                                        | 명령/환경                                             | 상태             | 결과·증거                                                                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime pin                                 | `node --version`, `pnpm --version`                    | `PASS`           | `v24.18.0`; `11.9.0`                                                                                                                                                                    |
| Dependency security                         | `pnpm audit --audit-level=low` (prod+dev)             | `PASS`           | Next 16.1.7에서 발견된 15건(High 8건)을 Next/ESLint config 16.2.11과 `next>postcss` 8.5.20으로 수정; 최종 exit 0, known vulnerability 0                                                 |
| Supply-chain lock policy                    | frozen lock + pnpm policy inspection                  | `PASS`           | 613 lock entries; exact dependency versions, build allowlist 2개, 신규 Next patch용 exact 12-entry release-age exception                                                                |
| Frozen install                              | `pnpm run install:frozen`                             | `PASS`           | current 506 packages; 233-path clean reused 506/downloaded 0; lock/hash unchanged, exit 0                                                                                               |
| Format                                      | `pnpm format:check`                                   | `PASS`           | mobile-shell current와 233-path clean exit 0                                                                                                                                            |
| Lint                                        | `pnpm lint`                                           | `PASS`           | mobile-shell current와 clean exit 0, warning 0                                                                                                                                          |
| Typecheck                                   | `pnpm typecheck`                                      | `PASS`           | mobile-shell current와 clean exit 0                                                                                                                                                     |
| Unit/integration/static                     | full Vitest                                           | `PASS`           | current 39 files/194 tests; retained clean baseline 37 files/185 tests                                                                                                                   |
| Coverage — retained baseline                | pre-shell Vitest coverage artifact                    | `PASS`           | 30-file/163-test baseline: statements 82.48% (1375/1667), branches 76.12% (934/1227), functions 86.77% (269/310), lines 85.24% (1288/1511)                                              |
| Coverage — current mobile shell             | current·clean 37-file suite with coverage             | `PASS`           | 둘 다 statements 82.27% (1560/1896), branches 75.47% (1074/1423), functions 86.06% (315/366), lines 84.91% (1464/1724); 기준 하향 없이 threshold 통과                                   |
| Contract subset — retained                  | `pnpm test:contract`                                  | `PASS`           | shell 이전 4 files/21 tests; canonical/validation 계약은 shell 변경에서 수정되지 않음                                                                                                   |
| Fixture build — current                     | `pnpm build:demo`                                     | `PASS`           | CUTLINE mobile-shell current tree, Next 16.2.11, production artifact 생성 성공                                                                                                          |
| Fixture build — clean baseline              | 이전 219-path clean source evidence                   | `PASS`           | Next 16.2.11, 18.0s, warning 0; 새 13개 shell 경로의 clean-copy 증거로 사용하지 않음                                                                                                    |
| Fixture build — current 233-path clean copy | 새 writable clean source archive                      | `PASS`           | Next 16.2.11 Webpack fixture build; compile 5.9s, type 2.8s, all routes 생성                                                                                                            |
| Dev webpack runtime                         | actual `next dev --webpack`                           | `PASS`           | GET `/` 200, 15,630 bytes, SingSong present                                                                                                                                             |
| Built PWA artifact                          | `node scripts/verify-built-pwa.mjs`                   | `PASS`           | current precache 49/forbidden 0/required brand assets 3; retained clean baseline precache 45/forbidden 0                                                                                |
| Main HTTP smoke                             | explicit fixture production profile                   | `PASS`           | home/ticket/OG 200; OG 30,423 bytes; home modern JS gzip 167,035 bytes                                                                                                                  |
| Clean HTTP smoke                            | 233-path clean fixture production profile             | `PASS`           | home/ticket/OG 200; OG 30,423 bytes; home modern JS gzip 167,056 bytes                                                                                                                  |
| Core browser E2E                            | public Quick Tunnel Chromium projects                 | `PASS`           | final public-origin run, retries 0: 20 discovered, 13 pass, 7 intentional project-gated skip                                                                                            |
| Built PWA browser                           | final Chromium production-artifact config             | `PASS`           | 최신 public origin 3/3 pass; generic OG/security, offline shell, explicit waiting-worker consent                                                                                       |
| Public preview SW control                   | Pixel 7/5 Chromium profile on Quick Tunnel            | `PASS`           | `/` 200; same-origin controller `sw.js`; new icon precache와 runtime cache `singsong-static-v2` 확인                                                                                   |
| Icon metadata                               | sharp + manifest/public response                      | `PASS`           | `folded-session-s-{180,192,512}.png`, sRGB·opaque; manifest 192/512 maskable refs와 Apple/header metadata exact                                                                       |
| Lab navigation                              | 4× CPU, 40ms, 10/5Mbps; cold·warm each 5              | `PASS`           | cold LCP median/worst 324/336ms, TBT 234/240ms, CLS 0.0005; warm LCP 92/144ms, TBT 0                                                                                                    |
| Home initial JS                             | HTML modern route scripts, gzip level 9               | `PASS`           | current 167,035 bytes < 174,080-byte provisional limit                                                                                                                                  |
| Search distribution                         | fixed fixture corpus/distribution                     | `PASS`           | overall p95 15.7ms                                                                                                                                                                      |
| Scripted UI                                 | throttled calculation/ticket navigation               | `PASS`           | calculation median/worst 14/23.7ms; ticket navigation 505ms                                                                                                                             |
| Field performance                           | same release/region/device-class RUM/CrUX p75         | `NOT_RUN`        | sample `NONE`; result `NOT_RUN + NONE`, never zero/PASS                                                                                                                                 |
| Aggregate demo gate                         | equivalent `verify:demo` component composition        | `PASS`           | current와 clean의 모든 component exit 0; no fabricated single aggregate-process exit                                                                                                    |
| Release fail-closed                         | credentials 없는 `pnpm preflight:release`             | `PASS`           | expected exit 1, deterministic `BLOCK_EXTERNAL`, 13 required env names; no values logged                                                                                                |
| Temporary phone preview                     | dedicated-port fixture app + Cloudflare Quick Tunnel  | `ACTIVE_PREVIEW` | app PID 43664/tunnel PID 43376/port 34173; Folded Session S assets 200; public Chromium 13/7와 최신 PWA 3/3 |

## 환경 재시도

- audit/install의 첫 sandbox 실행은 package/cache 접근 `EACCES`로 차단됐다. 승인된 동일 audit와 exact install은 각각 known vulnerability 0과 10.2s/506 packages로 PASS했고 lockfile은 바뀌지 않았다.
- Next 16.1.7에서 남은 `.next` type output은 소스가 아닌 generated artifact였고 `clean:generated` 경로로만 제거한 뒤 Next 16.2.11에서 재생성했다.
- shell 이전 cold coverage 중 OG integration은 기본 5초 ceiling에서 한 번 timeout됐다. assertion을 바꾸지 않고 integration ceiling을 15초로 명시한 뒤 targeted 4/4와 당시 full 163 tests가 PASS했다. 최종 185-test coverage는 별도 current run의 exact 수치다.
- frozen install 재생성 한 번이 sandbox timeout으로 끝났고, 승인된 동일 exact install은 current 10.2s와 clean 5.1s로 PASS했다.
- shell 이전 Next build가 clean copy의 `next-env.d.ts` import directive만 자동 갱신했다. 그 219-path clean evidence는 보존하되, 현재 source appendix는 새 shell/coverage 경로 14개를 포함해 actual/listed 233/233, missing/extra 0으로 다시 계산했다.
- Chromium 첫 spawn은 managed sandbox `EPERM`이었다. 승인된 browser 검증과 mobile-shell 추가 회귀의 최신 합계는 E2E 13 pass/7 project-gated skip, PWA 3 pass다.
- 아이콘 반영 뒤 첫 PWA 재검증은 public hostname용 build를 localhost:3200에서 실행해 origin guard가 search 403을 반환했다. 제품 assertion을 바꾸지 않고 같은 build를 실제 Quick Tunnel origin에 연결해 3/3을 재실행했고 모두 PASS했다.
- 최초 preview app은 localhost origin으로 build돼 public search가 403이었다. 코드를 우회하지 않고 `NEXT_PUBLIC_SITE_URL`을 Quick Tunnel hostname과 일치시켜 rebuild/start했고 public search/share와 전체 phone-profile flow가 PASS했다.
- Station hotfix 직후 첫 공개 모바일 skip-link run은 이전 service-worker 전환 중 한 번 실패하고 retry에서 PASS했다. 갱신 뒤 retries 0의 3회 연속 targeted run과 전체 public-origin 13/7 suite가 모두 PASS해 전환을 닫았다.
- 기존 `bond-athletics-calculations-putting` 터널은 싱송 PID 30596 종료 뒤 Podoal이 공용 3000번 포트를 점유하면서 서버측 응답 자체가 Podoal로 바뀌었다. client cache를 배제하고 tunnel target을 확인한 뒤 PID 32848만 종료했다. 싱송을 전용 34173번 포트에서 public hostname 기준으로 다시 build/start하고 새 origin에서 홈·14개 자산·모바일 identity/overflow 및 전체 Chromium 13/7을 재검증했다.
- 233-path clean install의 첫 sandbox registry 접근은 `EACCES`였고 승인된 같은 frozen install은 506 packages reused/downloaded 0으로 exit 0이었다. lockfile과 package policy는 바뀌지 않았다.
- clean typecheck가 새 BottomSlot test mock 6곳의 암묵적 type을 발견했다. 제품 코드나 threshold를 낮추지 않고 `tests/unit/bottom-slot.test.tsx`에 명시적 test mock type을 추가·sync한 뒤 current/clean format·lint·type·37/185 coverage·build를 전부 재실행해 PASS했다.
- clean build와 final evidence 문서 sync 뒤 exclusion 규칙을 다시 적용한 current↔clean source는 233/233, missing 0, SHA-256 mismatch 0이다.

이 항목들은 해결된 generated-state 또는 환경/timeout 재시도다. 최초 결과를 숨기지 않았고 최종 PASS는 같은 dependency/source와 의미가 유지된 assertion에서만 판정했다.

## 구현별 자동화 소유권

이 표는 테스트의 존재와 수용기준을 추적한다. 실제 PASS 여부는 바로 위 root 결과가 채워진 뒤에만 확정된다.

| 영역               | 테스트/검사                                                                                                          | 현재 판정                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 계산               | oracle/property, block·bundle·overflow·reverse boundary                                                              | `PASS`                                                                                                                |
| canonical share    | 100곡 4-byte golden, exact 96KiB/96KiB+1, raw 128KiB/128KiB+1                                                        | `PASS`                                                                                                                |
| Dexie              | revision CAS, migration v4, import duplicate, receipt/secret atomicity                                               | `PASS`                                                                                                                |
| planner UX         | 새 플랜 확인/되돌리기, 삭제/검색 undo, 중복 확인, 100곡                                                              | `PASS`                                                                                                                |
| mobile app shell   | compact header, 2-item nav DOM 1개, Working Strip/perforation, ActionDock/PlanRail, 25% fixed cap·200% flow fallback | `PASS`                                                                                                                |
| install affordance | Android explicit prompt, iOS Safari steps, standalone/immersive suppression, dismiss/error                           | unit `PASS`; 14일·temporary-host branch는 code inspection; public SW control `PASS`; actual device `BLOCKED_EXTERNAL` |
| 검색               | POST/body limit, IME pause, abort/sequence, manual fallback                                                          | `PASS`                                                                                                                |
| Ticket             | semantic content, concurrent seed, reduced motion, 1080×1350 nonblank PNG                                            | `PASS`                                                                                                                |
| 공유               | create/read/revoke, response-loss/idempotency, key version, generic unavailable                                      | fixture/integration `PASS`; real DB `BLOCKED_EXTERNAL`                                                                |
| OG                 | 1200×630, unavailable fallback, no-store                                                                             | local `PASS`; production crawler/domain `BLOCKED_EXTERNAL`                                                            |
| PWA                | cache exclusions, offline shell, waiting-worker dismiss/consent, scoped kill switch                                  | `PASS`                                                                                                                |
| 보안               | secret/client import, CSP/header, SQL ACL text, body/origin/log redaction                                            | repository `PASS`; hosting logs `BLOCKED_EXTERNAL`                                                                    |
| release startup    | pure env contract, validation-before-RPC, active/historical key readiness                                            | repository `PASS`; real Supabase startup `BLOCKED_EXTERNAL`                                                           |
| 접근성/반응형      | axe, keyboard skip-link/focus, 320/390/768/1440, 200%/400%, forced/reduced                                           | Chromium `PASS`; real AT/device `BLOCKED_EXTERNAL`                                                                    |
| 성능               | cold·warm lab, JS gzip, search/calculation/ticket; field p75                                                         | lab/scripted `PASS`; field `NOT_RUN + NONE`                                                                           |

## 외부·수동 release gate

| Gate                                  | 상태               | 필요한 증거와 owner                                                                                                      |
| ------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Actual release build/artifact/browser | `BLOCKED_EXTERNAL` | 13개 필수 env, 서명된 catalog rights manifest, 실제 provider·Supabase·Turnstile·stable HTTPS host; Quick Tunnel은 불충분 |
| Real release startup/key readiness    | `BLOCKED_EXTERNAL` | 운영 Supabase required-key RPC와 secret-manager의 active/historical key evidence                                         |
| Production catalog rights/quality     | `BLOCKED_EXTERNAL` | provider·product·legal의 서면 manifest, provenance, coverage, golden corpus                                              |
| 실제 Supabase ACL/RPC/race/scheduler  | `BLOCKED_EXTERNAL` | infra owner의 새 project, migration, role snapshot, cleanup 관찰                                                         |
| Legacy Supabase key disable           | `BLOCKED_EXTERNAL` | project owner의 Dashboard 증거와 raw key 없는 old-key 401 probe                                                          |
| Production Turnstile/rate limit       | `BLOCKED_EXTERNAL` | security/domain owner의 exact hostname/action/time/replay/timeout·trusted proxy 증거                                     |
| HTTPS domain/CDN/hosting logs         | `BLOCKED_EXTERNAL` | release owner의 no-store/noindex/no-referrer/CSP와 redacted log sample                                                   |
| Backup/restore/monitoring/rollback    | `BLOCKED_EXTERNAL` | ops owner의 RPO/RTO rehearsal, alerts, immutable artifact rollback                                                       |
| Legal/privacy/takedown/brand          | `BLOCKED_EXTERNAL` | named legal/product/ops approval와 연락/SLA                                                                              |
| iOS/Android/Kakao/PWA/AT devices      | `BLOCKED_EXTERNAL` | QA의 Safari/Chrome/Kakao/VoiceOver/TalkBack manual matrix                                                                |
| 실제 organizer/recipient 연구         | `BLOCKED_EXTERNAL` | consented study와 비식별 evidence ledger                                                                                 |
| Production deploy                     | `NOT_RUN`          | Quick Tunnel은 phone review용 temporary preview이며 permanent deploy가 아님                                              |

## Build capability 판정

- 현재 최고 확인 상태는 `LOCAL_DEMO_READY`다. Next 16.2.11의 최신 Station source는 정적검사·194 tests·public-origin fixture build·공개 Chromium 전체 회귀와 최신 PWA 3/3을 통과했다. 리뉴얼 전 byte-exact 233-path clean source의 185 tests·coverage·build/smoke/PWA artifact와 browser E2E/PWA/performance는 별도 보존 증거다. 임시 public preview는 `ACTIVE_PREVIEW/READY`이지만 stable production으로 승격하지 않는다.
- production gate: `BLOCKED_EXTERNAL`.
- HTTP smoke나 home JS gzip 한 항목만 통과해도 전체 성능 gate를 `PASS`로 올리지 않는다. lab·search·field 표본은 각각 독립 판정한다.
- 에이전트는 `RELEASED`를 선언하지 않는다.

## 증거 위치와 보존

- retained pre-shell clean root: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-clean-release-final-683054d4ee774d5ea65dedb69d21145c/` (219-path baseline only)
- retained pre-shell E2E root: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-playwright-next16211-final-683054d4ee774d5ea65dedb69d21145c/`
- retained pre-shell PWA root: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-playwright-pwa-next16211-final-683054d4ee774d5ea65dedb69d21145c/`
- current 233-path clean reproduction: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-clean-shell-20260722-1033/`; final source 233/233, missing 0, SHA mismatch 0 after evidence-doc sync
- retained pre-renewal coverage: `coverage/coverage-summary.json` (2026-07-22 10:39:17+09:00), full 37/185 command exit 0; latest 39/194 run은 coverage를 재측정하지 않음
- current E2E: `C:/Users/agape/AppData/Local/Temp/singsong-playwright/e2e/report/index.html` (2026-07-22 10:12:17+09:00)와 `e2e/playwright/.last-run.json` status `passed`
- current PWA: `C:/Users/agape/AppData/Local/Temp/singsong-playwright/production-pwa/report/index.html` (2026-07-23 07:53:48+09:00)와 `production-pwa/results/.last-run.json` status `passed`
- phone preview: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-phone-preview/`의 tunnel log, `app-folded-session-s.stdout.log`, `folded-session-s-mobile.png` (2026-07-23 07:54:16+09:00); running app PID 43664와 Quick Tunnel PID 43376.
- repository `test-results/**/.last-run.json`은 이전 실패 run의 generated metadata이므로 이 최종 PASS의 근거로 사용하지 않는다.
- generated build: `.next/`, `public/sw.js`, `public/swe-worker-*`
- 초기 자료·Git 보존: `MATERIAL_INVENTORY.md`, `MD_READ_LEDGER.md`, `GIT_HISTORY_AUDIT.md`, `FINAL_MATERIAL_AUDIT.md`

Generated/runtime artifact는 source manifest에 섞지 않는다. 최종 보고는 명령, exit code, 실행 시각, environment subject와 artifact 경로가 모두 있을 때만 `PASS`로 바꾼다.

## 실기기 녹화 회귀 수리 검증 — 2026-07-25

2026-07-25 02:14 Android Chrome(터널 프리뷰) 녹화에서 드러난 결함을 수리한 뒤의 재검증이다.

| Gate | 상태 | 결과 |
| --- | --- | --- |
| Prettier (`src`, `tests`) | `PASS` | 전 파일 통과. 저장소 전체 `--check .`는 `design-lab/`·`docs/`·`scripts/` 13파일에서 실패하나 HEAD에서 이미 실패하던 선행 상태이며 이번 변경 범위 밖이다 |
| ESLint / TypeScript | `PASS` | `--max-warnings=0`, `tsc --noEmit` 무출력 |
| Vitest | `PASS` | 41 files / 208 tests (신규: `josa`, PNG 내보내기 계약, 묶음 요금 경계) |
| Playwright E2E | `PASS` | `--retries=0`으로 13 passed / 7 project-gated skip |
| Playwright PWA | `PASS` | 3/3 (fixture production artifact) |

주의 — 이번 수리 전 E2E는 **8 failed / 2 passed**였다. 4탭 IA 재설계에서 사라진 `/search` 라우트와
`PlanRail`을 스펙이 계속 참조하고 있었기 때문이며, 이 문서의 이전 "public Chromium 13/7" 기록은
그 머지 이전 상태를 가리킨다. 스펙을 bottom sheet 기준으로 이관했다.

E2E가 새로 잠근 계약:
- 내보낸 PNG에서 장미색 픽셀 20,000개 이상 + 우측 밴드 비백지(이전 `dominant > 230` 단언은 캔버스
  우측 45%가 백지로 남던 버그 덕분에 통과했다). dark colorScheme 케이스에서도 동일 확인.
- `.search-ledger-head`의 sticky `top`이 `0px`이고 다음 헤딩과 겹치지 않을 것.
- 400% 글자 확대에서 헤더 가로 오버플로 0 — 이 단언이 4탭 헤더의 실제 reflow 결함(오버플로 675px)을
  잡아냈고 `.site-header-inner`/`.primary-nav` 줄바꿈 허용으로 수리했다.

### 2차 — 07:42 실기기 재현 결과 반영

1차 수리 후 재배포한 프리뷰에서 사용자가 전체 플로우를 다시 돌렸다. **1차 P0 2건은 현장에서 해결 확인**:
저장된 PNG의 장미·황토·크림 색이 화면과 일치하고 캔버스를 가득 채웠으며, 카카오톡으로 공유한
`/s/…` 링크와 OG 카드가 정상 렌더됐다.

2차에서 잡은 결함과 수리:

| 결함 | 근거 | 수리 |
| --- | --- | --- |
| 내보낸 PNG의 컴포지션 밴드 하단 잘림 | 저장 PNG에서 도형 아래가 스텁 점선에 잘리고 황토 사각형이 조각만 남음 | 세 블록 높이 합 716px > 675px라 컴포지션만 눌렸다. 헤더를 `flex:1`로, 컴포지션·스텁을 `flex:none`으로 뒤집고 헤더 치수 축소. TEST DATA 배지는 스텁으로 이동 |
| 앞면 `탭 · 뒤집기` 배지가 총액을 가림 | 녹화 | `.flip-toggle::after`를 카드 상단 우측으로 이동 |
| PWA 설치 배너가 첫 화면을 크게 먹음 | 녹화 | 한 줄로 축약, 임시 주소 경고만 조건부 유지 |
| 공유받은 페이지에 곡 목록이 두 번 | 사용자 지적 | `/s/[slug]` 하단 `.shared-ledger` 섹션 삭제(제목까지 뒷면과 동일했다). 뒷면 플립은 `role=button`+`aria-pressed` disclosure라 접근성 손실 없음 |

E2E가 새로 잠근 계약: 내보낸 PNG에서 장미색이 처음/마지막으로 나타나는 행(`roseTop < 300`,
`roseBottom > 1000`) — 컴포지션이 눌리면 마지막 행이 올라와 실패한다.

재검증: Prettier(저장소 전체)·ESLint·TypeScript PASS, Vitest 41 files / 208 tests,
Playwright E2E 13 pass / 7 skip(`--retries=0`), PWA 3/3.

### 3-렌더러 디자인 일관성 통일 — 2026-07-26

티켓이 화면 DOM·PNG 내보내기·공유 OG 세 벌로 따로 그려지면서 색·형태·표기가 모두 어긋나 있었다
(`VISUAL_MOTION_DIRECTION.md:36,695` 위반). 그림을 데이터 한 벌로 빼고 세 렌더러가 해석만 하게 바꿨다.

| 항목 | 전 | 후 |
| --- | --- | --- |
| 정본 | 세 파일에 좌표·색·문구 각각 하드코딩 | `src/features/ticket/ticket-artwork.json` 한 곳 (zod 검증) + `ticket-art.ts` 해석기 |
| 종이/로즈/금액 | `#f6efdc`·`#F4EFE3`·`#FFFFFF` / `#ff3d6e`·`#FF2E74`·seed 3색 / `#8a5200`·`#B76E00`·없음 | 세 면 모두 `#f6efdc` / `#ff3d6e` / `#8a5200` |
| OG seed 팔레트 | 로즈·황토·**파랑 `#3B64D8`** 로테이션 | 삭제. 파랑은 앱에 없는 색이고 `--focus`와 충돌했다 |
| 형태 | 라운드 24/0/0 · 타공 열/없음/원 · 그레인 O/약함/없음 · 하프톤 화면만 | 라운드 24px 공통, 좌우 타공 열, 카드 전체 그레인, 곡수 하프톤 모두 |
| 표기 | `₩8,000`↔`KRW 8,000`, `6`↔`06 곡`, `공유 시 30일`↔`UNLISTED · 30 DAYS`, `NO.`↔`#` | 한국어 표기로 통일 |
| 정렬 | 화면만 중앙 정렬 | 셋 다 좌측 (`VISUAL_MOTION_DIRECTION.md:79-82`) |

**렌더러별 제약을 넘긴 방법**: 그림을 자립 SVG 문자열로 만들어 PNG는 `<img>`로, OG는 base64 데이터
URI `<img>`로 넣는다. Satori는 CSS 필터를 못 그리지만 그 뒤의 resvg가 SVG 안의 `feTurbulence`·
`pattern`·`clipPath`를 처리하므로 그레인이 OG에도 실린다. 하프톤은 `feImage`(문서 참조)를 걷어내고
`background-clip: text` + 도트 패턴으로 바꿔 세 경로 모두에서 그려지게 했다.

**함께 고친 실제 버그**
- `--radius-full`이 8곳에서 쓰이는데 정의부가 없어 그 8곳의 라운드가 무효였다(프로필 아바타가
  네모로 보이던 원인). 정의 추가.
- `--ticket-*` 스코프 토큰 10종이 참조만 되고 정의가 없었다(`VISUAL_MOTION_DIRECTION.md:650`이
  요구한 export 토큰 스코프가 비어 있었다). 정의 추가 + JSON과 일치하는지 테스트로 고정.
- `--radius-ticket: 20px`은 사용처가 0이고 실제 라운드는 `1.5rem` 하드코딩이었다. 24px로 정정 후 사용.
- OG 폰트 서브셋에 새 한국어 문구의 글리프가 없었다(`오늘의스트립공유일검색노출는`). 한글 시스템
  폰트가 없는 서버에서는 깨진다. 고정 문구만으로 재서브셋(148 코드포인트, `src/assets/fonts/README.md`).

**새 회귀 가드**
- `tests/static/ticket-art-contract.test.ts` — CSS `--ticket-*`가 JSON 팔레트와 일치할 것, 폴백 없이
  참조되는 미정의 CSS 변수가 0개일 것, 도형 fill이 전부 팔레트 키일 것.
- `tests/unit/ticket-art.test.ts` — 팔레트 키가 hex로 치환될 것, idPrefix로 ID가 분리될 것, 금액·시간 표기.
- `tests/integration/og-image.test.tsx` — 라우트 소스에 `#3B64D8`·`KRW `·`UNLISTED`·`padStart`가 없을 것,
  렌더된 PNG에 로즈·황토 픽셀이 존재할 것, 종이 영역에 그레인이 실렸을 것.
- `tests/e2e/core-flow.spec.ts` — 저장된 PNG 좌상단 모서리가 종이색이 아니라 캔버스색일 것(라운드 증거).

재검증: Prettier(저장소 전체)·ESLint·TypeScript PASS, Vitest 43 files / 219 tests,
Playwright E2E 13 pass / 7 skip(`--retries=0`), PWA 3/3.
