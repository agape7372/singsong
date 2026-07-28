# SingSong Session Strip

SingSong은 2~4명이 노래방에 가기 전에 부를 곡의 순서, 예상 시간, 가격표 기준 비용을
한 장의 티켓으로 정리하는 local-first 앱입니다. 주 제품은 Expo Android/iOS 앱이고,
`services/share-api`가 30일짜리 unlisted 링크와 읽기 전용 `/s/:slug` 랜딩을 담당합니다.
기존 Next/PWA 트리는 새 랜딩 배포·딥링크·내부 APK·실기기 증거가 닫힐 때까지
롤백 기준으로만 보존하며 신규 제품 표면으로 개발하지 않습니다.

현재 저장소는 합성 `TEST DATA` fixture와 권리·인프라 preflight를 통과해야 하는 release를
분리합니다. 실제 카탈로그 권리, 운영 Supabase/Redis, 공개 HTTPS origin, 앱 서명,
실기기 검증이 없으므로 공개 배포 승인은 `BLOCKED_EXTERNAL`입니다. 전환 범위와 남은 외부
게이트는 [네이티브 패리티 원장](./docs/PARITY_LEDGER.md), 실행 결과는
[VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md), 운영 인계는 [HANDOFF.md](./HANDOFF.md)를
따릅니다.

## 빠른 시작

현재 모노레포는 [.nvmrc](./.nvmrc)의 Node.js 24와 npm lockfile을 사용합니다.
루트와 `apps/app`은 잠금파일을 따로 소유하므로 각각 `npm ci`를 실행합니다.

네이티브 앱:

```powershell
Set-Location apps/app
npm.cmd ci --ignore-scripts
npm.cmd run lint
npm.cmd run typecheck
npx.cmd expo start
```

공유 API fixture:

```powershell
npm.cmd ci
npm.cmd run share-api:verify
npm.cmd run share-api:preflight # 운영 자격 증명이 없으면 의도적으로 실패
```

아래 명령은 보존된 Next/PWA 롤백 기준선 검증용입니다.

```powershell
Copy-Item .env.example .env.local
npm.cmd run build:demo
npm.cmd run test:pwa
```

`http://localhost:3000`을 엽니다. 기본 `APP_PROFILE=fixture`는 실제 곡이나 실제 TJ/KY 번호가 아닌 결정적 합성 데이터만 제공하며 UI에 `TEST DATA`를 표시합니다. 로컬 fixture 공유 저장소는 서버 프로세스를 다시 시작하면 비워집니다. 개인 플랜과 발급 티켓은 브라우저 IndexedDB에 남습니다.

## 개발과 검증

```powershell
npm.cmd run check:monorepo
npm.cmd run check:monorepo:test
npm.cmd run check:tokens
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npx.cmd vitest run --coverage
npm.cmd run gate:m1
npm.cmd run share-api:verify
npm.cmd run test:share-landing
```

네이티브 앱은 격리된 설치에서 별도로 검증합니다.

```powershell
Set-Location apps/app
npm.cmd ci --ignore-scripts
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npx.cmd expo-doctor
npx.cmd expo install --check
npx.cmd expo export --platform android --output-dir dist/android --clear
```

테스트 범위와 판정 규칙은 [TEST_PLAN_V3.md](./docs/verification/TEST_PLAN_V3.md), 실행 매트릭스는 [QA_MATRIX_V3.md](./docs/verification/QA_MATRIX_V3.md)에 있습니다. 실패한 검사는 무시하거나 assertion을 약화하지 말고 원인을 수정한 뒤 같은 명령과 영향받는 회귀 검사를 다시 실행합니다.

## 확인된 네이티브 저장소 후보

Node `v24.11.1`/npm `11.6.2`에서 루트 64파일/504테스트와 커버리지
83.53/76.02/84.11/85.69%, 앱 15개 계약 테스트, 공유 API 144개 테스트와 fixture smoke,
브라우저 랜딩 3/3(axe 포함), Android Hermes export를 통과했다. Expo doctor는 20/20,
install check는 최신 상태였다. 보존된 Next 16.2.11 롤백 빌드도 패치된 PostCSS/Sharp로
성공했다.

앱 전체 감사와 루트 운영 의존성 감사(`npm audit --omit=dev`)는 취약점 0건이다. 전체 루트
감사에는 보존된 ESLint/minimatch 3 개발 체인의 `brace-expansion` high 9건이 남는다.
`brace-expansion` 5를 강제하면 CommonJS 호출 계약이 깨지므로 억지 override를 사용하지 않는다.
upstream 도구 체인 교체 전까지 운영 게이트와 개발 도구 위험을 분리해 추적한다.

이 결과는 합성 catalog와 메모리 공유 저장소를 쓰는 저장소 후보라는 뜻이다. 실제 catalog 권리,
release credential, Supabase/Redis/도메인/실기기/사용자·법무·운영 증거가 없으므로 production
서비스, EAS APK와 공개 출시는 여전히 `BLOCKED_EXTERNAL`이다.

## 보존된 PWA 임시 preview 기록

