# SingSong Native App Completion Plan

> 실행 기준: `C:\Users\agape\.claude\plans\singsong-mossy-metcalfe.md`
> 최근 사실 교정: `.claude/handoffs/2026-07-27-142553-singsong-m1-p3-complete.md`
> 시작점: `rebuild/expo-monorepo`의 M1 완료 + Reanimated/Skia 선행 스모크

## 목표

기존 Next/PWA 플래너를 Expo 네이티브 앱과 공유 링크 랜딩 서비스로 전환한다. 외부 계정,
실기기 또는 운영 자격 증명이 필요한 검증은 저장소 게이트와 분리해
`BLOCKED_EXTERNAL`로 기록하고, 저장소가 소유하는 구현과 자동 검증은 모두 닫는다.

## 실행 순서

### 1. M2 — 네이티브 셸과 플랜 편집

- `apps/app`에서 `@singsong/*` 패키지를 해석하는 Metro/TypeScript 경계를 확정한다.
- expo-sqlite `SqlExecutor`와 네이티브 도메인 포트를 연결한다.
- 루트 provider, 4탭, 공용 프리미티브, 활성 플랜 외부 스토어를 구현한다.
- 단일 FlatList 플랜, 추가/직접 입력, 재정렬, 삭제/되돌리기, 계산/가격 폼을 구현한다.
- 타입·lint·스토어 계약·Expo doctor와 Android 수동 체크리스트를 게이트로 둔다.

### 2. M3 — 티켓과 PNG

- `packages/ticket-art` 씬을 Skia 화면/내보내기 경로에 연결한다.
- 발권 revision 탐색, 앞/뒤 플립, 모션 축소 설정, 접근성 오버레이를 구현한다.
- 1080×1350 PNG 생성, 갤러리 저장, OS 공유 시트를 구현한다.
- 헤드리스 기하/문자 집합/내보내기 계약과 기기 시각 체크리스트를 추가한다.

### 3. M4 — 공유 API와 링크 발권

- `services/share-api`에 검색·생성·조회·취소·`/s/:slug` 랜딩을 구축한다.
- 기존 Supabase 저장소/환경/보안 계약을 프레임워크 독립 모듈로 이동한다.
- 절대 OG URL, CSP, OPTIONS, 네이티브 클라이언트 위생 헤더, 서버리스 레이트 제한을 검증한다.
- credential 없는 preflight 실패와 fixture smoke를 자동화한다.

### 4. M5 — 딥링크와 나머지 탭

- `singsong://s/:slug` 및 HTTPS 링크 정규화, 미리보기, 가져오기/교체/되돌리기를 구현한다.
- 보관함, 발견, 설정, 프로필 사진, 업데이트, 전체 로컬 데이터 삭제를 구현한다.
- 딥링크 검증 파일과 수신 흐름 계약 테스트를 추가한다.

### 5. M6/M7 — 릴리스 경화와 내부 배포 준비

- 앱/서비스/패키지 전체를 루트 워크스페이스와 CI 게이트에 편입한다.
- 네이티브 전환 패리티 원장과 검증 보고서를 현재 결과로 갱신한다.
- Next/PWA 참조 트리는 미해결 원장 0건과 랜딩 대체 검증 후에만 제거한다.
- EAS production APK 생성은 계정·네트워크·실기기 게이트가 열릴 때 수행하고 결과를 기록한다.

## 완료 판정

- 저장소 소유 게이트: format, lint, typecheck, unit/integration, monorepo guard,
  Expo doctor/install check, Metro export, share-api build/smoke가 모두 PASS.
- 네이티브 핵심 흐름: 곡 추가 → 재정렬 → 삭제/되돌리기 → 계산 → 발권 →
  PNG 저장/공유 → 링크 생성 → 딥링크 가져오기가 코드와 테스트로 연결됨.
- 외부 전용 항목은 담당자와 해제 조건이 있는 `BLOCKED_EXTERNAL`로 남고,
  구현 누락을 외부 blocker로 위장하지 않음.

## 2026-07-28 실행 결과

- 저장소 소유 구현은 `NATIVE_REPOSITORY_READY`로 닫았다. 루트 64파일/504테스트와
  커버리지 임계, 앱 15개 계약 테스트, 공유 API 144개 테스트, 브라우저 랜딩 3개 시나리오가
  모두 통과했다.
- Android Hermes 번들, Expo doctor 20/20, Expo install 정합, Next 롤백 빌드와
  fixture 공유 smoke를 확인했다.
- 앱/운영 의존성 감사는 취약점 0건이다. 전체 루트 감사에는 보존된 ESLint 도구 체인의
  `brace-expansion` high 9건이 개발 의존성으로 남는다. 호환되지 않는 강제 override 대신
  upstream 교체 전까지 운영 감사와 분리한다.
- production preflight는 자격 증명·권리 manifest·공개 origin·앱 서명이 없을 때
  의도대로 `BLOCKED_EXTERNAL`로 실패한다. EAS APK, 운영 서비스 배포, 실기기/카카오/OTA
  증거와 레거시 트리 삭제는 수행하지 않았다.
