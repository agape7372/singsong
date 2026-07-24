# SingSong Verification Report

이 문서는 실행 증거의 최종 진입점이다. 소스나 테스트 파일의 존재와 실제 명령 PASS를 구분하며 `docs/verification/QA_MATRIX_V3.md`의 최종 행 판정과 함께 읽는다. local fixture production artifact의 성공을 실제 release/production 성공으로 승격하지 않는다.

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
