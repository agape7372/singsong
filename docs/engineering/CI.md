# CI — GitHub Actions

정본 워크플로: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). 이 문서는 그 워크플로의
**왜**와, CI 밖으로 뺀 검사의 근거·복구 조건·별건 작업을 기록한다. 수치는 전부 실측
(`C:\Users\agape\Desktop\코딩\singsong`, 브랜치 `rebuild/expo-monorepo`, Node v24.11.1, 2026-07-27).

## 왜 세 job 인가

루트 `verify:demo` 체인(`package.json:50`)을 통짜로 한 job 에 넣으면 순수 로직 오류의 피드백이
Next 빌드 + Playwright 브라우저 뒤로 밀려 분 단위가 된다. 두 갈래로 쪼개 병렬화했다.

| job               | 무엇을                                                                    | 왜 분리                                                                                            |
| ----------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **checks**        | 구조 가드·토큰·포맷·린트·타입체크·`vitest --coverage`·`gate:m1`           | 설치 포함 ~30s 안에 빨간불. `gate:m1` 은 빌드 없이 순수 Node 라 여기 넣는다.                       |
| **e2e**           | `build:demo` → `verify-built-pwa` → HTTP 스모크 → `test:e2e` → `test:pwa` | 무겁고, M6 에 폐기될 PWA 표면을 검증한다. 통째로 떼어야 M6 에 독립 제거 가능.                      |
| **app-typecheck** | `apps/app` 의 `tsc`(TS 6.0.3), Skia 네이티브 없이                         | 루트 typecheck(TS 5.9.3)가 `apps/**` 를 안 본다. 버전·옵션이 달라 루트 tsconfig 에 넣으면 안 된다. |

두 job(checks·e2e)이 `verify:demo` 체인의 순서(check:monorepo → … → test → gate:m1 → build:demo →
verify-built-pwa → smoke-http → test:e2e → test:pwa)를 두 갈래로 나눠 그대로 보존한다.

## CI 가 **할 수 없는 것** (설계상 — 권위는 다른 경로에 있다)

계획 §3.6 이 요구한 명시. 이걸 안 적으면 "CI green = 배포 안전" 이라는 거짓 신호가 선다.

- **네이티브 컴파일(Android/iOS)**: EAS 클라우드 빌드 전용. GitHub Actions 로 못 한다.
- **Maestro E2E 플로우**: 미작성(M5 이후 판단). 실행 안 되는 테스트는 쓰지 않는다.
- **실제 Supabase 호출**: 서비스 키·네트워크 부작용. 서버 계약은 모킹으로만 검증.
- **실기기 검증**(하프톤 룩·발권·갤러리 저장·TalkBack·한국어 IME): 사람 판정 게이트.
  paper 의 6일 프로덕션 크래시는 모든 자동 테스트가 green 이었고 검출은 실기기뿐이었다.
- **`apps/app/tools/verify-halftone.mjs`(17 어서션)**: Skia 전체 설치 + `sharp` 가 필요해 무겁다.
  M3 골든 하네스에서 편입한다. per-commit CI 에는 넣지 않는다.

## Node 24 고정

`.nvmrc` → `24`, `engines.node` → `>=24`. CI 는 `node-version-file: '.nvmrc'` 로 이를 따른다.

`packages/store` 계약 테스트는 `node:sqlite`(`packages/store/test/node-sql-executor.ts:1`)를 쓴다.
Node 22.x 에서 이게 `--experimental-sqlite` 플래그를 요구하는지 **미확정**이고(플래그는 22.5 도입,
23.4 무플래그화, 22 LTS 백포트 여부 불명), 계약이 측정된 환경은 Node v24.11.1 / SQLite 3.50.4 로
고정돼 있다(`packages/store/src/sql-executor.ts:9`). 측정 런타임과 CI 런타임을 일치시켜
`migrations.test.ts` 의 SQLite 에러 문자열 어서션의 버전 감수성을 소거한다. 실사용자 0명인 지금이
올리기 가장 싼 시점이다. `check:monorepo` 가 `24 ⊨ >=24` 를 강제한다(통과 실측).

부작용 경계: EAS 빌드 Node 는 `eas.json`/기본값으로 별개라 무영향(루트 `engines` 는 루트
`npm ci` 만 게이트). Expo SDK 는 Node 20/22/24 를 지원한다.

## 커버리지 임계

`vitest.config.ts` thresholds = **statements 80 · branches 72 · functions 82 · lines 83**.
P3 착지 직후(트랙 A·B·C·E 완료) `npx vitest run --coverage` 실측값(2026-07-27)을 정수로 내린 것:

```
Statements  80.82%  (2416/2989)
Branches    72.09%  (1462/2028)
Functions   82.02%  ( 552/673 )
Lines       83.37%  (2271/2724)   → 임계 설정 후 EXIT 0
```

- 이 4개 임계는 여태 **한 번도 평가된 적이 없었다** — `test` 스크립트도 `verify` 체인도
  `--coverage` 를 넘기지 않았다. checks job 의 `npx vitest run --coverage` 가 처음으로 강제한다.
- 이전 근거 "82.27%/75.47%"(계획 §3.6)는 폐기했다. M1 이동 **이전**(packages/domain·store 가
  아직 `src/` 에 있던 때) 측정치라 현 트리와 대응하지 않는다.
- **branches 만 75 → 72 로 완화**했다(나머지 셋은 실측이 넘겨 래칫 강화: functions 80→82,
  lines 80→83, statements 80 유지). 75 는 한 번도 평가된 적 없는 죽은 값이었고, 인용되던
  베이스라인이 M1 이동 이전이라 현 트리와 무관하기 때문. 실제 회귀 방지선은 실측 72 다.
- 정수 내림 이유: v8 커버리지가 Node 패치버전 간 소수점 아래에서 미세하게 흔들린다.
- 커버리지는 전역 합산 1개다(coverage-summary.json total 1개). 새 패키지는 분모에 희석되므로
  패키지별 게이트는 vitest project 분리 이후 사안.

## ⚠ CI 에서 뺀 검사 — 홈 번들 예산(170 KiB gzip)

`scripts/smoke-http.mjs` 의 "홈 초기 JS ≤ 170 KiB gzip" 검사만 CI 에서 제외한다. smoke-http 의
나머지(홈/티켓 200·홈 CSP 가 Turnstile 오리진을 허용 안 함·`x-frame-options: DENY`·OG 가
no-store PNG)는 e2e job 에서 **살아 있다**.

**메커니즘**: `smoke-http.mjs` 에 `SMOKE_SKIP_BUNDLE_BUDGET` env 게이트를 넣었다. 미설정이
기본값(강제)이라 로컬 `npm run verify:demo` 는 예산을 계속 검사한다. e2e job 만 이 값을 `1` 로
세운다. 측정값은 스킵 여부와 무관하게 스텝 로그의 최종 JSON(`homeInitialJsGzipBytes`)에 항상 찍힌다.

**왜 뺐나** (사용자 결정 2026-07-27, 안 (a)): 홈 번들이 P3 이전부터 예산을 초과 중이고, 원인이
페이지 코드가 아니라 벤더 청크라 P3·M1 작업과 무관하다. 통짜 `verify:demo` 를 CI 에 넣으면 첫
런이 이 예산 때문에 빨간불이고, 그 빨간불이 P3 가 만든 것이 아니다.

**현재 실측** (2026-07-27, `.next` 산출물 직접 gzip):

```
홈 초기 JS 전체            225.8 KiB   (예산 170 KiB, 36% 초과 = 예산의 133%)
  벤더 청크만              124.0 KiB   (예산의 73%)
    static/chunks/4bd1b696-*  61.3 KiB   ← React (못 줄임)
    static/chunks/192-*        60.6 KiB
    webpack-*                   1.9 KiB
    main-app-*                  0.2 KiB
```

**예산 숫자 170 은 올리지 않았다.** 올리면 복구 기준선이 사라진다.

**복구 조건**: 홈 초기 JS gzip ≤ 170 KiB 가 되면 e2e job 의 `SMOKE_SKIP_BUNDLE_BUDGET: "1"` 을
지운다. 그러면 CI 가 다시 예산을 강제한다.

## 별건 작업 — 벤더 번들 다이어트

**상태**: 미착수(P3 범위 밖). **우선순위**: M6 이전 웹 랜딩 성능.

- **범위**: 다이어트의 실제 가치는 M6 까지 살아 있는 **웹 랜딩 `/s/[slug]`** 에 **한정된다**.
  `src/` 는 M6 에 폐기 예정이고 네이티브 앱 번들과 무관하다(네이티브는 `packages/*` + Skia).
- **여지**: 페이지 코드가 아니라 **벤더**에 있다. 후보 = `motion`(12.42.2), `@base-ui/react`(1.6.0).
  React 61.3 KiB(`4bd1b696` 청크)는 줄일 수 없다.
- **미확정**: 언제부터 초과였는지. `pwa-final`(adb4d2d)·`m1-baseline`(21c8e1a) 재측정이 필요하고
  워크트리 + install 이 든다. M1 이동이 원인일 가능성은 낮다(순수 TS 이동은 번들에 무영향).
- **완료 정의**: 홈 초기 JS gzip ≤ 170 KiB → 위 "복구 조건"대로 CI 예산 검사 재활성화.
