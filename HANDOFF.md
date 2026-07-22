# SingSong Release Handoff

## 현재 상태

- build capability: `LOCAL_DEMO_READY` — Node 24.18/Next 16.2.11에서 dependency audit와 CUTLINE mobile-shell fixture production artifact의 static/test/build/start/smoke/E2E/PWA/performance를 검증한 release candidate
- production gate: `BLOCKED_EXTERNAL`
- 가장 큰 blocker: 권리 승인된 production karaoke catalog와 실제 production infra/device/legal evidence가 없음
- 배포 상태: staging/production 배포를 수행하지 않았음
- phone preview: `ACTIVE_PREVIEW/READY` — 2026-07-23 Station `main` 빌드를 기존 Quick Tunnel 주소에 재게시하고 공개 전체 E2E를 통과함

실제 명령/exit code/build/start/E2E 결과는 `VERIFICATION_REPORT.md`가 유일한 최종 근거다. `docs/verification/QA_MATRIX_V3.md`도 같은 최종 증거로 갱신했다. 로컬 fixture 후보의 PASS는 실제 release build, production service 또는 공개 배포 PASS가 아니다.

## 로컬에서 구현된 것

- 가입 없는 한 활성 plan: fixture 검색, 직접 추가, 최대 100곡, 위/아래 reorder, 삭제/undo, 확인형 새 플랜/즉시 undo
- 사용자가 입력하는 곡/시간 가격과 인원, `fallback-v1` 시간·비용·인당 범위, reverse prefix helper
- revision-frozen semantic CUTLINE ticket과 browser PNG 저장
- fixture의 process-local 30일 unlisted share create/read/revoke, exact SSR, copy/Web Share
- same-origin canonical slug preview, nonempty replacement 확인, duplicate-protected local import
- Next PWA manifest/icons, offline shell, controlled update prompt
- compact AppHeader, mobile bottom↔wide header를 공유하는 플랜·검색 2-item nav, Station ledger·2열 estimate·inline 완료 action, 검색 PlanRail BottomSlot
- Android explicit install prompt, iOS Safari 홈 화면 추가 안내, standalone/immersive 억제와 temporary-host 경고
- production Supabase server adapter, hash-only/function-only migration, catalog/ACL/takedown runbooks
- strict headers/CSP/body/origin/schema validation, redacted structured logging, typed no-op analytics
- build/runtime 공용 release env-name 계약과 Node startup의 환경·historical share-key fail-closed readiness

Fixture의 곡/가수/TJ/KY 번호는 모두 `TEST DATA`이며 실제 catalog 주장이나 외부 beta data가 아니다. fixture 공유는 server restart 때 사라진다. 로컬 plan/ticket/import와 managed share receipt/secret은 browser IndexedDB에 남지만 backup·영구보존을 보장하지 않는다. raw capability는 `localStorage`가 아니라 Dexie v4의 분리 테이블에 저장된다.

## Staging/production에서 실제 되는 것으로 확인된 것

없음. 이 run은 외부 deploy, Supabase migration 적용, Turnstile/domain 연결, scheduler/backup 설정을 수행하지 않았다. 따라서 production repository와 deployment는 코드/문서 준비 상태이며 운영 PASS가 아니다.

## 로컬 검증 결과

- exact Node `24.18.0`/pnpm `11.9.0`, latest renewal format/lint/type와 39 files/193 tests PASS
- Next/ESLint config `16.2.11`, PostCSS override `8.5.20`; prod+dev 전체 audit level low known vulnerability 0, 613-entry lock policy PASS
- latest Station current는 public-origin fixture production build와 공개 Chromium 13 pass/7 intentional skip PASS; 리뉴얼 전 byte-exact 233-path clean snapshot은 37 files/185 tests, coverage threshold, PWA artifact/smoke PASS
- built-app home/ticket/OG smoke 200, OG 30,423 bytes, home JS gzip 167,035 bytes, PWA precache 45/forbidden 0
- Chromium 20 discovered 중 13 pass/7 intentional project-gated skip, mobile organizer 1/1, keyboard/focus와 built-PWA 3/3 PASS
- cold/warm lab, home JS gzip, search distribution, calculation/ticket scripted latency PASS; field p75는 표본 없어 `NOT_RUN + NONE`