[`https://interactions-suffered-participate-empire.trycloudflare.com`](https://interactions-suffered-participate-empire.trycloudflare.com)은
2026-07-23 Next/PWA 검수 때 사용한 Quick Tunnel 기록이다. PID와 생존 여부를 현재 네이티브
배포 증거로 사용하지 않는다. 새 공유 서비스의 stable HTTPS origin은 아직 배포되지 않았다.

- Android Chrome: **더보기 → 홈 화면에 추가 → 설치**.
- iPhone Safari: **더보기/공유 → 홈 화면에 추가 → ‘웹 앱으로 열기’ 활성화 → 추가**.

Android에서 이전 아이콘이 열린 설치 창에 남아 있으면 그 창을 취소하고 Chrome 탭을 완전히 닫은 뒤 [`/?v=folded-session-s`](https://interactions-suffered-participate-empire.trycloudflare.com/?v=folded-session-s)를 다시 열어 설치한다. 사이트 데이터 삭제는 origin-local Dexie 플랜까지 지울 수 있으므로 캐시 해결 절차로 안내하지 않는다.

Quick Tunnel 또는 PC가 꺼지면 열리지 않을 수 있다. stable hostname으로 이동하면 브라우저
storage origin도 달라지므로 이 임시 origin의 IndexedDB 플랜이 자동 이전된다고 주장하지 않는다.
현재 상태는 [RUN_STATE.md](./RUN_STATE.md)를 확인한다.

## 프로덕션 구성

1. 권리 검토를 통과한 catalog provider를 연결하고 [CATALOG_RIGHTS.md](./docs/catalog/CATALOG_RIGHTS.md)의 승인 증거를 채웁니다.
2. 새 Supabase 프로젝트에 [20260722010000_share_snapshot_v1.sql](./supabase/migrations/20260722010000_share_snapshot_v1.sql)을 적용합니다. `anon`, `authenticated`, `service_role`의 private table 직접 권한이 0이고 `service_role`에는 allowlist RPC 6개만 실행 가능한지 [SQL_PRIVILEGE_CHECKLIST.md](./docs/catalog/SQL_PRIVILEGE_CHECKLIST.md)로 확인합니다.
3. `services/share-api/.env.example`의 Supabase, slug HMAC, Redis/IP HMAC, catalog
   비밀을 secret manager에 구성합니다. `SUPABASE_SECRET_KEY`는 `sb_secret_` 형식이어야
   하며 어떠한 비밀도 public 환경변수에 넣지 않습니다.
4. `APP_PROFILE=production`, stable `SITE_ORIGIN`, `VERCEL=1`, Android release
   fingerprint와 Apple app ID를 배포 환경에 구성합니다.
5. `npm run share-api:preflight`를 통과한 동일 artifact를 stable HTTPS origin에 배포하고
   well-known JSON, CSP/no-store/noindex, OG crawler와 revoke 404를 확인합니다.
6. 그 origin을 `EXPO_PUBLIC_SHARE_API_ORIGIN`으로 설정해 clean commit에서 EAS production
   APK를 만들고 [실기기 체크리스트](./docs/verification/NATIVE_DEVICE_CHECKLIST.md)를 서명합니다.

```powershell
npm.cmd run share-api:preflight
Set-Location apps/app
$env:EXPO_PUBLIC_SHARE_API_ORIGIN = "https://share.example.com"
npx.cmd eas build --platform android --profile production
```

자격 증명 없는 로컬 환경에서는 두 production preflight가 `BLOCKED_EXTERNAL`로 exit 1인 것이
정상이다. EAS는 `requireCommit: true`이므로 검증되지 않은 dirty tree에서 production build를
우회하지 않는다.

## 롤백

- 애플리케이션 문제는 직전 검증된 immutable 배포 artifact로 되돌리고 현재 배포를 트래픽에서 제외합니다.
- 공유 생성 장애는 `/api/shares` 생성 경로를 차단하되 기존 exact read/revoke와 30일 만료 처리를 유지합니다.
- slug HMAC 키는 그 버전으로 생성된 마지막 공유가 사라진 뒤 최소 45일 동안 보존합니다. 롤백 중 키 버전을 재사용하거나 삭제하지 않습니다.
- DB migration은 데이터를 자동으로 파괴하는 down migration을 제공하지 않습니다. migration 파일 끝의 역순 제거 절차는 백업과 영향 검토 뒤 운영자 승인으로만 수행합니다.
- 비밀 유출이 의심되면 키를 회전하고 legacy 키를 프로젝트 수준에서 disable한 뒤, raw 값을 로그나 이슈에 붙이지 않습니다.

## 프로젝트 지도

- `apps/app`: Expo Router 화면, SQLite 어댑터, Skia 티켓/PNG, 딥링크와 OS 기능
- `services/share-api`: 검색·공유 CRUD·랜딩·OG·association·preflight
- `packages/domain`, `packages/store`, `packages/ticket-art`, `packages/tokens`: 플랫폼 독립 정본
- `e2e/landing`: 실제 fixture API를 통과하는 script-free 랜딩/axe/폐기 브라우저 계약
- `src`: 배포 전환이 끝날 때까지 보존하는 Next/PWA 롤백 기준선
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
