# SingSong Session Strip

SingSong은 2~4명이 노래방에 가기 전에 부를 곡의 순서, 예상 시간, 가격표 기준 비용을 한 장의 티켓으로 정리하는 local-first PWA입니다. 가입 없이 한 기기의 활성 플랜 하나를 편집하고, PNG 또는 30일짜리 unlisted 링크로 전달하며, 받은 사람은 명시적으로 자기 기기에 가져옵니다.

현재 저장소는 합성 `TEST DATA`를 사용하는 `fixture` 프로필과 권리·인프라 preflight를 통과해야 하는 `release` 프로필을 분리합니다. 실제 곡 카탈로그의 사용 권리, 운영 Supabase/Turnstile 키, 공개 도메인, 법무 승인, 실기기 검증이 없으므로 공개 배포 승인은 `BLOCKED_EXTERNAL`입니다. 최종 자동검증 결과와 가장 높은 확인된 build capability는 [VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md), 운영 인계는 [HANDOFF.md](./HANDOFF.md)를 따릅니다.

## 빠른 시작

저장소 runtime은 [.nvmrc](./.nvmrc)와 package engine 모두 Node.js `24.18.0`으로 정확히 고정합니다. pnpm도 `11.9.0`으로 고정합니다.

```powershell
pnpm run install:frozen
Copy-Item .env.example .env.local
pnpm dev:demo
```

`http://localhost:3000`을 엽니다. 기본 `APP_PROFILE=fixture`는 실제 곡이나 실제 TJ/KY 번호가 아닌 결정적 합성 데이터만 제공하며 UI에 `TEST DATA`를 표시합니다. 로컬 fixture 공유 저장소는 서버 프로세스를 다시 시작하면 비워집니다. 개인 플랜과 발급 티켓은 브라우저 IndexedDB에 남습니다.

## 개발과 검증

```powershell
pnpm lint
pnpm typecheck
pnpm audit --audit-level=low
pnpm test
pnpm test:contract
pnpm test:e2e
pnpm build:demo
pnpm start
```

빌드된 production-mode service worker와 offline shell은 개발 서버 E2E와 분리해 실행합니다.

```powershell
pnpm icons
pnpm build:demo
pnpm test:pwa
```

`public/icons/icon.svg`를 바꿨다면 build 전에 `pnpm icons`로 180/192/512px 파생본과 기존 호환 alias를 함께 재생성합니다.

fixture의 frozen install, format·lint·type·unit/integration/static, build, built-PWA artifact, HTTP smoke, E2E와 offline/update PWA 검증 묶음은 `pnpm verify:demo`입니다. E2E는 Playwright 브라우저 설치가 필요합니다.

```powershell
pnpm exec playwright install chromium
pnpm test:e2e
pnpm perf:lab
```

테스트 범위와 판정 규칙은 [TEST_PLAN_V3.md](./docs/verification/TEST_PLAN_V3.md), 실행 매트릭스는 [QA_MATRIX_V3.md](./docs/verification/QA_MATRIX_V3.md)에 있습니다. 실패한 검사는 무시하거나 assertion을 약화하지 말고 원인을 수정한 뒤 같은 명령과 영향받는 회귀 검사를 다시 실행합니다.

## 확인된 로컬 fixture 후보

Node `24.18.0`/pnpm `11.9.0`과 Next.js `16.2.11` 기준으로 최신 Station 리뉴얼 트리는 format/lint/type, 39파일 194테스트, public-origin fixture production build와 공개 Chromium 전체 20 discovered 중 13 pass·7 intentional project-gated skip을 통과했다. 리뉴얼 전 byte-exact 233-path clean snapshot은 37파일 185테스트와 coverage threshold, build/PWA/smoke를 통과했다. 두 시점의 증거를 섞어 과장하지 않으며 정확한 수치·환경 재시도·남은 gate는 [VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md)를 따른다.

초기 Next 16.1.7 graph의 production audit에서 15건(High 8건)을 발견해 Next/ESLint config를 stable 16.2.11로 올리고 `next>postcss`를 8.5.20으로 고정했다. 최종 prod+dev 전체 `pnpm audit --audit-level=low`는 known vulnerability 0으로 통과했다. `pnpm-workspace.yaml`은 build allowlist와 신규 patch용 exact release-age 예외만 소유하며 설치는 항상 frozen lock을 사용한다.

이 결과는 합성 catalog와 process-local share를 쓰는 로컬 fixture production artifact의 검증된 release candidate라는 뜻이다. 실제 catalog 권리, release credential, Supabase/Turnstile/domain/실기기/사용자·법무·운영 증거가 없으므로 실제 `build:release`, production 배포와 공개 출시는 여전히 `BLOCKED_EXTERNAL`이다.

## 스마트폰 영구 preview (Vercel)

사라지지 않는 공개 URL로 배포해 핸드폰에서 확인하고 홈 화면에 설치하려면
[DEPLOY_VERCEL.md](./docs/DEPLOY_VERCEL.md)의 일회성 절차를 따른다. 저장소 루트의
[`vercel.json`](./vercel.json)이 fixture 데모 프로필의 install/build 명령을 고정하므로,
Vercel에 저장소를 Import하고 Deploy만 누르면 된다.