audit/install의 sandbox package/cache `EACCES`와 Chromium spawn `EPERM`은 승인된 동일 명령 재실행에서 PASS했다. stale Next 16.1.7 generated types는 clean-generated 뒤 16.2.11로 재생성했고, cold coverage의 OG timeout은 assertion을 유지한 명시적 integration ceiling에서 targeted/full 회귀 PASS로 닫았다. 이는 제품 실패를 숨긴 것이 아니라 generated-state와 managed sandbox 경계를 기록한 해결된 재시도다. 정확한 수치는 `VERIFICATION_REPORT.md`에 있다.

## 임시 스마트폰 preview

- URL: `https://interactions-suffered-participate-empire.trycloudflare.com`
- owner process: fixture app PID 35632 (`127.0.0.1:34173`), Quick Tunnel PID 43376
- lifecycle: `ACTIVE_PREVIEW/READY`; stable host, staging 또는 production 아님
- current public flow: 홈·참조 자산 14개·검색 API·manifest·service worker 200, Chromium organizer→recipient→import와 반응형·접근성 전체 13 pass/7 intentional skip
- current Station UI: `SINGSONG`, bold numeric count, single `+`, `시간`, centered `완료`, redundant completion hint 없음
- isolation: 이전 3000번 포트 기반 터널은 싱송 종료 뒤 Podoal을 오노출해 종료했다. 다른 앱을 중지하지 않고 싱송을 전용 34173번 포트로 분리했다.
- Android Chrome 설치: **더보기 → 홈 화면에 추가 → 설치**
- iPhone Safari 설치: **더보기/공유 → 홈 화면에 추가 → ‘웹 앱으로 열기’ 활성화 → 추가**

Quick Tunnel/PC가 꺼지면 설치 아이콘도 열리지 않을 수 있다. stable hostname으로 옮기면
origin-bound IndexedDB가 자동 이전되지 않으므로 임시 preview를 장기 설치 경로로 배포하지
않는다.

## 사람이 제공/설정해야 하는 것

| Blocker                 | Owner/authority                       | 필요한 입력                                                | 완료 evidence                                           |
| ----------------------- | ------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Catalog rights/quality  | product owner + data provider + legal | source/license/scope/update/takedown, 충분한 TJ/KY corpus  | signed manifest, coverage/regression 결과               |
| Supabase                | infrastructure owner                  | new project URL, `sb_secret_` key, migration 권한          | real ACL/RPC/TTL/race/scheduler report                  |
| Legacy key disable      | Supabase project owner                | Dashboard/Management 권한                                  | legacy anon/service-role disable + redacted old-key 401 |
| Share HMAC/rate secrets | security owner                        | 32+ byte independent secrets, active version               | secret-manager references, rotation rehearsal           |
| Turnstile               | domain/security owner                 | production site/secret, exact host/action                  | Siteverify negative/timeout/replay evidence             |
| Domain/CDN              | release owner                         | HTTPS canonical URL, cache/log policy                      | no-store/noindex/no-referrer/CSP/OG matrix              |
| Legal/privacy           | owner/legal/ops                       | privacy/terms/takedown contact/SLA/brand approval          | approved documents and named on-call                    |
| Operations              | SRE/owner                             | monitoring, quota, backup, restore, rollback, key rotation | rehearsal with RPO/RTO and alerts                       |
| Devices/users           | QA/research                           | iOS/Android/Kakao/PWA/AT devices and participants          | manual matrix + consented study evidence                |

## Production setup

