# SingSong Final Material Audit

> **리뉴얼 전 233-path 보존 snapshot.** 최신 커밋 대상은 236개 Git-visible 경로이며 현재 검증 상태는 `APP_RENEWAL_PLAN.md`와 `VERIFICATION_REPORT.md`를 따른다.

관측일: 2026-07-22 Asia/Seoul  
Run ID: `683054d4ee774d5ea65dedb69d21145c`

이 문서는 변경 전 자료의 보존 재검사와 최종 non-generated working-tree 경로를 연결한다. 제품 요구 판정은 [REQUIREMENTS_TRACE.md](./REQUIREMENTS_TRACE.md), 초기 bytes/hash는 [MATERIAL_INVENTORY.md](./MATERIAL_INVENTORY.md), 29/29 Markdown 완독은 [MD_READ_LEDGER.md](./MD_READ_LEDGER.md), Git refs/object 상세는 [GIT_HISTORY_AUDIT.md](./GIT_HISTORY_AUDIT.md)가 소유한다.

## 1. 변경 전 자료 65/65

초기 non-`.git` 경계는 65개 파일, 15개 디렉터리, 38,718,584 bytes였다. 판정 총계는 다음과 같고 합계가 65다.

| 판정                             |  수 |
| -------------------------------- | --: |
| `IMPLEMENT_DIRECTLY`             |   5 |
| `ALREADY_SATISFIED`              |   0 |
| `DOC_DESIGN_TEST_OPS`            |  13 |
| `DUPLICATE_OR_SUPERSEDED`        |  44 |
| `EXCLUDED_SECURITY_TECH_PRODUCT` |   3 |

초기 자료별 exact path·bytes·SHA-256·판정은 다음 링크에서 빈칸 없이 확인한다.

- [MATERIAL_INVENTORY.md](./MATERIAL_INVENTORY.md): F-001..F-065와 D-001..D-015의 원본 해시·용도·판정.
- [MD_READ_LEDGER.md](./MD_READ_LEDGER.md): MD-001..MD-029 전문 완독과 authority/conflict/disposition.
- [REQUIREMENTS_TRACE.md §1](./REQUIREMENTS_TRACE.md): 초기 65개가 구현·문서·테스트·운영·폐기 판정으로 연결된 최종 trace.

어떤 초기 파일도 조용히 제외하지 않았다. reference raster와 runtime log도 각각 `DUPLICATE_OR_SUPERSEDED` 또는 `EXCLUDED_SECURITY_TECH_PRODUCT`로 명시했다.

## 2. 최종 보존 재검사

| 대상                              | 재검사 결과                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 초기 Git-visible 62개             | Codex tree `50173b6288ba484fc40b9d6d8b16dc40497b8280` 대비 `62/62 exact`, missing 0, mismatch 0                        |
| 초기 modified tracked 16개        | exact/current 16, staged 0, unmerged 0, deleted 0                                                                      |
| 초기 ignored F-063/F-064/F-065    | SHA-256 `3/3 exact`                                                                                                    |
| Post-baseline P-001 Remember log  | 233 bytes, 관측 hash `D715B5780C4D265A2B2783EB2DEB867B47C057B2250B6585B328D792715A8BA2`; 제품/commit/evidence 제외     |
| Git HEAD                          | `fff4d598aebc9b501874314d6a4a1c0cd1115c9a` unchanged                                                                   |
| Git topology                      | reachable commits 13, unreachable commits 4, trees 44, blobs 13, reflog 5, stash 0, LFS 0, submodule 0; refs unchanged |
| Current↔clean mobile-shell source | `singsong-clean-shell-20260722-1033`; 233/233 exact after final evidence-doc sync, missing/extra/SHA mismatch 0        |

원본 Git 기록, 사용자 dirty worktree와 초기 ignore/runtime 자료는 삭제·rename·stage·rewrite되지 않았다. 초기 `최종.png`를 보존한 채 byte-identical 영문 alias만 새 파일로 추가했다.

## 3. 최종 추적 대상 universe