## 스마트폰 임시 preview

[`https://interactions-suffered-participate-empire.trycloudflare.com`](https://interactions-suffered-participate-empire.trycloudflare.com)은 2026-07-23 `main`의 Station 빌드를 전용 `127.0.0.1:34173` 포트로 분리해 재게시한 주소다. fixture app PID 43664와 Quick Tunnel PID 43376이 연결되어 있다. 현재 헤더와 설치 아이콘은 **Folded Session S**이며, manifest는 `folded-session-s-192.png`/`512.png`, Apple metadata는 `folded-session-s-180.png`, service worker는 `singsong-static-v2`를 사용한다. 새 아이콘·manifest·service worker는 공개 origin에서 모두 200이고 Chromium PWA 3/3이 통과했다. 이전 `bond-athletics-calculations-putting` 주소는 싱송 종료 뒤 공용 3000번 포트를 다른 앱이 점유해 오노출된 것을 확인하고 즉시 폐기했다. 현재 판정은 `ACTIVE_PREVIEW/READY`이며 stable hosting 또는 production 배포는 아니다.

- Android Chrome: **더보기 → 홈 화면에 추가 → 설치**.
- iPhone Safari: **더보기/공유 → 홈 화면에 추가 → ‘웹 앱으로 열기’ 활성화 → 추가**.

Android에서 이전 아이콘이 열린 설치 창에 남아 있으면 그 창을 취소하고 Chrome 탭을 완전히 닫은 뒤 [`/?v=folded-session-s`](https://interactions-suffered-participate-empire.trycloudflare.com/?v=folded-session-s)를 다시 열어 설치한다. 사이트 데이터 삭제는 origin-local Dexie 플랜까지 지울 수 있으므로 캐시 해결 절차로 안내하지 않는다.

Quick Tunnel 또는 PC가 꺼지면 설치 아이콘도 열리지 않을 수 있다. stable hostname으로 이동하면 브라우저 storage origin이 달라지므로 이 임시 origin의 IndexedDB 플랜이 자동 이전된다고 주장하지 않는다. 현재 process·검증 상태는 [RUN_STATE.md](./RUN_STATE.md)를 확인한다.

## 프로덕션 구성

1. 권리 검토를 통과한 catalog provider를 연결하고 [CATALOG_RIGHTS.md](./docs/catalog/CATALOG_RIGHTS.md)의 승인 증거를 채웁니다.
2. 새 Supabase 프로젝트에 [20260722010000_share_snapshot_v1.sql](./supabase/migrations/20260722010000_share_snapshot_v1.sql)을 적용합니다. `anon`, `authenticated`, `service_role`의 private table 직접 권한이 0이고 `service_role`에는 allowlist RPC 6개만 실행 가능한지 [SQL_PRIVILEGE_CHECKLIST.md](./docs/catalog/SQL_PRIVILEGE_CHECKLIST.md)로 확인합니다.
3. `.env.example`을 기준으로 배포 플랫폼의 secret manager에 production 값을 입력합니다. `SUPABASE_SECRET_KEY`는 `sb_secret_` 형식의 server-only 키여야 하며 어떠한 비밀도 `NEXT_PUBLIC_`에 넣지 않습니다.
4. Cloudflare Turnstile의 production site/secret key와 허용 hostname을 구성합니다.
5. `APP_PROFILE=release`로 preflight와 빌드를 실행합니다. 필수 환경변수, 권리 manifest hash/capability 또는 production control이 하나라도 없으면 빌드가 의도적으로 실패합니다.
6. 배포 startup에서도 같은 순수 환경 계약과 현재·과거 share HMAC key version readiness가 통과하는지 확인합니다. build가 성공했더라도 runtime secret이 빠지거나 DB row가 요구하는 과거 key가 없으면 traffic을 받기 전에 실패해야 합니다.

```powershell
pnpm build:release
pnpm start
```

모든 release 자격 증명과 권리 manifest를 갖춘 승인 환경에서는 배포한 HTTPS preview origin을 `RELEASE_BASE_URL`에 설정한 뒤 `pnpm verify:release`를 실행합니다. 이 명령은 frozen install부터 preflight, 정적·테스트, release artifact의 fixture 표식 차단, PWA artifact, production smoke와 release-profile PWA까지 묶어 실행하며 `test:pwa:release`도 같은 URL을 사용합니다. 자격 증명 없는 로컬 환경에서는 이 명령이 `BLOCK_EXTERNAL`로 실패하는 것이 정상입니다.

필수 환경변수 이름은 `scripts/release-env-contract.mjs` 하나가 build preflight와 runtime 검증에 함께 제공한다. `src/instrumentation.ts`가 Node runtime에서 `src/server/runtime-release-environment.ts`와 `share-key-readiness.ts`를 호출하며, 순수 URL·문자열·키 강도 검증을 먼저 하고 Supabase의 required-key RPC를 다음에 실행한다. 이 startup 계약은 secret 값을 출력하지 않는다.

배포 플랫폼의 install 명령은 `pnpm install --frozen-lockfile`, build 명령은 `pnpm build:release`, start 명령은 `pnpm start`로 고정합니다. `build:production`은 기존 운영 호환 alias일 뿐 신규 배포 문서에서는 사용하지 않습니다. 공개 배포 전에는 production URL에서 no-store/noindex 헤더, 철회 직후 HTML/API/OG 비가용성, 서비스워커의 share/API 비캐시, Turnstile, rate limit, scheduler, backup/restore를 다시 검증해야 합니다.

## 롤백

- 애플리케이션 문제는 직전 검증된 immutable 배포 artifact로 되돌리고 현재 배포를 트래픽에서 제외합니다.
- 공유 생성 장애는 `/api/shares` 생성 경로를 차단하되 기존 exact read/revoke와 30일 만료 처리를 유지합니다.
- slug HMAC 키는 그 버전으로 생성된 마지막 공유가 사라진 뒤 최소 45일 동안 보존합니다. 롤백 중 키 버전을 재사용하거나 삭제하지 않습니다.
- DB migration은 데이터를 자동으로 파괴하는 down migration을 제공하지 않습니다. migration 파일 끝의 역순 제거 절차는 백업과 영향 검토 뒤 운영자 승인으로만 수행합니다.
- 비밀 유출이 의심되면 키를 회전하고 legacy 키를 프로젝트 수준에서 disable한 뒤, raw 값을 로그나 이슈에 붙이지 않습니다.

## 프로젝트 지도

- `src/domain`: 계산, 정규화, canonical snapshot, 공유 validation의 순수 계약
- `src/data`: Dexie 단일 활성 플랜·티켓·import 트랜잭션
- `src/features`: 검색, 계획, 티켓, 공유, 가져오기 수직 슬라이스
- `src/components`와 `src/features/plan`: compact app header, 플랜·검색 2-item nav, continuous Working Strip, BottomSlot/ActionDock/PlanRail, PWA install affordance
- `src/app`: Next App Router 화면, BFF API, manifest, service worker
- `src/instrumentation*`, `src/server/runtime-release-environment.ts`: release startup fail-closed와 share-key readiness
- `scripts/release-env-contract.*`: build/runtime이 공유하는 value-free 필수 env 이름 계약
- `supabase/migrations`: production 공유 저장소와 function-only ACL
- `tests`: unit, integration, static security, Playwright E2E
- `docs/catalog`: 권리·ingestion·provenance·takedown·SQL 운영 문서
- [ARCHITECTURE.md](./ARCHITECTURE.md): 현재 코드에서 재확인한 출시 구조와 기술 결정
- [ARCHITECTURE_V3.md](./docs/engineering/ARCHITECTURE_V3.md): 구현 중 작성된 v3 구조 기록; 현재 상태와 다르면 루트 아키텍처가 사실 교정을 소유
- [REQUIREMENTS_TRACE.md](./REQUIREMENTS_TRACE.md): 자료 → 요구사항 → 구현 → 테스트 판정
- [GIT_HISTORY_AUDIT.md](./GIT_HISTORY_AUDIT.md): 전체 refs와 도달/미도달 Git 감사
- [MATERIAL_INVENTORY.md](./MATERIAL_INVENTORY.md): 변경 전 65개 자료 전수 인벤토리
- [FINAL_MATERIAL_AUDIT.md](./FINAL_MATERIAL_AUDIT.md): 초기 자료 보존 재검사와 최종 non-generated 경로 전수 목록
- [MOBILE_APP_SHELL_PLAN.md](./MOBILE_APP_SHELL_PLAN.md): CUTLINE app-shell drift 복구 계약과 완료 evidence
- [logo-imagegen-50/README.md](./docs/design/logo-imagegen-50/README.md): 최종 후보 8안, 현재 적용한 Folded Session S와 production asset 경로

## 데이터·개인정보 경계

플랜, 직접 추가 곡, 티켓과 가져온 slug는 기기 로컬입니다. 공유 payload에는 곡 제목·가수·노래방 번호·순서와 계산 입력/범위만 들어가며 사용자/기기 ID, 검색어, memo, key, tag, history는 없습니다. 공유 URL은 인증이 아니라 capability이므로 주소를 아는 사람은 만료 전까지 읽을 수 있습니다. `/s/*`와 `/import`는 noindex/no-referrer이며 검색·공유 API는 no-store입니다.

공유 receipt와 raw idempotency/revoke capability는 `localStorage`가 아니라 Dexie v4의 분리된 `managedShares`/`managedShareSecrets` 테이블에 저장됩니다. 서비스워커 update는 active-plan revision이 안정된 뒤 사용자가 승인해야 적용되며, kill switch는 SingSong worker/cache만 제거합니다.

프로덕션 공개 전 필요한 사람 작업과 제한은 [HANDOFF.md](./HANDOFF.md)에 정리되어 있습니다. 문서·테스트 파일의 존재를 실제 실행 PASS로 오해하지 말고 [VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md)의 최종 명령 결과를 확인합니다.
