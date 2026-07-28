# SingSong Release Handoff

## 현재 상태

- 제품 경로: Expo 네이티브 앱(`apps/app`) + 공유 API/랜딩(`services/share-api`)
- 저장소 capability: `NATIVE_REPOSITORY_READY` — 플랜·티켓·PNG·공유 링크·딥링크 가져오기·
  보관함·발견·설정 흐름과 fixture API smoke를 로컬 자동 검증할 수 있음
- production gate: `BLOCKED_EXTERNAL`
- 가장 큰 blocker: 권리 승인 production catalog, 실제 Supabase/Redis/HTTPS origin,
  앱 서명·Expo 빌드 계정, Android/iOS 실기기와 카카오 공유 증거
- 배포 상태: 새 공유 서비스와 EAS production APK를 배포하지 않았음
- 레거시 상태: Next/PWA와 기존 Quick Tunnel은 rollback/reference일 뿐 네이티브 배포 증거가 아님

네이티브 전환의 행별 판정은 `docs/PARITY_LEDGER.md`, 기기에서 반드시 확인할 항목은
`docs/verification/NATIVE_DEVICE_CHECKLIST.md`가 소유한다. 외부 게이트가 닫히기 전에는
Next/PWA 트리를 삭제하지 않는다.

실제 명령/exit code/build/E2E 결과는 `VERIFICATION_REPORT.md`가 유일한 최종 근거다.
`docs/verification/QA_MATRIX_V3.md`는 보존된 PWA 검증표이며 네이티브 최신 판정을 소유하지
않는다. 로컬 fixture 후보의 PASS는 실제 release build, production service 또는 공개 배포
PASS가 아니다.

## 네이티브 경로에 구현된 것

- expo-sqlite 단일 활성 플랜과 revision CAS, 0–100곡, 재정렬·삭제·되돌리기
- 합성 36곡 검색, 직접 입력·중복 확인, 인원·가격·예산 계산
- 공용 ticket scene의 Skia 화면/CPU PNG와 SVG 랜딩, revision 보관
- 1080×1350 PNG의 갤러리 저장과 OS 공유, 30일 링크 생성·복사·폐기
- 공유 중/완료 보관함, 발견, 로컬 프로필 사진·6색 테마·OTA 표면·전체 삭제
- custom/HTTPS 딥링크 정규화, 읽기 전용 미리보기, 명시적 가져오기·교체·되돌리기
- 공유 API의 fixture/Supabase seam, 분산 rate-limit seam, CSP/no-store/noindex,
  절대 OG URL, association 파일과 credential-less fail-closed preflight

## 보존된 Next/PWA 기준선에 구현되어 있던 것

- 가입 없는 한 활성 plan: fixture 검색, 직접 추가, 최대 100곡, 위/아래 reorder, 삭제/undo, 확인형 새 플랜/즉시 undo
- 사용자가 입력하는 곡/시간 가격과 인원, `fallback-v1` 시간·비용·인당 범위, reverse prefix helper
- revision-frozen semantic CUTLINE ticket과 browser PNG 저장
- fixture의 process-local 30일 unlisted share create/read/revoke, exact SSR, copy/Web Share
- same-origin canonical slug preview, nonempty replacement 확인, duplicate-protected local import
- Folded Session S 헤더·PWA/Apple 아이콘, Next manifest, offline shell, controlled update prompt
- compact AppHeader, mobile bottom↔wide header를 공유하는 플랜·검색 2-item nav, Station ledger·2열 estimate·inline 완료 action, 검색 PlanRail BottomSlot
- Android explicit install prompt, iOS Safari 홈 화면 추가 안내, standalone/immersive 억제와 temporary-host 경고
- production Supabase server adapter, hash-only/function-only migration, catalog/ACL/takedown runbooks
- strict headers/CSP/body/origin/schema validation, redacted structured logging, typed no-op analytics
- build/runtime 공용 release env-name 계약과 Node startup의 환경·historical share-key fail-closed readiness

Fixture의 곡/가수/TJ/KY 번호는 모두 `TEST DATA`이며 실제 catalog 주장이나 외부 beta data가 아니다. fixture 공유는 server restart 때 사라진다. 로컬 plan/ticket/import와 managed share receipt/secret은 browser IndexedDB에 남지만 backup·영구보존을 보장하지 않는다. raw capability는 `localStorage`가 아니라 Dexie v4의 분리 테이블에 저장된다.

## Staging/production에서 실제 되는 것으로 확인된 것

없음. 이 run은 외부 deploy, Supabase migration 적용, Redis/domain 연결,
scheduler/backup 설정을 수행하지 않았다. 따라서 production repository와 deployment는
코드/문서 준비 상태이며 운영 PASS가 아니다.