아래 exact sorted appendix는 이 감사 파일 자체와 CUTLINE 모바일 앱 셸 복구에서 추가된 13개 경로, coverage branch 회귀 테스트 1개를 포함한 최종 source/config/material 경로 **233개**를 나열한다. 경로 하나가 한 줄이며 범위 축약이나 암묵적 wildcard가 없다. 같은 제외 규칙으로 현재 파일시스템을 다시 열거한 실제 집합과 appendix를 비교한 결과 actual 233, listed 233, missing 0, extra 0이다. 일반 generated output은 제외하되, Next가 저장소 root에 두도록 요구하는 framework-managed TypeScript bootstrap은 아래 판정과 함께 추적한다.

포함 규칙:

- root source/config/release/audit 문서 전부.
- `docs/**`의 초기 자료와 이번 run의 추가 운영 문서 전부.
- `public`의 검수/생성 source icon과 static fallback.
- `scripts/**`, `src/**`, `supabase/migrations/**`, `tests/**`.
- `test-results/.gitkeep` 1바이트 LF 표식. 빈 실행 결과 디렉터리를 보존하는 비생성 source marker다.
- `next-env.d.ts`는 Next framework-managed TypeScript bootstrap이다. dev/build 모드에 따라 마지막 route-types import directive가 재생성되므로 실행 후 current tree의 최종 상태를 appendix 경로로 추적하되, byte-stable 사람이 작성한 source로 간주하지 않는다.

제외 규칙:

| 제외                                                             | 이유                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `.git/**`                                                        | 별도 `GIT_HISTORY_AUDIT.md`가 refs/object를 소유                                                                   |
| `node_modules/**`, `.pnpm-store/**`                              | frozen lockfile로 재생성 가능한 dependency/cache                                                                   |
| `.next/**`, `coverage/**`, `playwright-report/**`                | build/test generated output                                                                                        |
| `test-results/**` 중 `.gitkeep` 외 파일                          | 생성된 실행 evidence; `VERIFICATION_REPORT.md`에서 별도 참조. 비생성 `.gitkeep`은 appendix에 포함                  |
| `public/sw.js`, `public/sw.js.map`, `public/swe-worker-*.js*`    | Serwist build 산출물; source는 `src/app/sw.ts`                                                                     |
| `tsconfig.tsbuildinfo`                                           | TypeScript generated cache                                                                                         |
| `ACTIVE_RUN.lock/**`                                             | 실행 소유권 runtime state; clean shutdown 때 matching nonce owner만 제거                                           |
| `.remember/**`                                                   | 초기 tool exclusion과 host hook runtime/경로 metadata; 제품·commit·release source 아님                             |
| OS temp/CreatorTemp Playwright·phone-preview·clean-copy evidence | 실행 중 생성한 report/log/screenshot/runtime이며 source input이 아님; exact 위치는 `VERIFICATION_REPORT.md`가 소유 |

제외는 삭제 승인이 아니다. 원본 runtime/evidence는 보존하고 source universe와만 분리한다.

## 4. Exact sorted path appendix — 233/233

