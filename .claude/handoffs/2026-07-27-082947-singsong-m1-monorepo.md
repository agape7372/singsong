# Handoff: 싱송 네이티브 재구축 — M0 완료, M1 P2 까지

## Session Metadata

- Created: 2026-07-27 08:29:47
- Project: C:\Users\agape\Desktop\코딩\singsong
- Branch: rebuild/expo-monorepo
- Session duration: 약 20시간 (2026-07-26 오후 ~ 07-27 오전)

### Recent Commits (for context)

- c84cc6f feat(m1): packages/tokens · packages/ticket-art · 모노레포 구조 가드
- ee3fed9 feat(m1): packages/store — SqlExecutor 포트 · 초기 스키마 · 마이그레이션 러너
- 023a5ce refactor(m1): src/domain → packages/domain (순수 이동 + 별칭 shim)
- 9fde82b build: 루트를 pnpm 에서 npm 워크스페이스로 전환
- 21c8e1a fix(m0): 스파이크 린트 3건 ← **태그 `m1-baseline`**

태그: `pwa-final`(adb4d2d, PWA 최종본) · `m1-baseline`(21c8e1a, M1 롤백 기준점)
브랜치: `archive/next-pwa`(adb4d2d) · `rebuild/expo-monorepo`(작업 중)

## Handoff Chain

- **Continues from**: None (fresh start)
- **Supersedes**: None

## Current State Summary

싱송(코인노래방 세션 플래너)을 Next 16 + Dexie PWA 에서 Expo 네이티브 앱으로 재구축 중이다.
정본 계획은 `C:\Users\agape\.claude\plans\singsong-mossy-metcalfe.md`.

**M0 완료 (게이트 PASS).** `apps/app` 에 Expo SDK 57 앱이 서고, 티켓 하프톤·그레인·펀치를
Skia 로 이식해 실기기에서 확인했다. dev-client APK 는 318MB → 55MB 로 줄였다.

**M1 은 P2 까지 완료.** 루트를 pnpm → npm 워크스페이스로 전환했고 패키지 4개가 섰다
(domain·store·tokens·ticket-art). 게이트 6종 전부 green.
**남은 것은 P3** — 도메인 ports 개조와 런타임 구멍 12곳, plan-database 분해, CI 워크플로.

작업은 언제나 커밋된 상태로 끊었다. 워킹트리는 이 핸드오프 문서 외에 깨끗하다.

## Architecture Overview

목표 구조(계획 §1.1): 같은 repo 를 모노레포로 재편.

```
singsong/
├─ apps/app/          Expo SDK 57 네이티브 전용 (웹 플랫폼 미포함)
├─ packages/
│  ├─ domain/         순수 TS 도메인 (src/domain 에서 이동 완료)
│  ├─ store/          SqlExecutor 포트 + 마이그레이션 (신설 완료)
│  ├─ tokens/         globals.css 파생 토큰 (신설 완료)
│  └─ ticket-art/     티켓 디스플레이 리스트 (신설 완료)
├─ services/share-api/  M4 에서 신설 (아직 없음)
├─ src/ tests/        아직 남아 있는 Next 트리 → M6 에 reference/next-pwa/ 로
└─ tools/            모노레포 가드 · 토큰 생성기
```

런타임: Android/iOS 앱 ─ expo-updates(OTA) ─ EAS Update / Vercel(share-api) / Supabase.

## Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `C:\Users\agape\.claude\plans\singsong-mossy-metcalfe.md` | 재구축 정본 계획 | **먼저 읽어라.** 단 아래 "계획서 오류" 절의 정정을 함께 볼 것 |
| `apps/app/docs/WINDOWS_INSTALL.md` | Windows 설치가 `--ignore-scripts` 여야 하는 이유 | 앱 의존성 건드릴 때 필수 |
| `apps/app/docs/DEVICE_CHECKLIST_M0.md` | M0 게이트 결과 + 미판정 3건 | M3 에서 다시 올라옴 |
| `apps/app/tools/verify-halftone.mjs` | 하프톤 헤드리스 검증 17 어서션 | M3 골든의 기반 |
| `apps/app/src/render/skia/` | Skia 하프톤·그레인·펀치 (DI 이음매) | M3 티켓 렌더러의 씨앗 |
| `packages/store/src/sql-executor.ts` | SqlExecutor 포트 + 실측 근거 주석 | store 작업의 계약 |
| `packages/store/src/migrations/run.ts` | 마이그레이션 러너 | **`execScript` 필수 이유가 주석에** |
| `tools/check-monorepo.mjs` | 구조 가드 12종 | `verify` 체인에 걸려 있음 |
| `tools/generate-tokens.mjs` | globals.css → tokens 생성기 | 토큰은 손으로 고치지 않는다 |
| `src/data/plan-database.ts` | Dexie 원본 572줄 | **P3 분해 대상** |
| `docs/design/VISUAL_MOTION_DIRECTION.md` | 디자인 정본 | 일부 드리프트 있음(§3-1 radius) |

## Key Patterns Discovered

- **정본과 파생물을 구분한다.** 티켓 팔레트 정본은 `src/features/ticket/ticket-artwork.json`.
  `apps/app/src/render/skia/ticket-artwork.json` 은 **바이트 동일 복사본**(해시 대조함).
  `packages/tokens` 는 `globals.css` 의 **생성 파생물**이고 테스트가 재파싱해 대조한다.
  손으로 전사하지 않는 것이 이 repo 의 규칙 — 이미 드리프트를 겪었다.
- **DI 이음매.** Skia 렌더 모듈과 store 는 팩토리를 첫 인자로 받는다. 앱은 실물을,
  헤드리스 검증은 CanvasKit / node:sqlite 를 꽂아 **같은 코드**를 돌린다.
- **커밋 메시지에 근거를 남긴다.** 실측 수치와 반증 과정을 본문에 적는다. 이 프로젝트는
  계획서보다 커밋 로그가 정확하다.
- 코드 주석은 한국어, WHY 중심, 비자명한 주장엔 file:line 인용.

## Tasks Finished

- [x] M0-1 안전망 — `pwa-final` 태그, `archive/next-pwa`, `rebuild/expo-monorepo`, 기준선 429 파일
- [x] M0-2 정적 브랜드 OG PNG (`public/og/ticket-1200x630.png`) + 기하 버그 2건 수정
- [x] M0-3 Expo SDK 57 스캐폴드, 4탭, expo-doctor 20/20
- [x] M0-5 Skia 하프톤·그레인·펀치 + 헤드리스 검증 17 어서션 (Blink 대조)
- [x] M0-4 EAS dev-client 빌드 (318MB → 109MB → 55MB)
- [x] M0 게이트 실기기 판정 PASS
- [x] M1 P0 기반 — 클린 트리, `m1-baseline` 태그
- [x] M1 P1 pnpm → npm 워크스페이스 전환
- [x] M1 트랙 B — `packages/domain` 이동(R100 ×7) + 별칭 shim + vitest `test.projects`
- [x] M1 트랙 C — `packages/store`
- [x] M1 트랙 D — `tools/check-monorepo.mjs`, `.easignore`
- [x] M1 `packages/tokens`, `packages/ticket-art`

## Files Modified

커밋에 전부 반영됨. 워킹트리는 이 핸드오프 외 깨끗.

## Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| `apps/app` 을 M1 워크스페이스에 **넣지 않음** | 지금 편입 / M2 로 연기 | react 19.2.7(루트) vs 19.2.3(앱) 충돌로 Metro 가 React 2벌을 봄. Skia postinstall 이 Windows 에서 죽음. 호이스팅 중 디스크 피크 3.1GB. M1 게이트는 React 없는 Node 스크립트라 불필요 |
| 루트 TypeScript 5.9.3 유지 | 6.0.3 통일 | TS 6.0.3 은 자동 `@types` 포함을 제거(실측: `TS2591 Cannot find name 'process'`). repo 전역 타입체크가 깨질 수 있고 M1 이동 작업과 동시에 하면 원인 분리 불가 |
| ABI arm64-v8a 만 | 4 ABI 유지 / arm64 만 | Skia 정적 라이브러리가 ABI 당 48~61MB. 실기기는 전부 arm64, x86 은 에뮬레이터 전용인데 이 PC 엔 Android SDK 가 없음 |
| APK 내부 압축 켬 | AAB 대비 무의미 / 켬 | 배포가 "링크로 APK 직접 설치" 라 압축 = 사용자가 내는 데이터. Play(AAB) 가면 꺼야 함 |
| 마이그레이션은 `execScript` 전용 | `run()` / `exec()` | `prepare()` 가 멀티스테이트먼트를 첫 문장만 컴파일하고 나머지를 **throw 없이** 버림 |
| CAS 는 트랜잭션 안 SELECT 후 비교 | `ON CONFLICT … WHERE` | 행이 없으면 가드가 평가조차 안 되고 INSERT 분기를 탐 |
| `playwright-core` 1.61.1 override | 방치 / 업그레이드 | npm 이 peer 만족시키려 1.62.0 을 따로 깔아 타입 2벌 → TS2322 |
| pnpm 글로벌 store 삭제 | 보존 | 사용자 승인. 실제 회수는 0.26GB (예측 0.98GB — 논리 크기 ≠ 물리 회수) |

## Immediate Next Steps

1. **`packages/domain` 런타임 구멍 수정 + ports 도입.** 아래 "런타임 구멍" 표 참조.
   `createTicketSnapshot(plan, ports)` 로 시그니처를 바꾸고 호출자·테스트 팬아웃.
   ports = `{ randomBytes, randomId, digest, now }` — **`now` 를 빼먹지 말 것**
   (`canonical.ts:167` 이 `new Date().toISOString()` 을 직접 부르고 테스트 3곳이 결정성을 원함).
2. **Intl 포맷터 4벌 단일화.** `ticket-art.ts:293`, `ticket-card.tsx:9`, `ticket-back.tsx:3`,
   `calculation-strip.tsx:15`. 전부 **모듈 스코프 `const`** 라 throw 하면 첫 사용이 아니라
   **모듈 로드 = 화이트스크린**이다. 이게 P3 에서 제일 급하다.
3. **`src/data/plan-database.ts` (572줄) 분해 → `packages/store`.**
   `replaceActivePlan` 은 호출자 0건이므로 삭제. 519줄 동시성 테스트를 node:sqlite 로 부활.
4. CI 워크플로 신설 (`.github/` 없음).
5. M1 게이트: **React·기기 없는 Node 스크립트**로 플랜 생성 → 100곡 → 계산 → 발권 →
   canonical fingerprint 출력.

## Blockers/Open Questions

- [ ] `ProfileRecord.photo` 표현 — BLOB vs 파일 URI. 현재 스키마는 `photo_uri text` 로 뒀고
      주석에 열린 결정이라 적어 뒀다. `profile-avatar.tsx` 가 `URL.createObjectURL` 전제라
      그쪽을 어떻게 바꿀지 미검증. **M5 전 확정 필요.**
- [ ] `managed_share_secret` 에 FK 를 걸 것인가. 걸면 고아 secret 정리 경로와 그 테스트가
      **조용히 죽는다**. 제품 결정.
- [ ] `apps/app/eas.json` 의 `cli.requireCommit` — 현재 미설정(=false). 첫 production 빌드 전 결정.
- [ ] 계획서 D3 의 Skia `2.10.0` 오기를 계획서에서 고칠 것인지 (실제 `2.6.2`).

## Deferred Items

- `apps/app` 워크스페이스 편입 → M2
- TypeScript 6.0.3 통일 → M2
- 하프톤 DPR 2 기기 대응 (실효 배율 2.10배 미만이면 점이 붙음) → 필요해지면 `cellPx` 상향
- 사용자 액션: Apple Developer 계정, Play Console, 도메인 구매, Supabase 실프로젝트

## Important Context

**이 프로젝트에서 계획서는 가설이고 디스크가 정본이다.** 실제로 여러 번 틀렸다:

