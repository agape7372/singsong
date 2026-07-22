# SingSong Verification Report

이 문서는 실행 증거의 최종 진입점이다. 소스나 테스트 파일의 존재와 실제 명령 PASS를 구분하며 `docs/verification/QA_MATRIX_V3.md`의 최종 행 판정과 함께 읽는다. local fixture production artifact의 성공을 실제 release/production 성공으로 승격하지 않는다.

## 앱 리뉴얼 최신 검증 — 2026-07-22

이 절은 아래의 보존된 출시 후보 검증 이후 수행한 UI 리뉴얼의 최신 증거다. 제품·보안·release gate 판정은 바꾸지 않으며, 아래 기존 37-file/185-test 기록보다 이 절의 UI 회귀 결과가 최신이다.

| Gate | 상태 | 최신 결과 |
| --- | --- | --- |
| Format | `PASS` | 전체 Prettier check 통과 |
| Lint | `PASS` | 전체 ESLint, warning 0 |
| Typecheck | `PASS` | TypeScript `--noEmit` |
| Unit/integration/static | `PASS` | Vitest 39 files / 190 tests |
| Fixture build | `PASS` | Next.js 16.2.11 Webpack production build, 모든 route 생성 |
| Responsive browser | `PASS` | Chromium desktop project에서 mobile/wide shell 3 / 3 |
| Visual review | `PASS` | 390×844 home/search, 1440×900 home 캡처 검수 |
| Existing public preview | `AUTHORIZATION_REQUIRED` | 기존 PID 29532와 터널 PID 32848은 보존됨. 새 `.next`와 기존 server manifest가 달라 정적 asset 5개가 500이며, 외부 재공개 승인이 없어 재시작하지 않음 |

첫 Chromium 재실행은 managed sandbox가 browser process spawn을 `EPERM`으로 차단했다. 동일 build/source를 승인된 실행 경계에서 재실행했고 3개 시나리오가 5.2초에 모두 통과했다. 임시 3100 서버와 캡처 스크립트는 검수 직후 정리했다.