1. `pnpm install --frozen-lockfile`로 설치하고 toolchain/hash를 확인한 뒤 `pnpm audit --audit-level=low`가 known vulnerability 0인지 확인한다.
2. 새 Supabase project에 `supabase/migrations/20260722010000_share_snapshot_v1.sql`을 적용한다.
3. `docs/catalog/SQL_PRIVILEGE_CHECKLIST.md`에 따라 private direct privilege 0과 exact RPC 6개를 실제 role로 확인한다.
4. daily UTC cleanup RPC schedule과 row/byte/rate bucket/expiry alerts를 설정한다. migration 파일이 scheduler 자체 활성화를 증명한다고 가정하지 않는다.
5. `.env.example`의 production 값을 secret manager에 넣는다. raw value를 shell log, ticket, docs, test artifact에 기록하지 않는다.
6. catalog production provider/ingestion을 `CATALOG_RIGHTS.md`, `INGESTION_RUNBOOK.md`, `PROVENANCE.md`, `TAKEDOWN.md` 승인 뒤에만 활성화한다.
7. `pnpm build:release` 후 stable HTTPS preview URL을 `RELEASE_BASE_URL`과 `NEXT_PUBLIC_SITE_URL`에 일치시켜 `pnpm verify:release`를 실행한다. 임시 Quick Tunnel의 shell 200은 이 gate를 대신하지 않는다. 이 script는 `APP_PROFILE=release`를 명시하고 내부 runtime만 production 호환값으로 매핑한다.
8. `pnpm start` 때 Node instrumentation이 pure runtime env contract를 재검증하고 Supabase required-key RPC로 active·historical slug HMAC key를 모두 확인하는지 관찰한다. 실패한 instance는 traffic에서 제외한다.
9. actual device와 legal/ops 행이 PASS한 뒤에만 사람이 production traffic 승인을 내린다.

필수 environment:

- public/runtime config: `APP_PROFILE=release`, `NEXT_PUBLIC_APP_PROFILE=release`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_ALLOWED_HOSTNAMES`
- server-only: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SHARE_SLUG_ACTIVE_KEY_VERSION`, 해당 `SHARE_SLUG_HMAC_KEY_V<n>`, `RATE_LIMIT_IP_HMAC_KEY_V1`, `TURNSTILE_SECRET_KEY`
- catalog gate: `CATALOG_RIGHTS_MANIFEST_PATH`, `CATALOG_RIGHTS_MANIFEST_SHA256`, `CATALOG_PROVIDER_URL`, `CATALOG_PROVIDER_API_KEY`
- release verification only: `RELEASE_BASE_URL` (배포한 HTTPS preview 또는 production origin; `verify:release`와 `test:pwa:release`의 대상)
- optional ops: `RATE_LIMIT_REDIS_URL`, `RATE_LIMIT_REDIS_TOKEN`, `OBSERVABILITY_DSN`

## Deploy와 rollback

배포 install은 `pnpm install --frozen-lockfile`, build는 `pnpm build:release`, runtime은 `pnpm start`다. `build:production`은 호환 alias다. 이전 verified immutable app artifact를 항상 보존한다.

Rollback 순서:

1. 새 share 생성에 문제가 있으면 create traffic을 우선 차단하고 exact read/revoke를 유지한다.
2. 직전 verified app artifact로 route traffic을 전환한다.
3. DB schema와 reservation/slug namespace를 자동 삭제하지 않는다. migration 끝의 rollback notes는 백업·영향 검토·운영 승인 뒤에만 사용한다.
4. HMAC old version은 마지막 해당 row 뒤 최소 45일 유지한다. version을 재사용하지 않는다.
5. credential incident면 current/legacy key를 회전/disable하고 raw key 없는 probe로 확인한다.
6. incident timeline, affected requests/rows, third-party preview cache limitation과 사용자 메시지를 남긴다.

## 공개 beta 전 체크

- [ ] production catalog rights/provenance/coverage/new-song SLA/takedown
- [ ] Supabase migration, direct ACL 0, RPC 6, legacy keys disabled
- [ ] Turnstile exact host/action/time, proxy IP, rate quotas, fail-closed timeout
- [ ] expiry/revoke/cleanup scheduler와 capacity alerts
- [ ] privacy/terms/takedown contact/brand, incident owner
- [ ] backup/restore/RPO/RTO와 application rollback rehearsal
- [ ] domain no-store/noindex/no-referrer/CSP/access-log retention
- [ ] iOS/Android/Kakao/PWA/native share/PNG/OG/VoiceOver/TalkBack
- [ ] actual organizer/recipient study and truthful marketing copy
- [x] repository-owned Critical/High 0와 current mobile-shell required automated PASS

## 알려진 저장소 측 추적 항목

확인형 `새 플랜 시작`과 즉시 undo, 100곡 4-byte canonical payload, exact 96KiB/96KiB+1과 raw 128KiB/128KiB+1은 최종 자동검증에서 PASS했다. startup env·share-key readiness도 unit/static 계약은 PASS했지만 실제 Supabase RPC startup은 외부 환경이 필요하다.