| 계획서 주장 | 실측 |
|---|---|
| Skia `2.10.0` | **2.6.2** — SDK 57 버전맵. 2.10.0 은 네이티브 바이너리 150.0.0 이라 dev-client 재빌드 유발 |
| Reanimated `4.5.3` | **4.5.0** / worklets **0.10.0** |
| `catalog.ts:12` `\p{}` 가 **M1 하드 블로커**, 모듈 로드 실패 | **아니다.** 앱이 싣는 `hermesc.exe`(hermes-v0.17.0)로 컴파일 exit 0 |
| `btoa` 가 Hermes 에 없음 | **있다** (`GlobalObject.cpp:765/768`) |
| `TextEncoder` 가 Hermes 확장 | **진짜 전역** (`TextEncoder.cpp:62-68`) |
| `structuredClone` 폴리필 의존 | Expo winter 가 무조건 설치. "undefined 키 소실" 도 반증됨 |
| CSS 토큰 **102개** | **56개.** 102 는 *선언* 수 (:root 46 + dark 29 + .ticket-card 10 + narrow 1 + wide 2 + forced 14) |
| 대비비 5쌍 | **전부 일치.** 이번엔 계획서가 맞았다 |

새 주장을 만나면 실행해서 확인하고, 틀렸으면 커밋 메시지에 남겨라.

## Assumptions Made

- 배포된 기기 0대 / 실사용자 0명 / 이전할 데이터 0건 — 그래서 마이그레이션 v1 단일이고
  스키마를 M2 까지 자유롭게 고쳐도 된다.
- 발행된 OTA 업데이트 0건 — 그래서 runtimeVersion 지문이 바뀌어도 무해했다.
- M0 게이트의 시각 판정을 사용자가 에이전트에 위임했다. 근거는 계측치이며
  **사람만 판단 가능한 3건은 미판정으로 남겼다**(`DEVICE_CHECKLIST_M0.md` 참조).

## Potential Gotchas