```text
.env.example
.gitignore
.npmrc
.nvmrc
.prettierignore
APP_FINAL_DESIGN_PLAN.md
ARCHITECTURE.md
CHANGE_MANIFEST.md
CONFLICT_REGISTER.md
DECISIONS_LOG.md
docs/BUILD_PLAN.md
docs/catalog/CATALOG_RIGHTS.md
docs/catalog/INGESTION_RUNBOOK.md
docs/catalog/PROVENANCE.md
docs/catalog/SQL_PRIVILEGE_CHECKLIST.md
docs/catalog/TAKEDOWN.md
docs/CODEX_FINAL_REVIEW.md
docs/design/assets/README.md
docs/design/assets/session-strip-concept-board.png
docs/design/assets/ticket-issue-storyboard.png
docs/design/assets/보관.png
docs/design/assets/생성된 이미지 2.png
docs/design/assets/순서.png
docs/design/assets/최종.png
docs/design/assets/최종2.png
docs/design/COMPONENTS.md
docs/design/concepts-10/ADOPTION.md
docs/design/concepts-10/app.js
docs/design/concepts-10/index.html
docs/design/concepts-10/preview.png
docs/design/concepts-10/README.md
docs/design/concepts-10/recommended-cutline.png
docs/design/concepts-10/styles.css
docs/design/DESIGN_SYSTEM.md
docs/design/MICROCOPY.md
docs/design/SCREENS.md
docs/design/ticket-concepts-10/app.js
docs/design/ticket-concepts-10/exports/ticket-01.png
docs/design/ticket-concepts-10/exports/ticket-02.png
docs/design/ticket-concepts-10/exports/ticket-03.png
docs/design/ticket-concepts-10/exports/ticket-04.png
docs/design/ticket-concepts-10/exports/ticket-05.png
docs/design/ticket-concepts-10/exports/ticket-06.png
docs/design/ticket-concepts-10/exports/ticket-07.png
docs/design/ticket-concepts-10/exports/ticket-08.png
docs/design/ticket-concepts-10/exports/ticket-09.png
docs/design/ticket-concepts-10/exports/ticket-10.png
docs/design/ticket-concepts-10/index.html
docs/design/ticket-concepts-10/preview.png
docs/design/ticket-concepts-10/preview-mobile.png
docs/design/ticket-concepts-10/PRINCIPLES_CHECKLIST.md
docs/design/ticket-concepts-10/README.md
docs/design/ticket-concepts-10/recommended-ledger-08.png
docs/design/ticket-concepts-10/styles.css
docs/design/ticket-directions/01-plum-pop-cover.png
docs/design/ticket-directions/02-midnight-zine-flash.png
docs/design/ticket-directions/03-ot-stub-m.png
docs/design/ticket-directions/04-thermal-settlement.png
docs/design/ticket-directions/05-boarding-pass.png
docs/design/ticket-directions/06-swiss-riso.png
docs/design/ticket-directions/README.md
docs/design/ticket-directions/TICKET_PROMPT_PRINCIPLES.md
docs/design/UX_FLOWS.md
docs/design/VISUAL_MOTION_DIRECTION.md
docs/engineering/ANALYTICS.md
docs/engineering/API_CONTRACT.md
docs/engineering/ARCHITECTURE.md
docs/engineering/ARCHITECTURE_V3.md
docs/engineering/PLATFORM_NOTES.md
docs/engineering/SECURITY.md
docs/FINAL_BLUEPRINT.md
docs/PRODUCT_SPEC.md
docs/prompts/ONESHOT_IMPLEMENTATION_HANDOFF_V3_2.md
docs/prompts/ONESHOT_MASTER.md
docs/README.md
docs/UNKNOWN_REGISTER.md
docs/verification/QA_MATRIX.md
docs/verification/QA_MATRIX_V3.md
docs/verification/TEST_PLAN.md
docs/verification/TEST_PLAN_V3.md
eslint.config.mjs
FINAL_MATERIAL_AUDIT.md
GIT_HISTORY_AUDIT.md
HANDOFF.md
IMPLEMENTATION_CONTRACT.md
MATERIAL_INVENTORY.md
MD_READ_LEDGER.md
MOBILE_APP_SHELL_PLAN.md
next.config.mjs
next-env.d.ts
package.json
playwright.config.ts
playwright.production.config.ts
pnpm-lock.yaml
pnpm-workspace.yaml
postcss.config.mjs
prettier.config.mjs
public/icons/apple-touch-icon.png
public/icons/icon.svg
public/icons/icon-192.png
public/icons/icon-512.png
public/offline.html
README.md
RELEASE_BUILD_PLAN.md
REQUIREMENTS_TRACE.md
RUN_STATE.md
scripts/clean-generated.mjs
scripts/generate-icons.mjs
scripts/perf-lab.mjs
scripts/release-env-contract.d.mts
scripts/release-env-contract.mjs
scripts/release-gate.d.mts
scripts/release-gate.mjs
scripts/release-preflight.mjs
scripts/smoke-http.mjs
scripts/verify-built-pwa.mjs
scripts/verify-release-artifact.mjs
src/analytics/port.ts
src/app/api/og/[slug]/route.tsx
src/app/api/search/route.ts
src/app/api/shares/[slug]/revoke/route.ts
src/app/api/shares/[slug]/route.ts
src/app/api/shares/route.ts
src/app/error.tsx
src/app/globals.css
src/app/import/page.tsx
src/app/layout.tsx
src/app/manifest.ts
src/app/not-found.tsx
src/app/offline/page.tsx
src/app/page.tsx
src/app/s/[slug]/page.tsx
src/app/search/page.tsx
src/app/sw.ts
src/app/ticket/page.tsx
src/assets/fonts/NotoSansKR-700.subset.ttf
src/assets/fonts/OFL.txt
src/assets/fonts/README.md
src/components/app-header-actions.tsx
src/components/bottom-slot.tsx
src/components/planner-tabs.tsx
src/components/pwa-install-prompt.tsx
src/components/pwa-register.tsx
src/components/site-header.tsx
src/data/plan-database.ts
src/domain/calculation.ts
src/domain/canonical.ts
src/domain/catalog.ts
src/domain/index.ts
src/domain/models.ts
src/domain/validation.ts
src/features/catalog/fixture.ts
src/features/catalog/licensed.ts
src/features/catalog/provider.server.ts
src/features/catalog/types.ts
src/features/import/import-screen.tsx
src/features/plan/calculation-strip.tsx
src/features/plan/home-action-dock.tsx
src/features/plan/new-plan-dialog.tsx
src/features/plan/plan-rail.tsx
src/features/plan/plan-workspace.tsx
src/features/plan/search-ledger.tsx
src/features/plan/use-active-plan.ts
src/features/plan/working-strip.tsx
src/features/share/local-repository.server.ts
src/features/share/repository.server.ts
src/features/share/share-handoff-actions.tsx
src/features/share/supabase-repository.server.ts
src/features/share/turnstile-challenge.tsx
src/features/share/types.ts
src/features/ticket/managed-shares-panel.tsx
src/features/ticket/ticket-card.tsx
src/features/ticket/ticket-screen.tsx
src/instrumentation.node.ts
src/instrumentation.ts
src/proxy.ts
src/pwa/update-safety.ts
src/server/http.ts
src/server/rate-limit.ts
src/server/runtime-profile.ts
src/server/runtime-release-environment.ts
src/server/safe-log.ts
src/server/share-key-readiness.ts
src/server/turnstile.ts
supabase/migrations/20260722010000_share_snapshot_v1.sql
test-results/.gitkeep
tests/e2e/core-flow.spec.ts
tests/e2e/mobile-shell.spec.ts
tests/e2e/resilience.spec.ts
tests/integration/api.test.ts
tests/integration/api-errors.test.ts
tests/integration/calculation-strip.test.tsx
tests/integration/home-action-dock.test.tsx
tests/integration/http-boundaries.test.ts
tests/integration/local-atomicity.test.ts
tests/integration/managed-shares-panel.test.tsx
tests/integration/og-image.test.tsx
tests/integration/plan-database.test.ts
tests/integration/search-ledger.test.tsx
tests/integration/share-resilience.test.ts
tests/integration/ticket-screen.test.tsx
tests/integration/working-strip.test.tsx
tests/pwa/production-offline.spec.ts
tests/setup/server-only.ts
tests/static/pwa-contract.test.ts
tests/static/security-contract.test.ts
tests/unit/analytics.test.ts
tests/unit/bottom-slot.test.tsx
tests/unit/calculation.test.ts
tests/unit/canonical.test.ts
tests/unit/catalog.test.ts
tests/unit/instrumentation.test.ts
tests/unit/instrumentation-node.test.ts
tests/unit/licensed-catalog.test.ts
tests/unit/plan-rail.test.tsx
tests/unit/primary-nav.test.tsx
tests/unit/pwa-install-prompt.test.tsx
tests/unit/pwa-register.test.tsx
tests/unit/pwa-update.test.ts
tests/unit/release-artifact.test.ts
tests/unit/release-gate.test.ts
tests/unit/runtime-release-environment.test.ts
tests/unit/server-contracts.test.ts
tests/unit/share-key-readiness.test.ts
tests/unit/share-payload-boundaries.test.ts
tests/unit/ticket-card.test.tsx
tests/unit/turnstile.test.ts
tests/unit/validation.test.ts
TOOLCHAIN_LOCK.md
tsconfig.json
UNKNOWN_RESOLUTIONS.md
VERIFICATION_REPORT.md
vitest.config.ts
```

## 5. 추적성 결론

- 초기 65/65에 자료별 판정이 있다.
- Git 역사 요구 GH-01..GH-50에 판정이 있다.
- unknown 24/24에 repo/external 판정이 있다.
- 최종 source/config/material 추적 대상 233/233 경로가 위 appendix에 있고 actual↔listed missing/extra는 0이다.
- 실제 자동검증 상태는 `VERIFICATION_REPORT.md`, 외부 출시 gate는 `HANDOFF.md`가 소유한다.
- generated/runtime exclusion은 출하 누락이 아니라 재생성 가능성·민감 host metadata·실행 증거 분리를 위한 명시적 판정이다.