## 로컬 검증 결과

- Node `v24.11.1`/npm `11.6.2`, frozen root/app install, monorepo guard 17/17,
  guard tests 20/20, token 정본 56개/선언 102개 PASS
- 루트 format/lint/type, M1 12개 gate, Vitest 64 files/504 tests와 커버리지
  statements 83.53%, branches 76.02%, functions 84.11%, lines 85.69% PASS
- Expo 앱 lint/type, 15개 계약 테스트, Expo doctor 20/20, install check,
  2,220-module Android Hermes bytecode export PASS
- 공유 API typecheck/build/smoke와 144개 테스트, 실제 브라우저 랜딩/axe/revoke 3/3 PASS
- 보존된 Next 16.2.11 fixture production build PASS
- 앱 전체와 루트 운영 의존성 감사 0건. 전체 루트 감사에는 보존된
  ESLint/minimatch 3의 `brace-expansion` 개발 의존성 high 9건이 남으며, 호환성을 깨는
  v5 강제 override는 사용하지 않음
- 서비스 production preflight와 앱 EAS production hook은 자격 증명/origin이 없을 때
  의도대로 `BLOCKED_EXTERNAL`/exit 1

Chromium 첫 실행의 sandbox `spawn EPERM`은 승인된 동일 소스 재실행에서 3/3 PASS했다.
정확한 명령과 판정은 `VERIFICATION_REPORT.md`의 2026-07-28 네이티브 완료 절이 소유한다.

## 보존된 PWA 스마트폰 preview 기록

- URL: `https://interactions-suffered-participate-empire.trycloudflare.com` (2026-07-23 기록,
  2026-07-28 생존 여부 미검증)
- 당시 owner process: fixture app PID 43664 (`127.0.0.1:34173`), Quick Tunnel PID 43376
- 당시 lifecycle: `ACTIVE_PREVIEW/READY`; stable host, staging 또는 production은 아니었음
- 검증 당시 public flow: 홈·검색 API·manifest·Folded Session S icon·service worker 200,
  Chromium organizer→recipient→import 13 pass/7 intentional skip와 public PWA 3/3
- 검증 당시 brand cache contract: `folded-session-s-{180,192,512}.png`,
  runtime cache `singsong-static-v2`
- isolation: 이전 3000번 포트 기반 터널은 싱송 종료 뒤 Podoal을 오노출해 종료했다. 다른 앱을 중지하지 않고 싱송을 전용 34173번 포트로 분리했다.
- Android Chrome 설치: **더보기 → 홈 화면에 추가 → 설치**
- iPhone Safari 설치: **더보기/공유 → 홈 화면에 추가 → ‘웹 앱으로 열기’ 활성화 → 추가**

Android 설치 창에 이전 아이콘이 보이면 창을 취소하고 탭을 완전히 닫은 뒤 `/?v=folded-session-s`로 다시 연다. origin-local Dexie 플랜 손실 위험 때문에 사이트 데이터 삭제는 안내하지 않는다.

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
| Proxy/rate limit        | domain/security owner                 | Vercel trusted header, Redis URL/token, IP HMAC            | real header/spoof/timeout/rate evidence                 |
| Domain/CDN              | release owner                         | HTTPS canonical URL, cache/log policy                      | no-store/noindex/no-referrer/CSP/OG matrix              |
| Legal/privacy           | owner/legal/ops                       | privacy/terms/takedown contact/SLA/brand approval          | approved documents and named on-call                    |
| Operations              | SRE/owner                             | monitoring, quota, backup, restore, rollback, key rotation | rehearsal with RPO/RTO and alerts                       |
| Devices/users           | QA/research                           | iOS/Android/Kakao/PWA/AT devices and participants          | manual matrix + consented study evidence                |

## Production setup

1. 루트와 `apps/app`에서 각각 `npm ci`를 실행하고 repository gate를 재현한다.
2. 새 Supabase project에 `supabase/migrations/20260722010000_share_snapshot_v1.sql`을
   적용하고 private direct privilege 0과 allowlist RPC를 실제 role로 확인한다.
3. 권리 승인 catalog manifest/provider와 Supabase·slug HMAC·Redis/IP HMAC 비밀을
   secret manager에 넣는다. raw 값은 log, ticket, 문서, artifact에 기록하지 않는다.
4. stable HTTPS `SITE_ORIGIN`, `VERCEL=1`, Android release fingerprint와
   `IOS_APP_ID`를 설정하고 `npm run share-api:preflight`를 통과시킨다.