1. **Windows 에서 `apps/app` 설치는 반드시 `npm install --ignore-scripts`.**
   Skia postinstall 이 `0xC0000409` 로 죽는다 — Node `fs.cpSync` 가 `.xcframework` 복사 중
   하드 중단(nodejs#54476 계열). `.npmrc` 에는 **넣지 마라** — EAS 리눅스 워커로 올라가서
   Gradle 링크를 깬다. 커맨드라인 전용.
2. **eas-cli 는 `app.config.ts` 를 못 읽는다** (TypeScript 6 비호환,
   `Cannot read properties of undefined (reading 'CommonJS')`). 그래서 `app.config.js` 다.
   expo CLI 는 멀쩡히 읽어서 `expo-doctor` 20/20 이 나오므로 원인이 안 보인다.
3. **eas 명령은 반드시 `apps/app` 안에서.** 루트에서 돌리면 eas-cli 가 루트에 `eas.json` 을
   새로 만들고 Next `package.json` 에 expo-dev-client 가 없다며 거부한다. (한 번 밟았다.)
4. **`vitest.config.ts` 의 `@/domain` 별칭은 `@` 보다 앞에 있어야 한다.**
   vite 는 first-match-wins. 뒤에 두면 비워진 `src/domain` 으로 조용히 해석된다.
5. **vitest 는 root 가 없는 project 를 경고 없이 스킵하고 exit 0.**
   오타 하나가 게이트를 무음 no-op 으로 만든다. `check:monorepo` 가 이걸 막는다.
6. **`git mv` 는 목적지 부모가 없으면 exit 128.** `mkdir -p` 선행.
   순수 이동 확인은 `git show -M100% --name-status` — `--stat` 은 유사도 점수를 안 찍는다.
7. **`node:sqlite` 는 `foreign_keys` 기본 ON** (C 라이브러리와 반대). 명시 안 하면
   CI 는 강제하고 기기는 안 해서 CI green 인 채 기기에서만 깨진다.
8. Metro 를 세션 배경으로 띄우면 하네스가 죽인다. `Start-Process -WindowStyle Hidden` 으로
   분리해서 띄워라 (로그: 스크래치패드 `metro.log`).
9. **Expo Go 는 SDK 57 미지원.** 스토어판이 못 따라온다. dev-client 만이 경로.
10. 디스크가 상시 빠듯하다(현재 ~4.7GB). 큰 설치 전에 반드시 재측정.

### 런타임 구멍 (P3 대상, 실측 검증됨)

**모듈 로드 실패는 0건.** 심각도 순:

| file:line | 문제 | 심각도 |
|---|---|---|
| `ticket-art.ts:293` 외 3곳 | `Intl.NumberFormat` 4벌이 **모듈 스코프 const** | throw 시 **화이트스크린** |
| `plan-database.ts:319` | `crypto.getRandomValues` → share `idempotencyKey`·`revokeToken` | 첫사용 TypeError · **보안 임계** |
| `plan-workspace.tsx:132,163` | `crypto.randomUUID` | 첫 곡 담기 탭에서 터짐 |
| `add-tracks.ts:45` | `crypto.randomUUID` (계획서 표에 없던 것) | 발견 탭 일괄 담기 |
| `plan-database.ts:274` | `crypto.randomUUID` | 첫사용 TypeError |
| `plan-database.ts:244` | `crypto.randomUUID` (`replaceActivePlan`) | **삭제**(호출자 0) |
| `canonical.ts:23` | `crypto.getRandomValues` 기본 인자 | 첫사용 TypeError |
| `canonical.ts:138` | `crypto.subtle.digest` | 회피 불가 |
| `catalog.ts:10`, `validation.ts:36` | `.normalize("NFC")` OS 위임 | 조용한 오답 |
| `catalog.ts:11` | `.toLocaleLowerCase("ko-KR")` — ASCII 고속경로가 게이트돼 항상 위임 | 조용한 오답 |
| `toLocaleString` 5곳 | 같은 만료 시각이 기기/서버에서 다른 문자열 | 조용한 오답 |
| `plan-database.ts:88` + `profile-avatar.tsx:34-42` | `photo?: Blob` + `URL.createObjectURL` | 표현 결정 필요 |

`expo-crypto.getRandomBytes` 는 **사용 금지** — `__DEV__ && !global.nativeCallSyncHook` 에서
`Math.random` 으로 강등되고 그 조건이 bridgeless 에서 상시 참이다.
`getRandomValues`·`randomUUID`·`digest` 는 분기 없어 안전.

## Tools/Services Used

- Node v24.11.1 / npm 11.6.2 / git 2.52.0. **pnpm·JDK·Android SDK·Mac 없음**
- Expo 계정 `jiring` (로그인됨). EAS 프로젝트 `@jiring/singsong`
  (`d107ba77-525d-4f79-9083-23cfaa428adc`)
- 네이티브 빌드는 전량 EAS 클라우드. 로컬 prebuild 시도 금지
- `@expo/ngrok` 은 `apps/app` devDependency (터널용, postinstall 없어 `--ignore-scripts` 안전)

## Active Processes

- Metro 가 detached 로 떠 있을 수 있다 (PID 는 세션마다 다름). 포트 8081.
  `Get-NetTCPConnection -LocalPort 8081` 로 확인하고 필요하면 죽여라.
- ngrok 터널 `3s1ayby-jiring-8081.exp.direct` — 계정 해시 기반이라 재시작해도 같은 주소
- `apps/app/public/singsong-dev.apk` (55MB, gitignore 됨) — 폰 전달용. 지워도 무방

## Environment Variables

이 프로젝트에서 쓰는 **이름만** (값은 어디에도 적지 않는다):
`APP_PROFILE`, `NEXT_PUBLIC_APP_PROFILE`, `CATALOG_PROVIDER_URL`, `CATALOG_PROVIDER_API_KEY`,
`CATALOG_PROVIDER_SHA256`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`EXPO_PUBLIC_*`. M1 에는 하나도 필요 없다.

## Related Resources

- 정본 계획: `C:\Users\agape\.claude\plans\singsong-mossy-metcalfe.md`
- M0 게이트 결과: `apps/app/docs/DEVICE_CHECKLIST_M0.md`
- Windows 설치 함정: `apps/app/docs/WINDOWS_INSTALL.md`
- 디자인 정본: `docs/design/VISUAL_MOTION_DIRECTION.md` (일부 드리프트)
- EAS 빌드: https://expo.dev/accounts/jiring/projects/singsong/builds
- 게이트 명령: `npm run check:monorepo` · `npm run check:tokens` · `npm run typecheck` ·
  `npm run lint` · `npm run format:check` · `npm test`
  (현재 전부 PASS, 47 파일 / 277 테스트)

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
