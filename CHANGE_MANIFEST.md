# SingSong Release Change Manifest

## 2026-07-22 앱 리뉴얼

- 기준: `docs/FINAL_BLUEPRINT.md` → `docs/prompts/ONESHOT_MASTER.md` v3.2 → `docs/design/VISUAL_MOTION_DIRECTION.md` → `docs/design/concepts-10/ADOPTION.md` 순으로 판정했다.
- 앱 셸: `src/app/globals.css`, 레이아웃/manifest, 사이트 헤더, 설치 안내, 아이콘과 offline/missing/error 화면을 CUTLINE 언어와 한국어 우선 구조로 통일했다.
- 플랜: 작업 공간, Working Strip, 계산 스트립, 검색 원장, 홈 액션을 하나의 연속적인 모바일 흐름으로 재구성했다.
- 티켓/공유/가져오기: 의미론적 티켓 데이터, 공유 범위·30일 만료·고정 사본·철회 안내, Web Share/copy/PNG, 독립 실행 가져오기 상태를 정리했다.
- 회귀 방지: 관련 unit/integration/E2E 테스트를 갱신하고 고유 heading ID, heading 단계, loading `aria-busy`, 공유 고지와 한국어 메타데이터 계약을 추가했다.
- Git 보존: 기존 branch/HEAD와 사용자 변경을 유지했으며 reset, clean, checkout, stage, commit, push, deploy를 수행하지 않았다.
- 최신 검증: Prettier, ESLint, TypeScript, Next fixture build PASS; Vitest 39 files / 190 tests; responsive Chromium 3 / 3 PASS.

## 보존 경계

변경 전 working tree는 tracked modified 16개, untracked 46개, ignored 3개였다. 이들은 모두 사용자 자료로 취급했다. exact 목록/hash는 `MATERIAL_INVENTORY.md`, Git baseline과 보존 tree `50173b6288ba484fc40b9d6d8b16dc40497b8280`은 `GIT_HISTORY_AUDIT.md`에 있다.

- 기존 16개 modified tracked 문서는 release 구현이 덮어쓰지 않았다.
- 기존 46개 untracked 파일은 rename/delete하지 않았다.
- `docs/design/assets/session-strip-concept-board.png`만 기존 `최종.png`와 byte-identical한 **새 alias**로 추가했다. 원본은 그대로다.
- `.remember/logs/memory-2026-07-22.log`는 read-only audit command가 기존 hook을 촉발해 만든 ignored runtime log다. 제품/commit/evidence에서 제외하고 보존했다.
- reset/checkout/clean/force push/history rewrite/stage/commit/deploy를 수행하지 않았다.

## 새로 추가한 제품 파일과 이유