- real Postgres에서 share response-loss·key rotation·quota race를 재현한 증거가 필요하다.
- concurrent ticket writer/seed는 integration에서 PASS했다. 실제 two-browser back-forward artifact와 full checkpoint/stale-lock fault harness는 별도 후속 evidence다.
- production Turnstile action/hostname/challenge age 및 Siteverify stable binding은 real service와 함께 검증해야 한다.
- 리뉴얼 전 `.nvmrc`의 exact Node 24.18.0에서 233-path clean snapshot을 재현했다. clean은 frozen install 506 packages reused, format/lint/type, 37/185 coverage, build/PWA/smoke를 통과했다. 최신 리뉴얼 current는 별도로 39/193·fixture build·public Chromium 13 PASS/7 intentional skip을 통과했다.
- Next 16.1.7 audit의 15건(High 8건)은 16.2.11과 PostCSS 8.5.20으로 수정했고 최종 prod+dev audit은 0건이다.
- `build:release`, `verify:release`, real release browser는 권리·credential·Supabase/Turnstile/domain이 없어 `BLOCKED_EXTERNAL`이며 실행하지 않았다.

Root가 이 항목을 이번 run에서 해결하면 `UNKNOWN_RESOLUTIONS.md`, `REQUIREMENTS_TRACE.md`, QA 결과를 함께 갱신한다.

## Evidence와 artifacts

- pre-change material: `MATERIAL_INVENTORY.md`, `MD_READ_LEDGER.md`
- Git history: `GIT_HISTORY_AUDIT.md`
- requirement decisions: `IMPLEMENTATION_CONTRACT.md`, `CONFLICT_REGISTER.md`, `UNKNOWN_RESOLUTIONS.md`, `DECISIONS_LOG.md`, `REQUIREMENTS_TRACE.md`
- toolchain/tests: `TOOLCHAIN_LOCK.md`, `docs/verification/TEST_PLAN_V3.md`, `QA_MATRIX_V3.md`
- implementation change list: `CHANGE_MANIFEST.md`
- current architecture: `ARCHITECTURE.md`
- final verification: `VERIFICATION_REPORT.md`
- final path/preservation audit: `FINAL_MATERIAL_AUDIT.md`
- retained pre-shell clean reproduction: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-clean-release-final-683054d4ee774d5ea65dedb69d21145c/` (219 paths)
- retained pre-renewal 233-path clean reproduction: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-clean-shell-20260722-1033/`; 당시 source missing/SHA mismatch 0
- retained pre-shell E2E output: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-playwright-next16211-final-683054d4ee774d5ea65dedb69d21145c/`
- retained pre-shell PWA output: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-playwright-pwa-next16211-final-683054d4ee774d5ea65dedb69d21145c/`
- mobile-shell completion/trace: `MOBILE_APP_SHELL_PLAN.md`, `REQUIREMENTS_TRACE.md`, `FINAL_MATERIAL_AUDIT.md`
- retained pre-renewal coverage: `coverage/coverage-summary.json` — 37/185와 global threshold PASS; 최신 39/193은 coverage 재측정 없음
- current E2E/PWA: `C:/Users/agape/AppData/Local/Temp/singsong-playwright/{e2e,production-pwa}/report/index.html`; 각 generated `.last-run.json` status `passed`
- phone preview: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-phone-preview/`의 public-origin log와 mobile screenshots
- repository `test-results/**/.last-run.json`은 이전 실패 generated metadata이며 final PASS 근거가 아니다.
- generated build/service worker: `.next/`, `public/sw.js` (재생성 가능, source evidence 아님)

## Active preview owner와 종료

`ACTIVE_RUN.lock`은 존재하지 않는다. root release agent가 사용자 확인을 위해 시작한 app PID
35632와 tunnel PID 43376은 현재 의도적으로 유지한다. clean shutdown으로 표시하지 않으며,
사용자가 확인을 끝냈을 때 root가 command line·listener·PID를 다시 대조한 뒤 자신이 시작한
두 process만 종료한다. 이 문서는 다른 owner의 process를 중지하거나 broad process cleanup을
허가하지 않는다.
