# SingSong Test Plan v3

목표는 local fixture의 핵심 여정, production boundary, 설치 가능한 PWA를 각각 실제 수준에 맞게 검증하는 것이다. test 존재와 test PASS, static SQL과 real ACL, browser automation과 actual device를 서로 대체하지 않는다.

## 환경과 profile

| Subject                 | 목적                                   | 필수 조건                                                             | 허용 판정                  |
| ----------------------- | -------------------------------------- | --------------------------------------------------------------------- | -------------------------- |
| `fixture` Node          | domain/API/Dexie/local share 회귀      | frozen lockfile, explicit `APP_PROFILE=fixture`                       | PASS/FAIL                  |
| Chromium mobile/desktop | 핵심 UI, a11y, reflow, download        | Playwright browser executable                                         | PASS/FAIL                  |
| `release` build/runtime | rights/profile/startup/bundle/SW       | 승인 manifest, 실제 provider·Supabase·Turnstile·domain secret manager | PASS/FAIL/BLOCKED_EXTERNAL |
| local/preview Postgres  | migration, ACL, RPC, TTL/revoke/race   | PostgreSQL/PostgREST/Supabase tooling                                 | PASS/FAIL/BLOCKED_EXTERNAL |
| production domain       | cache/CSP/OG/Turnstile/proxy/scheduler | 배포 URL과 운영 credentials                                           | PASS/FAIL/BLOCKED_EXTERNAL |
| actual devices          | iOS/Android/Kakao/PWA/storage/share    | 기기, 계정, HTTPS domain                                              | PASS/FAIL/BLOCKED_EXTERNAL |

모든 evidence는 run ID, source digest/commit, command, exit code, profile, environment subject, 시작/종료 시각과 artifact path를 가진다. Playwright output은 `PLAYWRIGHT_ARTIFACT_ROOT` 또는 OS temp의 `singsong-playwright/{e2e,production-pwa}`를 사용한다. 실패 재실행은 최초 실패와 수정 후 결과를 함께 남긴다.

## 자동 검증 순서

### T0 — 설치와 toolchain

1. 현재 tree와 새 writable clean source archive에서 `pnpm run install:frozen`.
2. lockfile과 `package.json` hash가 `TOOLCHAIN_LOCK.md`와 일치하는지 검사.
3. floating version, lifecycle script 증가, 허용되지 않은 dependency build가 없는지 확인.
4. `pnpm audit --audit-level=low`를 prod+dev 전체 graph에 실행하고 known vulnerability가 0인지 확인.
5. `APP_PROFILE` 누락과 release required env 누락이 build와 Node startup을 fail closed하는지 확인.

수용 기준: lockfile 변경 0, install exit 0, known vulnerability 0, dependency warning은 분류, build allowlist와 release-age 예외가 exact·최소이며 비밀/host path가 artifact에 없음.