| 경로                                                                                                                             | 변경 이유                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`                                                      | exact Node/pnpm/dependency/lifecycle, Node 24.18.0 pin, Next 16.2.11/PostCSS 8.5.20 보안 수정, frozen install·공급망 policy             |
| `tsconfig.json`                                                                                                                  | strict Next TypeScript contract                                                                                                         |
| `next-env.d.ts`                                                                                                                  | Next가 dev/build 모드별 route-types directive를 재생성하는 framework-managed TypeScript bootstrap                                       |
| `next.config.mjs`, `postcss.config.mjs`, `eslint.config.mjs`, `prettier.config.mjs`, `.prettierignore`                           | Next/Serwist/Tailwind/lint/format/tooling과 security headers                                                                            |
| `.env.example`, `.gitignore`                                                                                                     | value-free fixture/production config와 generated/secret ignore                                                                          |
| `src/domain/*`                                                                                                                   | shared models, strict validation, calculation, catalog normalization, canonical snapshot/fingerprint                                    |
| `src/data/plan-database.ts`                                                                                                      | Dexie singleton plan, revision CAS, frozen tickets, duplicate import                                                                    |
| `src/features/catalog/*`                                                                                                         | synthetic fixture, rights-gated licensed provider와 server-only boundary                                                                |
| `src/features/plan/*`                                                                                                            | search/manual, ordered strip, calculation, issue flow                                                                                   |
| `src/features/ticket/*`                                                                                                          | semantic CUTLINE ticket, once motion, PNG/share/revoke actions                                                                          |
| `src/features/share/*`                                                                                                           | fixture and production repositories, hash-only Supabase RPC adapter                                                                     |
| `src/features/import/*`                                                                                                          | exact slug preview, storage probe, explicit replacement                                                                                 |
| `src/server/*`                                                                                                                   | runtime profile/env readiness, historical share-key probe, bounded HTTP/origin, safe logs, rate limit, Turnstile                        |
| `src/instrumentation.ts`, `src/instrumentation.node.ts`                                                                          | Node startup에서 환경 검증 뒤 required share-key RPC를 fail-closed로 실행                                                               |
| `src/analytics/port.ts`                                                                                                          | privacy-minimal typed no-op and test sink                                                                                               |
| `src/app/*`, `src/components/*`, `src/proxy.ts`                                                                                  | six routes, search/share/OG API, app shell/errors/offline/manifest/SW/CSP/update                                                        |
| `src/components/app-header-actions.tsx`, `bottom-slot.tsx`, `pwa-install-prompt.tsx`                                             | compact header action portal, 한 개의 viewport-safe next-action slot, Android/iOS 설치 안내와 temporary-host honesty                    |
| `src/components/site-header.tsx`, `planner-tabs.tsx`                                                                             | task route에서 mobile bottom↔wide header로 위치만 바뀌는 플랜·검색 2-item navigation DOM과 `aria-current`                               |
| `src/features/plan/home-action-dock.tsx`, `plan-rail.tsx`                                                                        | nonempty home의 요금 입력/발권 행동 하나와 search의 현재 곡·시간·비용 요약/플랜 복귀; 0곡 검색 행동은 WorkingStrip이 소유               |
| `src/features/plan/plan-workspace.tsx`, `working-strip.tsx`, `calculation-strip.tsx`, `search-ledger.tsx`                        | marketing/card stack을 one Working Strip·single perforation·calculation disclosure·continuous ledger로 복구                             |
| `src/app/globals.css`, `layout.tsx`, `manifest.ts`, `page.tsx`, `search/page.tsx`                                                | CUTLINE semantic tokens, safe area/standalone metadata, route-aware compact shell composition                                           |
| `src/features/ticket/ticket-screen.tsx`, `public/icons/*`, `public/offline.html`                                                 | canonical CUTLINE light export token과 설치/offline surface의 동일한 shell/brand 갱신                                                   |
| `src/app/api/og/[slug]/route.tsx`                                                                                                | 1200×630 exact-share OG와 generic unavailable image, no-store/noindex                                                                   |
| `src/assets/fonts/*`                                                                                                             | OG의 deterministic Korean glyph subset와 OFL license/provenance                                                                         |
| `public/icons/*`, `scripts/generate-icons.mjs`                                                                                   | code-generated SVG/192/512/apple icons; generated raster reference 재사용 금지                                                          |
| `scripts/clean-generated.mjs`, `scripts/verify-built-pwa.mjs`, `scripts/smoke-http.mjs`                                          | reproducible generated cleanup, built PWA contract와 HTTP smoke                                                                         |
| `scripts/perf-lab.mjs`                                                                                                           | cold/warm navigation, search distribution, calculation/ticket scripted performance runner                                               |
| `scripts/perf-lab.mjs` mobile-shell update                                                                                       | fixed BottomSlot/nav가 scripted interaction을 가리지 않는 현재 selector와 ticket navigation 측정                                        |
| `scripts/release-env-contract.mjs`, `scripts/release-env-contract.d.mts`                                                         | build/runtime 공용 value-free release 필수 env 이름 계약                                                                                |
| `scripts/release-gate.mjs`, `scripts/release-gate.d.mts`, `scripts/release-preflight.mjs`, `scripts/verify-release-artifact.mjs` | release env/rights manifest fail-closed gate와 fixture/bypass artifact scan                                                             |
| `supabase/migrations/20260722010000_share_snapshot_v1.sql`                                                                       | private hash-only immutable share schema, TTL/rate/allowlist RPC/rollback notes                                                         |
| `tests/unit/*`                                                                                                                   | calculation oracle, canonical/byte limits, release artifact/env/startup/share-key/PWA contracts                                         |
| `tests/integration/*`                                                                                                            | Dexie CAS/import/managed capability, calculation UI와 BFF search/share/HTTP/OG behavior                                                 |
| `tests/static/*`                                                                                                                 | migration ACL, PWA no-cache, secret/HTML static guard                                                                                   |
| `tests/e2e/*`, `playwright.config.ts`                                                                                            | mobile/desktop organizer→recipient core, 새 플랜/undo, IME, responsive, PNG/revoke recovery flow                                        |
| `tests/e2e/mobile-shell.spec.ts`와 갱신된 `core-flow.spec.ts`, `resilience.spec.ts`                                              | nav DOM 1개, header/dock/rail, queue→calculator 순서, 25% fixed cap, 200% flow fallback와 새 app-shell selector 회귀                    |
| `tests/unit/plan-rail.test.tsx`, `primary-nav.test.tsx`, `pwa-install-prompt.test.tsx`                                           | plan summary domain reuse, route navigation semantics, Android/iOS/standalone/install 오류·dismiss 계약                                 |
| `tests/unit/bottom-slot.test.tsx`                                                                                                | fixed/flow/empty/no-ResizeObserver/outside-shell/cleanup의 5개 meaningful branch로 global coverage threshold를 제품/기준 변경 없이 회복 |
| `tests/integration/home-action-dock.test.tsx`, `search-ledger.test.tsx`, `working-strip.test.tsx`                                | single-next-action, ledger live/error/IME, empty/populated strip의 실제 상태별 계약                                                     |
| `tests/integration/calculation-strip.test.tsx`, `ticket-screen.test.tsx`, `tests/pwa/production-offline.spec.ts`                 | disclosure focus, CUTLINE ticket token, installed shell 변경에 대한 기존 흐름 회귀                                                      |
| `tests/pwa/production-offline.spec.ts`, `playwright.production.config.ts`                                                        | built app의 controlled worker/offline shell 실제 browser 검증                                                                           |
| `vitest.config.ts`                                                                                                               | test discovery와 coverage threshold                                                                                                     |

## 새로 추가한 운영·감사 문서와 이유

| 경로                                                   | 변경 이유                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `RELEASE_BUILD_PLAN.md`, `RUN_STATE.md`                | 현재 run 범위/phase/ownership                                                        |
| `MOBILE_APP_SHELL_PLAN.md`                             | 실폰 review에서 발견한 landing-page drift의 복구 계약, 구현 slice와 완료 evidence    |
| `MATERIAL_INVENTORY.md`, `MD_READ_LEDGER.md`           | 초기 65개 전수 자료와 29/29 Markdown 완독 근거                                       |
| `GIT_HISTORY_AUDIT.md`                                 | refs, commits, reflog, stash-shaped/unreachable objects, LFS/submodule/security 감사 |
| `docs/catalog/*`                                       | catalog rights, provenance, ingestion, takedown, SQL privilege 운영                  |
| `README.md`                                            | 설치/개발/검증/production deploy/rollback                                            |
| `docs/engineering/ARCHITECTURE_V3.md`                  | 현재 local-first/BFF/PWA architecture                                                |
| `IMPLEMENTATION_CONTRACT.md`                           | P0 scope와 불변조건 동결                                                             |
| `CONFLICT_REGISTER.md`                                 | 레거시/current 충돌의 증거 기반 판정                                                 |
| `UNKNOWN_RESOLUTIONS.md`                               | unknown 24/24의 repo/external 상태                                                   |
| `DECISIONS_LOG.md`                                     | 주요 ADR와 되돌림 조건                                                               |
| `REQUIREMENTS_TRACE.md`                                | 초기 자료 65, history GH 50, current requirements의 구현/테스트 연결                 |
| `TOOLCHAIN_LOCK.md`                                    | exact tool/package/hash와 환경 차이                                                  |
| `docs/verification/TEST_PLAN_V3.md`, `QA_MATRIX_V3.md` | 실제 실행 기준, external/manual 분리                                                 |
| `HANDOFF.md`                                           | local/staging/production 경계와 사람 작업/rollback                                   |
| `CHANGE_MANIFEST.md`                                   | 파일군별 변경 이유와 사용자 자료 보존 선언                                           |
| `ARCHITECTURE.md`                                      | 현재 코드로 재확인한 local/Dexie/BFF/PWA 구조와 ADR trade-off                        |
| `VERIFICATION_REPORT.md`                               | 계획과 실제 명령 결과를 분리한 final PASS/FAIL/NOT_RUN/BLOCKED_EXTERNAL 원장         |
| `FINAL_MATERIAL_AUDIT.md`                              | 초기 hash 보존 재감사와 모든 최종 non-generated 경로 exact appendix                  |

## Generated/runtime 파일

`node_modules/`, `.next/`, `coverage/`, `public/sw.js`, `public/swe-worker-*`, `test-results/`의 `.gitkeep` 외 파일, Playwright report/video/trace, TypeScript build info, `.pnpm-store/`, `.remember/`, `ACTIVE_RUN.lock/`는 source가 아닌 설치/build/test/tool/운영 부산물이다. `test-results/.gitkeep`은 빈 evidence 디렉터리를 보존하는 1바이트 비생성 source marker이므로 최종 233-file source manifest에 포함한다. lock은 owner nonce 확인 뒤 clean shutdown 때만 제거한다. generated artifact를 제거할 때는 정확한 workspace 내부 target과 provenance를 확인한다.

## 최종 재감사 체크

- [x] initial 16 modified tracked 파일 content/hash 보존 확인 — Git-visible baseline 62/62 exact, missing/mismatch 0
- [x] initial 46 untracked + 3 ignored 자료 손실 0 확인 — ignored 3/3 SHA-256 exact
- [x] normal/Codex refs와 reachable/unreachable object count 변화/이유 확인 — HEAD/refs/object counts unchanged
- [x] 새 source의 static secret/public-env/release-artifact guard와 generated/runtime exclusion 확인
- [x] Next 16.1.7 audit 15건(High 8건)을 16.2.11/PostCSS 8.5.20으로 수정하고 prod+dev level-low audit 0 및 613-entry supply-chain policy 확인
- [x] 리뉴얼 전 CUTLINE shell·233-path clean의 37-file/185-test coverage/build/PWA/smoke 증거를 보존하고, 최신 리뉴얼 39-file/190-test·build·responsive Chromium 3/3을 `VERIFICATION_REPORT.md`에 추가
- [x] final evidence 문서 sync 뒤 current↔clean source 233/233, missing/extra/SHA mismatch 0
- [x] smartphone review용 Quick Tunnel과 app process의 owner/PID/temporary hostname을 기록하고 production deploy와 분리
- [ ] app PID 29532 재시작과 최신 build 외부 재게시 — `PREVIEW_RESTART_REQUIRED`; 사용자의 명시적 외부 공개 승인 뒤 root owner가 수행

보존 체크의 재현 세부는 `FINAL_MATERIAL_AUDIT.md`와 `GIT_HISTORY_AUDIT.md`의 리뉴얼 전 snapshot을 따른다. local fixture production artifact는 검증된 candidate이고 actual release build/deploy/DB/device/operations는 외부 gate로 남는다. app PID 29532와 Quick Tunnel PID 32848은 보존됐지만 최신 `.next`와 기존 server manifest가 달라 현재 preview asset 5개가 500이다. 명시적 승인 전에는 최신 build를 외부에 재게시하지 않는다.