최종 source와 fixture build는 완료됐지만 기존 Quick Tunnel 미리보기는 최신 앱을 다시 외부에 공개하는 별도 상태 변경이다. 명시적 승인 전에는 해당 앱/터널 프로세스를 종료·재시작하거나 새 빌드를 공개하지 않는다.

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
| Branch                  | `claude/favorite-song-app-research-vs3yqa`                                        |
| HEAD                    | `fff4d598aebc9b501874314d6a4a1c0cd1115c9a`                                        |
| Required Node pin       | `.nvmrc`의 `24.18.0`                                                              |
| Final runtime           | Node `v24.18.0`, pnpm `11.9.0`, Git `2.52.0.windows.1`                            |
| Profile contract        | `fixture` / `release`; 내부 release runtime은 production 호환값 사용              |
| Local capability        | `LOCAL_DEMO_READY`: verified fixture production release candidate                 |
| Production gate         | `BLOCKED_EXTERNAL`; permanent deploy not performed                                |
| Temporary phone preview | `PREVIEW_RESTART_REQUIRED`: 기존 process 보존, 최신 build 재게시 승인 대기 |

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
| Unit/integration/static                     | full Vitest                                           | `PASS`           | current와 clean 각각 37 files, 185 tests; exit 0                                                                                                                                        |
| Coverage — retained baseline                | pre-shell Vitest coverage artifact                    | `PASS`           | 30-file/163-test baseline: statements 82.48% (1375/1667), branches 76.12% (934/1227), functions 86.77% (269/310), lines 85.24% (1288/1511)                                              |
| Coverage — current mobile shell             | current·clean 37-file suite with coverage             | `PASS`           | 둘 다 statements 82.27% (1560/1896), branches 75.47% (1074/1423), functions 86.06% (315/366), lines 84.91% (1464/1724); 기준 하향 없이 threshold 통과                                   |
| Contract subset — retained                  | `pnpm test:contract`                                  | `PASS`           | shell 이전 4 files/21 tests; canonical/validation 계약은 shell 변경에서 수정되지 않음                                                                                                   |
| Fixture build — current                     | `pnpm build:demo`                                     | `PASS`           | CUTLINE mobile-shell current tree, Next 16.2.11, production artifact 생성 성공                                                                                                          |
| Fixture build — clean baseline              | 이전 219-path clean source evidence                   | `PASS`           | Next 16.2.11, 18.0s, warning 0; 새 13개 shell 경로의 clean-copy 증거로 사용하지 않음                                                                                                    |
| Fixture build — current 233-path clean copy | 새 writable clean source archive                      | `PASS`           | Next 16.2.11 Webpack fixture build; compile 5.9s, type 2.8s, all routes 생성                                                                                                            |
| Dev webpack runtime                         | actual `next dev --webpack`                           | `PASS`           | GET `/` 200, 15,630 bytes, SingSong present                                                                                                                                             |
| Built PWA artifact                          | `node scripts/verify-built-pwa.mjs`                   | `PASS`           | current와 clean 모두 precache 45, forbidden entries 0                                                                                                                                   |
| Main HTTP smoke                             | explicit fixture production profile                   | `PASS`           | home/ticket/OG 200; OG 30,423 bytes; home modern JS gzip 167,035 bytes                                                                                                                  |
| Clean HTTP smoke                            | 233-path clean fixture production profile             | `PASS`           | home/ticket/OG 200; OG 30,423 bytes; home modern JS gzip 167,056 bytes                                                                                                                  |
| Core browser E2E                            | final Chromium projects                               | `PASS`           | 20 discovered: 13 pass, 7 intentional project-gated skip; 핵심 mobile organizer flow 1/1                                                                                                |
| Built PWA browser                           | final Chromium production-artifact config             | `PASS`           | 3/3 pass; generic OG/security, offline shell, explicit waiting-worker consent                                                                                                           |
| Public preview SW control                   | Pixel 7 Chromium profile on Quick Tunnel              | `PASS`           | `/` 200; same-origin `serviceWorker.ready`; reload 후 controller `sw.js`; context worker count 1                                                                                        |
| Icon metadata                               | sharp + manifest source                               | `PASS`           | 192×192, 512×512, apple 180×180 PNG sRGB alpha; manifest maskable refs exact                                                                                                            |
| Lab navigation                              | 4× CPU, 40ms, 10/5Mbps; cold·warm each 5              | `PASS`           | cold LCP median/worst 324/336ms, TBT 234/240ms, CLS 0.0005; warm LCP 92/144ms, TBT 0                                                                                                    |
| Home initial JS                             | HTML modern route scripts, gzip level 9               | `PASS`           | current 167,035 bytes < 174,080-byte provisional limit                                                                                                                                  |
| Search distribution                         | fixed fixture corpus/distribution                     | `PASS`           | overall p95 15.7ms                                                                                                                                                                      |
| Scripted UI                                 | throttled calculation/ticket navigation               | `PASS`           | calculation median/worst 14/23.7ms; ticket navigation 505ms                                                                                                                             |
| Field performance                           | same release/region/device-class RUM/CrUX p75         | `NOT_RUN`        | sample `NONE`; result `NOT_RUN + NONE`, never zero/PASS                                                                                                                                 |
| Aggregate demo gate                         | equivalent `verify:demo` component composition        | `PASS`           | current와 clean의 모든 component exit 0; no fabricated single aggregate-process exit                                                                                                    |
| Release fail-closed                         | credentials 없는 `pnpm preflight:release`             | `PASS`           | expected exit 1, deterministic `BLOCK_EXTERNAL`, 13 required env names; no values logged                                                                                                |
| Temporary phone preview                     | public-hostname fixture app + Cloudflare Quick Tunnel | `PREVIEW_RESTART_REQUIRED` | 리뉴얼 전 public flow는 PASS. 현재 app PID 29532와 tunnel PID 32848은 보존됐지만 server manifest와 새 asset이 달라 5개 asset이 500이며 외부 재공개 승인 대기 |

## 환경 재시도