### T1 — format, lint, type

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
```

수용 기준: exit 0, ESLint warning 0, TypeScript strict/noUncheckedIndexedAccess/exactOptionalPropertyTypes 오류 0. 초기 사용자 문서는 formatting 명령으로 재작성하지 않는다.

### T2 — unit/property/oracle

```powershell
pnpm test:unit
pnpm test -- --coverage
```

필수 범위:

- `fallback-v1` N=0/1/100, raw low/mid/high, coverage 0, monotonicity, 5분 display 분리
- bundle expensive/overbuy/boundaries와 brute-force oracle
- time 29:59/30:00/30:01 equivalent block 경계, 1/30 people와 remainder
- reverse maximality와 `0<=guaranteed<=possible<=cap`
- negative/decimal/NaN/Infinity/unsafe/overflow/missing/unknown key 거부
- Unicode code-point/NFC/control/bidi/karaoke code validation
- catalog punctuation/whitespace/token AND/order-independent/stable ranking
- canonical key 순서, local ID 제거, same semantic fingerprint, derived tamper 거부

coverage threshold는 statements 80%, branches 75%, functions 80%, lines 80%다. threshold를 낮추거나 assertion을 tautology로 바꾸지 않는다.

### T3 — integration/static security

```powershell
pnpm test:integration
pnpm test -- tests/static
```

필수 범위:

- Dexie initial emission, expected revision winner/loser, atomic rollback, duplicate import, continuous order, max 100
- search BFF POST/no-store/content type/origin/raw 1KiB/result max 20
- share create/read/revoke, exact 22/43-char capability, idempotent retry, tampered calculation, unavailable envelope
- 96KiB canonical, 128KiB raw, worst 100×4-byte text golden boundary
- migration의 private direct grant 0, exact RPC grant 6, NOLOGIN owner, empty search_path, RLS/immutable/TTL
- service worker controlled update와 API/search/share/OG exclusion
- browser bundle/public env/structured log secret-content scan

Static SQL PASS는 real database의 ACL, trigger, transaction, timing, scheduler PASS가 아니다.

### T4 — Playwright core, a11y, responsive

```powershell
pnpm test:e2e
```

기존 core flow는 최소 다음을 end-to-end로 수행한다.

1. fixture 검색 또는 직접 추가로 3곡을 담는다.
2. 키보드/버튼으로 reorder하고 delete/undo한다.
3. user-entered price와 people로 범위를 만든다.
4. ticket을 발급하고 reload에서 같은 snapshot을 확인한다.
5. 1080×1350 PNG download의 signature/dimensions/nonblank를 확인한다.
6. link를 생성, exact SSR로 수신, `/import` preview와 replacement confirm, duplicate guard를 확인한다.
7. revoke 뒤 API/HTML/import/OG가 generic unavailable인지 확인한다.

Unhappy matrix:

- empty/invalid/100곡/긴 Korean/큰 won, offline/server error/storage unavailable/revision conflict
- composition 중 request 0, end+200ms, abort/late-response stale commit 0
- non-JSON/cross-origin/oversize/malformed slug/tampered snapshot/wrong revoke token/rate limit
- 320×568, 390×844, 768×1024, 1440×900에서 horizontal overflow 0
- light/dark, reduced motion, forced colors, 200% text, 400% zoom/reflow
- keyboard-only 전체 핵심 흐름, skip link, focus order/return, live announcement
- 각 핵심 route에서 axe critical/serious 0
- mobile/desktop에서 첫 Tab의 skip-link focus, 3px 이상 visible focus ring, Enter의 `#main-content` 이동, 다음 Tab의 main 내부 control 진입과 focus trap 0
- 플랜·검색 `PrimaryNav` DOM은 route당 정확히 1개이고 mobile bottom↔wide header에서 위치만 바뀌며 현재 route에 `aria-current=page`
- home은 marketing hero/card stack 없이 WorkingStrip queue→perforation 1개→CalculationStrip 순서; 0곡은 strip 검색 링크 하나, nonempty는 ActionDock next action 하나
- search는 sticky input·continuous ledger·PlanRail을 유지하고 plan 곡/시간/비용과 복귀 링크를 제공
- mobile BottomSlot+nav fixed stack은 viewport 25% 이하이고 200% 확대/soft-keyboard 공간 부족 시 flow로 복귀해 content/focus를 가리지 않음

Playwright trace/video/screenshot는 실패 때만 보존해 민감정보와 artifact 크기를 줄인다. fixture 콘텐츠만 포함해야 한다.

### T5 — production build/start/PWA

```powershell
pnpm build:demo
node scripts/verify-built-pwa.mjs
pnpm exec cross-env APP_PROFILE=fixture NEXT_PUBLIC_APP_PROFILE=fixture node scripts/smoke-http.mjs
pnpm test:pwa
```

별도 Playwright config가 `next start`를 띄운 fixture production artifact에서 generic OG/security headers, registered controlled page, online 1회 뒤 offline shell, waiting update의 dismiss/accept와 mutation replay 0을 확인한다. 생성 `public/sw.js`의 precache에 `/api`, `/search`, `/s`, OG route chunk가 없는지 빌드 후 검사한다. `sw.js`는 no-cache다. icon 192/512/apple 180 dimensions와 sRGB alpha는 별도 sharp metadata 검사, manifest의 maskable path/size/type는 static 검사로 판정한다.

임시 public tunnel은 위 production-artifact 검증을 대신하지 않는다. phone review에 노출할 경우
`NEXT_PUBLIC_SITE_URL`과 public hostname을 일치시키고, 같은 public Origin으로 GET shell뿐
아니라 `POST /api/search`와 허용된 share mutation, service-worker control을 검증한다. shell
200만으로 organizer flow 또는 install PASS를 선언하지 않는다.

실제 release build는 승인된 별도 environment에서 `pnpm build:release`를 실행한다. `build:production`은 호환 alias일 뿐이다. fixture row/watermark/provider, loopback bypass, client secret, server repository가 client chunk에 없는지 검사하고 `pnpm test:pwa:release`는 `RELEASE_BASE_URL`의 실제 preview를 대상으로 한다. 값은 evidence에 출력하지 않는다.

Node startup은 `scripts/release-env-contract.mjs`의 공용 필수 이름을 기준으로 순수 runtime env 검증을 먼저 실행한 뒤, Supabase required-key RPC로 active/historical slug HMAC key가 모두 준비됐는지 확인해야 한다. build PASS를 startup PASS로 대신하지 않는다.

