# 네이티브 전환 패리티 원장

기준일: 2026-07-28
정본 계획: `C:\Users\agape\.claude\plans\singsong-mossy-metcalfe.md`

이 원장은 기존 Next/PWA 기능을 Expo 앱과 `services/share-api`로 옮긴 결과를 기록한다.
`PASS`는 저장소가 소유하는 구현과 자동 검증이 닫혔다는 뜻이며, 실기기·운영 계정·권리처럼
저장소 밖의 권한이 필요한 항목은 담당자와 해제 증거를 붙여 `BLOCKED_EXTERNAL`로 남긴다.
의도적으로 네이티브 제품에서 제거한 PWA 기능은 `명문 폐기`다. `NOT_RUN` 행은 없다.

## 제품·데이터 흐름

| 계약 | 네이티브 소유 경로 | 판정 | 근거 또는 해제 조건 |
| --- | --- | --- | --- |
| 단일 활성 플랜, revision CAS, 0–100곡 | `packages/store`, `apps/app/src/store` | `PASS` | node:sqlite 계약 + Expo SQLite 어댑터 + 앱 typecheck/export |
| 곡 추가·직접 입력·중복 방지 | `features/search` | `PASS` | 36곡 허구 fixture, 커밋 시점 중복 재검사 |
| 재정렬·삭제·되돌리기 | `features/plan` | `PASS` | 단일 `FlatList`, 노출 버튼, 접근성 조절 동작, 직렬 mutation queue |
| 인원·곡/시간 가격·묶음 가격·예산 | `features/plan/calculation-panel.tsx` | `PASS` | 순수 domain 계산기를 그대로 사용 |
| 권리 승인 실제 카탈로그 | `services/share-api/src/catalog.ts` seam | `BLOCKED_EXTERNAL` | 담당: product/legal/data provider. 서명된 권리·출처·품질 corpus 필요 |
| 로컬 프로필·사진 | `features/settings`, SQLite + document file | `PASS` | 사진 리사이즈, 로컬 URI, 정본 6색, 공유 payload 제외 |
| 전체 로컬 데이터 삭제 | `features/settings`, `packages/store` | `PASS` | 전 테이블 삭제 뒤 revision 0 재수화 + 프로필 사진 삭제 |

## 티켓·공유·수신

| 계약 | 네이티브/서비스 소유 경로 | 판정 | 근거 또는 해제 조건 |
| --- | --- | --- | --- |
| revision 동결 티켓 발권·재사용 | `features/ticket/ticket-repository.ts` | `PASS` | fingerprint/CAS 저장과 보관 revision route |
| 화면·PNG·랜딩 공통 티켓 scene | `packages/ticket-art`, Skia/SVG renderer | `PASS` | 한 display list를 앱 화면·1080×1350 PNG·서버 SVG가 해석, 중복 JSON 0 |
| 약 시간·총액·1인당·TEST DATA 표기 | `packages/ticket-art/src/scene.ts` | `PASS` | 화면/1080×1350 export가 같은 display list 사용 |
| 1080×1350 PNG·갤러리·OS 공유 코드 | `render/skia/export-ticket.ts`, `ticket-screen.tsx` | `PASS` | Hermes Android export 및 크기/PNG 서명 방어 |
| PNG 실제 저장·공유·시각 룩 | 네이티브 바이너리/사진 앱 | `BLOCKED_EXTERNAL` | 담당: product+QA. Android/iOS 실기기에서 PWA 기준 이미지와 나란히 승인 |
| 공유 생성·조회·폐기·30일 만료 | `services/share-api`, `lib/share-client.ts` | `PASS` | fixture 계약 테스트와 HTTP smoke; 로컬 capability 분리 저장 |
| 공유 중/완료 보관함 | `features/library` | `PASS` | 세그먼트, `snapToInterval`, Reanimated 중심 보간, 복사·폐기 |
| 읽기 전용 `/s/:slug`와 절대 OG meta | `services/share-api` landing + shared SVG | `PASS` | script-free HTML, CSP/noindex/no-referrer, Playwright/axe 3개 시나리오, unknown/revoked 404 |
| Supabase migration·실제 ACL/RPC·TTL | `supabase`, service repository | `BLOCKED_EXTERNAL` | 담당: infrastructure owner. 운영 project migration·직접 grant 0·RPC 6개 증거 |
| 분산 rate limit·IP HMAC·proxy 파싱 | `services/share-api/src/rate-limit.ts` | `PASS` | fail-closed Redis adapter, 신뢰 Vercel 헤더, 위조 XFF·zone IPv6·timeout/shape 계약 테스트 |
| 실제 Redis·production proxy IP 헤더 | 운영 배포 | `BLOCKED_EXTERNAL` | 담당: security/release owner. 첫 배포 수신 헤더 1회 실측과 위조 XFF 음성 증거 |
| 카카오톡 OG 프리뷰 | 운영 HTTPS origin | `BLOCKED_EXTERNAL` | 담당: release QA. 실제 도메인 배포 후 crawler preview 캡처 |
| custom/HTTPS 딥링크 정규화 | `+native-intent.ts`, `app.config.js` | `PASS` | domain 정본 slug validator, `/import` 단일 진입점 |
| assetlinks/AASA 실제 검증 | service well-known + 앱 인증서 | `BLOCKED_EXTERNAL` | 담당: release owner. production 인증서 fingerprint·Apple team ID·content-type 확인 |
| 미리보기→명시적 가져오기→교체→되돌리기 | `features/import` | `PASS` | 가져오기 전 무변이, duplicate guard, CAS undo |
| 폰 A→메신저→폰 B cold start | 두 실기기 | `BLOCKED_EXTERNAL` | 담당: QA. Android/iOS/Kakao 실제 수신 체크리스트 서명 |