- audit/install의 첫 sandbox 실행은 package/cache 접근 `EACCES`로 차단됐다. 승인된 동일 audit와 exact install은 각각 known vulnerability 0과 10.2s/506 packages로 PASS했고 lockfile은 바뀌지 않았다.
- Next 16.1.7에서 남은 `.next` type output은 소스가 아닌 generated artifact였고 `clean:generated` 경로로만 제거한 뒤 Next 16.2.11에서 재생성했다.
- shell 이전 cold coverage 중 OG integration은 기본 5초 ceiling에서 한 번 timeout됐다. assertion을 바꾸지 않고 integration ceiling을 15초로 명시한 뒤 targeted 4/4와 당시 full 163 tests가 PASS했다. 최종 185-test coverage는 별도 current run의 exact 수치다.
- frozen install 재생성 한 번이 sandbox timeout으로 끝났고, 승인된 동일 exact install은 current 10.2s와 clean 5.1s로 PASS했다.
- shell 이전 Next build가 clean copy의 `next-env.d.ts` import directive만 자동 갱신했다. 그 219-path clean evidence는 보존하되, 현재 source appendix는 새 shell/coverage 경로 14개를 포함해 actual/listed 233/233, missing/extra 0으로 다시 계산했다.
- Chromium 첫 spawn은 managed sandbox `EPERM`이었다. 승인된 browser 검증과 mobile-shell 추가 회귀의 최신 합계는 E2E 13 pass/7 project-gated skip, PWA 3 pass다.
- 최초 preview app은 localhost origin으로 build돼 public search가 403이었다. 코드를 우회하지 않고 `NEXT_PUBLIC_SITE_URL`을 Quick Tunnel hostname과 일치시켜 rebuild/start했고 public search/share와 전체 phone-profile flow가 PASS했다.
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

- 현재 최고 확인 상태는 `LOCAL_DEMO_READY`다. Next 16.2.11의 최신 리뉴얼 source는 정적검사·190 tests·build·responsive browser를 통과했다. 리뉴얼 전 byte-exact 233-path clean source의 185 tests·coverage·build/smoke/PWA artifact와 browser E2E/PWA/performance는 별도 보존 증거다. 기존 public preview는 재시작 전까지 사용 가능 상태로 판정하지 않는다.
- production gate: `BLOCKED_EXTERNAL`.
- HTTP smoke나 home JS gzip 한 항목만 통과해도 전체 성능 gate를 `PASS`로 올리지 않는다. lab·search·field 표본은 각각 독립 판정한다.
- 에이전트는 `RELEASED`를 선언하지 않는다.

## 증거 위치와 보존

- retained pre-shell clean root: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-clean-release-final-683054d4ee774d5ea65dedb69d21145c/` (219-path baseline only)
- retained pre-shell E2E root: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-playwright-next16211-final-683054d4ee774d5ea65dedb69d21145c/`
- retained pre-shell PWA root: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-playwright-pwa-next16211-final-683054d4ee774d5ea65dedb69d21145c/`
- current 233-path clean reproduction: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-clean-shell-20260722-1033/`; final source 233/233, missing 0, SHA mismatch 0 after evidence-doc sync
- retained pre-renewal coverage: `coverage/coverage-summary.json` (2026-07-22 10:39:17+09:00), full 37/185 command exit 0; latest 39/190 run은 coverage를 재측정하지 않음
- current E2E: `C:/Users/agape/AppData/Local/Temp/singsong-playwright/e2e/report/index.html` (2026-07-22 10:12:17+09:00)와 `e2e/playwright/.last-run.json` status `passed`
- current PWA: `C:/Users/agape/AppData/Local/Temp/singsong-playwright/production-pwa/report/index.html` (2026-07-22 10:12:42+09:00)와 `production-pwa/results/.last-run.json` status `passed`
- phone preview: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-phone-preview/`의 `public-origin-20260722-1036.stdout.log`, `mobile-current.png`, `mobile-search.png`; running app PID 29532와 Quick Tunnel PID 32848
- repository `test-results/**/.last-run.json`은 이전 실패 run의 generated metadata이므로 이 최종 PASS의 근거로 사용하지 않는다.
- generated build: `.next/`, `public/sw.js`, `public/swe-worker-*`
- 초기 자료·Git 보존: `MATERIAL_INVENTORY.md`, `MD_READ_LEDGER.md`, `GIT_HISTORY_AUDIT.md`, `FINAL_MATERIAL_AUDIT.md`

Generated/runtime artifact는 source manifest에 섞지 않는다. 최종 보고는 명령, exit code, 실행 시각, environment subject와 artifact 경로가 모두 있을 때만 `PASS`로 바꾼다.