### T6 — performance

```powershell
pnpm perf:lab
```

- 4× CPU, 40ms latency, 10Mbps down/5Mbps up에서 service worker를 막고 cold·warm 각각 5회 LCP/TBT/CLS/50ms 초과 long-task median·worst를 기록한다.
- home HTML이 참조한 modern initial route chunk를 gzip level 9로 합산해 잠정 170KiB 이하인지 HTTP smoke에서 확인한다.
- fixture 12 rows, 번호/한글/초성/실패 4-query corpus, cold/warm/concurrency 4, 각각 40 requests의 p95/worst를 기록한다.
- 계산 입력→결과 5회와 ticket issue latency를 같은 throttled browser에서 기록한다.
- field LCP/INP/CLS p75는 동일 release·region·device-class의 충분한 RUM/CrUX 표본이 없으면 반드시 `NOT_RUN + NONE`이다.

### T7 — real database/security

Migration을 disposable Supabase/Postgres 환경에 적용한 뒤:

- anon/authenticated/service_role의 private table/view/sequence direct privilege 0
- service_role exact RPC 6만 execute, generic schema/table dump 거부
- valid create/read/revoke, wrong token, missing/expired/revoked 동일 envelope
- concurrent same/different idempotency, commit 후 response loss, key rotation/missing old key
- DB now 기준 expiry 즉시 terminalization과 daily cleanup idempotency
- create 10/hour+30/day, revoke 60/hour+200/day, bucket 48h cleanup
- malicious text가 text로만 렌더되고 SQL/XSS에 영향 없음

환경이 없으면 static 계약은 별도 판정하고 실제 DB 결과는 `BLOCKED_EXTERNAL`이다.

### T8 — production domain/operations

- exact domain/Turnstile action·hostname·challenge age, trusted proxy IP, fail-closed timeout
- `/s`/OG/API 두 번 조회의 Cache-Control/Age/CDN behavior와 revoke 직후 origin
- CSP violation 0, access-log path redaction/retention/access review
- synthetic search/share/revoke/OG probes, row/byte/quota/rate/error/p95 alert
- backup/restore rehearsal과 RPO/RTO, rollback artifact, key rotation

실제 service와 운영 권한 없이는 `BLOCKED_EXTERNAL`이다.

## 실제 기기 수동 검증

| Case          | 최소 대상                                     | PASS 증거                                                                                                                                                                                                         |
| ------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kakao handoff | iPhone Safari + Kakao, Android Chrome + Kakao | 전체 URL copy/open → exact import; 저장 context를 정확히 표시                                                                                                                                                     |
| PWA install   | iOS Add to Home Screen, Android install       | Android Chrome **더보기→홈 화면에 추가→설치**, iPhone Safari **더보기/공유→홈 화면에 추가→‘웹 앱으로 열기’ 활성화→추가**; manifest/icon/standalone, local data continuity를 관찰하고 영구보존이라고 주장하지 않음 |
| Native share  | iOS/Android                                   | 별도 user action에서 share sheet, cancel silent, resolve를 실제 전송으로 오표현하지 않음                                                                                                                          |
| PNG           | Safari/Chrome/Kakao WebView                   | 한글/font/color/1080×1350 실제 파일과 fallback                                                                                                                                                                    |
| OG            | Kakao/일반 crawler                            | first preview, expiry/revoke, generic fallback, 제3자 cache 한계 기록                                                                                                                                             |
| Accessibility | VoiceOver/TalkBack/keyboard                   | search→calc→ticket→import 완료와 focus/announcement 기록                                                                                                                                                          |

## 종료 기준

- repository-owned Critical/High 0, 필수 자동검사 exit 0, build/start/core flow/PWA 증거가 있어야 `LOCAL_DEMO_READY`를 확정한다.
- production candidate는 catalog rights/quality, real DB ACL/Turnstile/rate/scheduler, domain/cache/OG, backup/monitoring/legal, actual-device가 모두 PASS해야 한다.
- 외부 blocker가 있으면 local 결과를 보존하고 production gate만 `BLOCKED_EXTERNAL`로 유지한다.

2026-07-22 run은 Next 16.2.11과 prod+dev audit 0에서 local fixture의 T0~~T6 repository/browser 범위를 통과해 `LOCAL_DEMO_READY` candidate로 판정했다. T7~~T8과 actual devices/people/rights는 `BLOCKED_EXTERNAL`, field p75는 `NOT_RUN + NONE`이다. 정확한 수치는 `VERIFICATION_REPORT.md`, 행별 판정은 `QA_MATRIX_V3.md`가 소유한다.