## 셸·접근성·릴리스

| 계약 | 소유 경로 | 판정 | 근거 또는 해제 조건 |
| --- | --- | --- | --- |
| 플랜·보관함·발견·설정 4탭 | Expo Router tabs | `PASS` | Skia path 아이콘, safe-area 포함 탭 높이 |
| 큰 글자 탭 라벨 회피 | `lib/tab-bar-metrics.ts` | `PASS` | 반응형 순수 함수와 1.6배 라벨 전환 |
| 다크모드·공용 토큰 | `packages/tokens`, `theme` | `PASS` | 네이티브 리터럴 복사 없이 정본 토큰 사용 |
| 48dp 터치·상태 알림·reduced motion | 공용 UI/티켓 UI | `PASS` | semantic roles/actions/live region 및 모션 설정 구독 |
| TalkBack/VoiceOver·320dp·글자 2배·한국어 IME | 실기기 | `BLOCKED_EXTERNAL` | 담당: accessibility QA. `docs/verification/NATIVE_DEVICE_CHECKLIST.md` 서명 |
| Expo doctor/install 정합·Android Hermes bundle | `apps/app` | `PASS` | doctor 20/20, install check 최신, 2,220-module Android HBC export |
| production EAS 설정·OTA fingerprint | `app.config.js`, `eas.json` | `PASS` | native-only platforms, remote version, autoIncrement, production channel |
| EAS/서비스 release preflight fail-closed | 앱·공유 서비스 preflight | `PASS` | production origin 또는 필수 운영 입력이 없으면 명시적 `BLOCKED_EXTERNAL`/exit 1 |
| OTA 발행 manifest 실제 값 | Expo account/channel | `BLOCKED_EXTERNAL` | 담당: release owner. `u.expo.dev` manifest의 실제 origin/channel 확인 |
| 내부 production APK | EAS cloud | `BLOCKED_EXTERNAL` | 담당: release owner. clean commit·Expo 인증·production origin 후 APK URL과 설치 서명 |
| Next/PWA 설치·offline shell·browser Dexie | 레거시 `src/` | `명문 폐기` | 네이티브 앱이 대체한다. 운영 공유 랜딩 전환 전까지만 rollback 기준으로 보존 |
| Turnstile widget | 레거시 웹 share-create | `명문 폐기` | 네이티브에는 위젯 표면이 없다. 분산 rate bucket/행수 alert가 운영 보상 통제 |
| Next/PWA 트리 삭제 | `src`, PWA tests/config | `BLOCKED_EXTERNAL` | 담당: release owner. 새 랜딩 배포·딥링크·APK·원장 외부 행 증거 후 archive ref 확인하고 단독 삭제 |

## 외부 게이트 실행 순서

1. 운영 `services/share-api` origin과 Supabase/Redis/association 환경을 구성한다.
2. service preflight, SQL 권한 체크리스트, well-known content-type와 OG crawler를 확인한다.
3. 같은 HTTPS origin을 `EXPO_PUBLIC_SHARE_API_ORIGIN`으로 넣어 EAS production APK를 만든다.
4. [NATIVE_DEVICE_CHECKLIST.md](./verification/NATIVE_DEVICE_CHECKLIST.md)를 Android와 iOS에서
   서명하고 폰 A→폰 B handoff를 완료한다.
5. OTA manifest 실제 값을 확인한 뒤에만 Next/PWA 참조 트리를 별도 변경으로 삭제한다.