5. 같은 service artifact를 배포해 association content-type, OG crawler, proxy 수신 IP,
   revoke/expiry/cleanup, alert와 backup/restore를 실제 환경에서 확인한다.
6. 배포된 origin을 `EXPO_PUBLIC_SHARE_API_ORIGIN`으로 넣고 clean commit에서
   `eas build --platform android --profile production`을 실행한다.
7. Android/iOS 실기기 체크리스트, 폰 A→B handoff, OTA manifest를 닫은 뒤에만
   사람이 production traffic과 레거시 트리 삭제를 승인한다.

필수 environment는 `services/share-api/.env.example`이 정본이다. 핵심 범주는
`APP_PROFILE`, `SITE_ORIGIN`, Supabase, `SHARE_SLUG_*`, `RATE_LIMIT_*`, `CATALOG_*`,
`ANDROID_APP_SHA256_CERT_FINGERPRINTS`, `IOS_APP_ID`다. 앱에는 public HTTPS
`EXPO_PUBLIC_SHARE_API_ORIGIN`만 주입한다.

## Deploy와 rollback

공유 서비스 install은 루트 `npm ci`, build는 `npm run share-api:build`다. 앱은
`EXPO_PUBLIC_SHARE_API_ORIGIN`을 고정한 clean commit에서 EAS production profile로 만든다.
이전 verified immutable 서비스와 앱 artifact를 항상 보존한다.

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
- [ ] Redis/trusted proxy IP, rate quotas, HMAC rotation, fail-closed timeout
- [ ] expiry/revoke/cleanup scheduler와 capacity alerts
- [ ] privacy/terms/takedown contact/brand, incident owner
- [ ] backup/restore/RPO/RTO와 application rollback rehearsal
- [ ] domain no-store/noindex/no-referrer/CSP/access-log retention
- [ ] iOS/Android/Kakao/PWA/native share/PNG/OG/VoiceOver/TalkBack
- [ ] actual organizer/recipient study and truthful marketing copy
- [x] repository-owned runtime Critical/High 0와 현재 네이티브 자동 게이트 PASS
- [ ] 보존된 ESLint 개발 도구 체인의 upstream `brace-expansion` high 해소

## 알려진 저장소 측 추적 항목

확인형 `새 플랜 시작`과 즉시 undo, 100곡 4-byte canonical payload, exact 96KiB/96KiB+1과 raw 128KiB/128KiB+1은 최종 자동검증에서 PASS했다. startup env·share-key readiness도 unit/static 계약은 PASS했지만 실제 Supabase RPC startup은 외부 환경이 필요하다.

- real Postgres에서 share response-loss·key rotation·quota race를 재현한 증거가 필요하다.
- concurrent ticket writer/seed는 integration에서 PASS했다. 실제 two-browser back-forward artifact와 full checkpoint/stale-lock fault harness는 별도 후속 evidence다.
- production Turnstile action/hostname/challenge age 및 Siteverify stable binding은 real service와 함께 검증해야 한다.
- 리뉴얼 전 `.nvmrc`의 exact Node 24.18.0에서 233-path clean snapshot을 재현했다. clean은 frozen install 506 packages reused, format/lint/type, 37/185 coverage, build/PWA/smoke를 통과했다. 최신 리뉴얼 current는 별도로 39/194·fixture build·public Chromium 13 PASS/7 intentional skip·public PWA 3/3을 통과했다.
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
- retained pre-renewal coverage: `coverage/coverage-summary.json` — 37/185와 global threshold PASS; 최신 39/194는 coverage 재측정 없음
- current E2E/PWA: `C:/Users/agape/AppData/Local/Temp/singsong-playwright/{e2e,production-pwa}/report/index.html`; 각 generated `.last-run.json` status `passed`
- phone preview: `C:/Users/Public/Documents/ESTsoft/CreatorTemp/singsong-phone-preview/`의 `app-folded-session-s.stdout.log`, `folded-session-s-mobile.png`와 tunnel log
- repository `test-results/**/.last-run.json`은 이전 실패 generated metadata이며 final PASS 근거가 아니다.
- generated build/service worker: `.next/`, `public/sw.js` (재생성 가능, source evidence 아님)

## 과거 preview process 취급

`ACTIVE_RUN.lock`은 존재하지 않는다. app PID 43664와 tunnel PID 43376은 과거 실행 기록일
뿐 현재 owner 증거가 아니다. 종료 대상으로 간주하기 전에 root가 command line·listener·PID를
다시 대조해야 하며, 다른 owner의 process 또는 broad process cleanup은 허가하지 않는다.
