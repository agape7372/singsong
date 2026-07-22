# SingSong 구현 인수인계 원샷 프롬프트 v3.2

> **HISTORICAL PRE-IMPLEMENTATION SNAPSHOT — 현재 실행 지시문으로 사용하지 않는다.** 최신 구현 상태와 인계는 루트 `README.md`, `APP_RENEWAL_PLAN.md`, `HANDOFF.md`, `VERIFICATION_REPORT.md`를 따른다.  
> 문서 성격: 다른 Codex 세션에 이 파일 하나를 전달해도 작업을 안전하게 재개할 수 있게 만든 **실행 지시문**  
> 스냅샷: 2026-07-22 Asia/Seoul  
> 제품 정본 버전: v3.2  
> 스냅샷 당시 구현 상태: 문서와 디자인 참고 자산만 존재하며 앱 코드는 아직 없음  
> 현재 기준 브랜치/HEAD: `claude/favorite-song-app-research-vs3yqa` / `fff4d59`  
> 스냅샷 당시 readiness: `buildCapability=NOT_READY`, `productionGate=BLOCKED`  
> 중요: 이 파일은 기존 정본을 덮어쓰지 않는다. 정본을 읽고 실제 구현을 계속하기 위한 세션 간 핸드오프다.

---

## 0. 새 세션에 내리는 실행 명령

당신은 SingSong을 구현하는 총괄 제품 엔지니어이자 디자인·접근성·보안·검증 책임자다. 이 문서를 계획만 세우는 자료로 취급하지 말고, 저장소 루트에서 안전하게 실행 가능한 작업을 Stage 0부터 연속 수행하라.

목표는 10대부터 30대까지 사용하는 모바일 우선 설치형 PWA를 출시 후보 수준으로 구현하는 것이다. 다만 법적·외부 권한·실기기·실사용자 증거가 없는 상태를 성공으로 꾸미지 않는다. 외부 blocker 때문에 전체 구현을 멈추지 말고 fixture와 로컬 어댑터로 완성 가능한 수직 슬라이스를 계속 완성한다.

반드시 지킬 실행 원칙은 다음과 같다.

1. 저장소의 모든 Markdown 문서를 빠짐없이 읽고 읽기 원장과 충돌 원장을 만든다.
2. 기존 dirty worktree의 수정·미추적 파일은 전부 사용자 작업으로 간주하고 보존한다.
3. `git reset`, `git checkout --`, 무단 삭제, 기존 변경 일괄 정규화, 무단 stage/commit/push를 하지 않는다.
4. 계획 보고로 끝내지 말고 구현, 자동 검증, 시각 검수, 증거 기록까지 이어간다.
5. 동시 실행 슬롯이 4개라면 총괄 writer 1명과 독립 reviewer 3명을 유지하고, reviewer를 파동별로 교체해 최대한 많은 전문 에이전트를 활용한다.
6. 같은 파일을 여러 에이전트가 동시에 수정하지 않는다. 공통 파일, lockfile, migration, service worker, golden fixture, Git 작업은 총괄만 쓴다.
7. 실제 수행하지 않은 사용자 테스트·실기기 테스트·보안 검증은 `NOT_RUN` 또는 `BLOCKED`로 남긴다. 에이전트 시뮬레이션은 항상 `MOCK_ONLY`다.
8. 공개 배포, production migration, 실사용 데이터 publish, 외부 메시지 전송, 유료 서비스 개통은 별도 사람 승인 없이 실행하지 않는다.
9. 에이전트는 `RELEASED`를 선언하지 않는다. 모든 필수 증거가 있어도 최대 표현은 `PRODUCTION_CANDIDATE + READY_FOR_HUMAN_RELEASE`다.
10. 이 문서와 실제 저장소 상태가 다르면 현재 상태를 다시 측정하고 `STATE_DIVERGED`를 기록한 뒤, 사용자 작업을 보존하는 방향으로 재계획한다.

---

## 1. 현재 저장소 스냅샷과 보존 계약

2026-07-22 기준 확인된 상태는 다음과 같다.

- 앱 `package.json`, lockfile, 소스 코드, migration, CI, 자동 테스트, 배포 설정은 아직 없다.
- 다음 16개 추적 문서가 수정 상태다.
  - `docs/BUILD_PLAN.md`
  - `docs/PRODUCT_SPEC.md`
  - `docs/README.md`
  - `docs/design/COMPONENTS.md`
  - `docs/design/DESIGN_SYSTEM.md`
  - `docs/design/MICROCOPY.md`
  - `docs/design/SCREENS.md`
  - `docs/design/UX_FLOWS.md`
  - `docs/engineering/ANALYTICS.md`
  - `docs/engineering/API_CONTRACT.md`
  - `docs/engineering/ARCHITECTURE.md`
  - `docs/engineering/PLATFORM_NOTES.md`
  - `docs/engineering/SECURITY.md`
  - `docs/prompts/ONESHOT_MASTER.md`
  - `docs/verification/QA_MATRIX.md`
  - `docs/verification/TEST_PLAN.md`
- 다음 정본·검토·디자인 파일/폴더가 미추적 상태다.
  - `APP_FINAL_DESIGN_PLAN.md`
  - `docs/CODEX_FINAL_REVIEW.md`
  - `docs/FINAL_BLUEPRINT.md`
  - `docs/UNKNOWN_REGISTER.md`
  - `docs/design/VISUAL_MOTION_DIRECTION.md`
  - `docs/design/assets/`
  - `docs/design/concepts-10/`
  - `docs/design/ticket-concepts-10/`
  - `docs/design/ticket-directions/`
- 브랜치는 원격보다 1 commit 앞서 있다.
- Windows 환경에서 Node `24.11.1`, Corepack `0.34.2`, pnpm `11.9.0`, Chrome/Edge가 관찰됐다. 목표 Node는 `24.18.0`이다.
- Docker CLI는 있으나 daemon이 꺼져 있었고 Supabase CLI는 없었다. 네트워크 sandbox 때문에 npm 접근이 막힐 수 있다.
- 위 상태는 과거 스냅샷이다. 새 세션은 첫 행동으로 다시 확인한다.

시작 시 아래를 읽기 전용으로 실행하고 결과를 `RUN_STATE.md`에 기록한다.

```powershell
git status --short --branch
git rev-parse --abbrev-ref HEAD
git rev-parse --short HEAD
rg --files -g "*.md"
node --version
corepack --version
pnpm --version
docker version
```

명령이 없거나 외부 환경 때문에 실패하면 우회 설치로 숨기지 말고 `blockerKind=ENVIRONMENT`로 기록한다. 필요한 설치·네트워크 권한이 승인되기 전에도 문서, fixture, 순수 로컬 코드, 단위 테스트 작성은 계속한다.

---

## 2. 정본 읽기 순서와 모든 Markdown 완독 규칙

우선순위는 다음과 같다.

1. `docs/FINAL_BLUEPRINT.md`
2. `docs/prompts/ONESHOT_MASTER.md` v3.2
3. `docs/design/VISUAL_MOTION_DIRECTION.md`
4. 도메인별 기존 정본
5. 나머지 레거시·결정 이력·컨셉 자료

다음 파일은 구현 중 읽기 전용 정본으로 취급한다.

- `docs/FINAL_BLUEPRINT.md`
- `docs/prompts/ONESHOT_MASTER.md`
- `docs/design/VISUAL_MOTION_DIRECTION.md`
- `docs/CODEX_FINAL_REVIEW.md`
- `docs/UNKNOWN_REGISTER.md`

정본과 구현 증거가 충돌해 변경 제안이 필요하면 정본을 조용히 고치지 않는다.

- 해결안과 근거: `UNKNOWN_RESOLUTIONS.md`
- 충돌과 채택 우선순위: `CONFLICT_REGISTER.md`
- 제품·기술 결정: `DECISIONS_LOG.md`
- 요구사항과 코드/테스트 연결: `REQUIREMENTS_TRACE.md`

현재 존재하는 Markdown inventory는 다음과 같다. 새 세션에서 `rg --files -g "*.md"` 결과와 합쳐 **모든 파일**을 처음부터 끝까지 읽는다.

```text
APP_FINAL_DESIGN_PLAN.md
docs/BUILD_PLAN.md
docs/CODEX_FINAL_REVIEW.md
docs/FINAL_BLUEPRINT.md
docs/PRODUCT_SPEC.md
docs/README.md
docs/UNKNOWN_REGISTER.md
docs/design/COMPONENTS.md
docs/design/DESIGN_SYSTEM.md
docs/design/MICROCOPY.md
docs/design/SCREENS.md
docs/design/UX_FLOWS.md
docs/design/VISUAL_MOTION_DIRECTION.md
docs/design/assets/README.md
docs/design/concepts-10/ADOPTION.md
docs/design/concepts-10/README.md
docs/design/ticket-concepts-10/PRINCIPLES_CHECKLIST.md
docs/design/ticket-concepts-10/README.md
docs/design/ticket-directions/README.md
docs/design/ticket-directions/TICKET_PROMPT_PRINCIPLES.md
docs/engineering/ANALYTICS.md
docs/engineering/API_CONTRACT.md
docs/engineering/ARCHITECTURE.md
docs/engineering/PLATFORM_NOTES.md
docs/engineering/SECURITY.md
docs/prompts/ONESHOT_MASTER.md
docs/verification/QA_MATRIX.md
docs/verification/TEST_PLAN.md
```

`MD_READ_LEDGER.md`를 만들고 각 파일에 대해 `path`, `sizeBytes`, `sha256`, `readAt`, `readStatus`, `role=canonical|domain|legacy|reference|handoff`, `conflictsFound`, `resolutionLink`를 기록한다. 같은 내용을 `test-results/<run-id>/doc-audit/`의 machine-readable artifact로도 남긴다. 긴 문서의 truncated 출력이나 일부 구간만 읽고 완독으로 표시하지 않는다. 페이지를 나눠 EOF까지 확인한다. 인코딩이 깨져 보이면 UTF-8로 다시 읽고 원본 바이트를 바꾸지 않는다.

---

## 3. 제품 한 문장과 사용자 계약

SingSong은 공개 음악 플레이리스트나 콘텐츠 탐색 서비스가 아니다.

> 2–4인 노래방 모임의 주최자가 가입 없이 2분 안에 부를 곡과 예상 시간·비용을 정리하고, 친구가 설치 없이 바로 이해하는 티켓으로 안전하게 공유하는 로컬 우선 세션 플래너다.

핵심 산출물은 목록 자체가 아니라 **발권된 세션 티켓**이다. 핵심 전환은 `검색/직접 추가 → 순서 정리 → 유효한 가격·인원 → 정직한 시간·비용 범위 → 티켓 발권 → 안전한 unlisted 링크 공유/가져오기`다.

제품 계약:

- 로그인과 회원가입이 없다.
- 기기·브라우저 저장소당 활성 플랜은 하나다.
- 최대 100곡이다.
- 핵심 기능은 설치 없이 웹에서도 끝까지 동작한다.
- 설치는 편의 기능이지 진입 장벽, 백업 약속, 데이터 복구 약속이 아니다.
- 수신자는 설치·로그인 없이 티켓을 읽고, 명시적 동의 후 자신의 저장소로 가져온다.
- 주최자의 브라우저, Kakao WebView, Safari, 설치 PWA 저장소가 자동으로 이어진다고 가정하지 않는다.
- 데이터 범위와 불확실성을 솔직하게 표시한다.
- 계획에 없는 대형 기능을 추가해 핵심 여정을 흐리지 않는다.

P0 route는 오직 다음 여섯 개다.

```text
/
/search
/ticket
/s/[slug]
/import
/offline
```

다음은 P0에서 금지한다.

- `/list/[id]`
- 계정, 로그인, 여러 목록, 히스토리, Discover
- 결제, 실시간 공동 편집, 댓글, 소셜 피드
- Spotify/YouTube/Apple Music 등 스트리밍 playlist import
- 가사, 음원, 앨범아트, AI 음악 인식
- 곡 memo, key, tags, device UUID, `fork_count`
- 공개 전체 검색 가능한 공유 목록
- 실제 곡 데이터 권리 없이 production catalog 활성화

---

## 4. 대상 사용자, 페르소나, 연구 표본

제품 UI의 연령 범위는 10–39세를 고려한다. 다만 실제 연구와 마케팅의 기본 표본은 14–39세다. 10–13세는 법정대리인 동의, 최소수집 설계, 법무 확인이 완료된 별도 트랙에서만 모집하고, 그 전에는 실제 연구 대상으로 포함하거나 “검증 완료”라고 쓰지 않는다.

연령 cohort:

- 14–18세
- 19–24세
- 25–29세
- 30–39세
- 10–13세 조건부 보호자 동의 트랙

필수 페르소나:

| ID | 역할 | 핵심 상황 | 성공 조건 |
|---|---|---|---|
| `P-ORG` | 모임 주최자 | 2–4인 약속 전/이동 중 곡·예산 정리 | 120초 안에 3곡 이상, 유효 계산, 티켓 발권·공유 |
| `P-REC` | 링크 수신자 | Kakao/메신저에서 링크를 처음 엶 | 5초 안에 곡 수·시간·비용 범위를 이해 |
| `P-HANDOFF` | 브라우저/PWA 전환 사용자 | WebView에서 설치 PWA 또는 외부 브라우저로 이동 | 저장소가 다름을 이해하고 명시적으로 import |
| `P-SOLO` | 혼자 준비하는 대조군 | 빠르게 개인 선곡만 정리 | 불필요한 협업 기능 없이 완료 |

페르소나 문서에는 가상의 이름·맥락·기기·접근성 요구·불안 요소·성공/실패 시나리오를 넣되 실제 사용자 데이터처럼 표현하지 않는다.

---

## 5. 다운로드/설치부터 첫 성공까지의 완전한 여정

여기서 “앱 다운로드”는 앱스토어 네이티브 배포가 아니라 installable PWA를 의미한다.

- Android/Chromium: 브라우저 설치 프롬프트 또는 앱 내 비강제 설치 안내
- iOS/Safari: 공유 메뉴의 “홈 화면에 추가” 안내
- 이미 설치됨: standalone 모드로 바로 진입
- 설치하지 않음: 웹에서 전체 핵심 여정 완료

첫 여정은 다음 순서로 부드럽게 이어져야 한다.

1. 유입 링크 또는 홈 진입
2. 권한 요청·로그인·긴 온보딩 없이 정돈된 빈 `Working Strip` 표시
3. 한 문장 가치 설명과 명확한 `첫 곡 추가` CTA
4. 검색 또는 직접 추가
5. 3곡 이상 추가와 순서 변경
6. 곡당 요금 또는 시간 요금 입력
7. 인원 1–30명 입력
8. 정직한 시간·비용 범위 즉시 확인
9. 티켓 발권
10. 발권 모션 1회
11. 링크 공유 또는 PNG 저장
12. 수신자가 설치 없이 확인
13. 필요 시 외부 브라우저/설치 앱으로 명시적 가져오기

반드시 별도로 검증할 첫 사용 acceptance flow는 세 개다.

- `FLOW-INSTALL-FIRST`: Android 설치 프롬프트 또는 iOS 홈 화면 추가 → standalone 첫 실행 → actionable empty strip → 검색/직접 추가로 3곡 → 가격·인원 → 범위 → 티켓 발권.
- `FLOW-WEB-FIRST`: 설치 없이 웹에서 첫 가치와 티켓까지 완료 → 선택적으로 설치 → 저장소 경계를 설명하는 명시적 `/import` handoff → 기존 초안 overwrite 방지.
- `FLOW-RECIPIENT`: 미설치 수신자가 Kakao에서 `/s/[slug]`를 열어 5초 안에 곡 수·시간·비용 이해 → 필요할 때만 외부 브라우저/PWA로 가져오기 → 원본과 local copy가 동기화되지 않음을 이해.

실기기 증거가 없으면 위 flow의 browser automation은 `AUTOMATED` 결과로만 기록하며 actual device PASS로 승격하지 않는다.

첫 진입 설계 규칙:

- 온보딩 carousel을 만들지 않는다.
- 설치 프롬프트를 첫 화면에서 강제하지 않는다.
- 카메라, 마이크, 위치, 연락처 권한을 요청하지 않는다.
- 초기 빈 화면에 가짜 완료형 sample ticket을 본문 데이터처럼 넣지 않는다.
- 사용자는 검색 실패 시 동일 흐름에서 직접 추가할 수 있다.
- calculator 오류가 있으면 CTA를 죽이기만 하지 말고 첫 오류 필드로 focus하고 구체적 복구 문구를 제공한다.
- 브라우저와 standalone 간 로컬 데이터 자동 동기화를 약속하지 않는다.
- 설치 안내를 닫아도 기능 손실이 없다.
- 네트워크가 끊겨도 기존 로컬 계획을 열고 편집할 수 있으며 공유 생성만 정직하게 제한한다.

첫 성공 acceptance:

- 새 프로필에서 3곡 추가, 가격·인원 입력, 티켓 발권까지 무도움 120초 이내
- 키보드가 열린 상태에서 ActionDock과 오류가 가려지지 않음
- iOS/Android 설치 경로를 닫거나 완료해도 핵심 상태가 손실되지 않음
- reload, back/forward, orientation change, standalone 재실행에서 초안이 보존됨
- 티켓 모션이 동일 revision에서 반복되지 않음
- 수신자에게 설치를 강제하지 않음

---

## 6. 로컬 상태와 계산의 단일 진실

### 6.1 로컬 상태

- Dexie/IndexedDB를 사용한다.
- 단일 활성 plan, 최대 100곡이다.
- song은 명시적 up/down 제어로 재정렬할 수 있어야 하며 키보드와 screen reader에서도 동작해야 한다.
- 모든 write는 Dexie transaction과 `revision` optimistic compare를 사용한다.
- revision 충돌 시 자동 merge나 last-write-wins를 하지 않는다. rollback 후 최신 상태를 reload하고 사용자에게 다시 시도할 수 있는 메시지를 준다.
- multi-tab에서 충돌·중복 발권·순서 유실을 테스트한다.
- 첫 릴리스에는 가격/인원 preset을 넣지 않는다.

`canIssueTicket` 조건:

```text
items.length >= 1
AND pricing is valid
AND people is a safe integer in [1, 30]
```

### 6.2 시간 범위 `fallback-v1`

N곡일 때 원시 초 단위를 유지한다.

```text
lowSeconds  = N * 165 + max(0, N - 1) * 15
midSeconds  = N * 210 + max(0, N - 1) * 25
highSeconds = N * 255 + max(0, N - 1) * 35
```

UI에만 바깥 방향 5분 반올림을 적용한다. 과금 계산에는 표시용 반올림 값을 넣지 않고 raw seconds를 사용한다.

### 6.3 곡당 요금

곡 수 N, 묶음 곡 수 `bundleSongs`, 묶음 가격 `bundlePrice`, 낱곡 가격 `singlePrice`일 때:

```text
total = min(
  k * bundlePrice + max(0, N - k * bundleSongs) * singlePrice
) for k in [0, ceil(N / bundleSongs)]
```

### 6.4 시간 요금

```text
total = ceil(rawSeconds / blockSeconds) * blockPrice
```

low/mid/high 각각 같은 forward 함수로 계산한다.

### 6.5 인당 상한과 역계산

```text
perPersonUpper = ceil(totalUpper / people)
```

예산 역산은 별도 근사식을 만들지 않는다. 같은 forward 계산 함수를 호출하면서 조건을 만족하는 최대 prefix를 찾는다.

필수 검증:

- 0, 1, 묶음 경계 전후, 99, 100곡
- 1명, 30명, 정수가 아닌 값, overflow 입력
- 정확히 block 경계와 경계 ±1초
- bundle가 낱곡보다 비싼 경우
- monotonicity, non-negative, low ≤ mid ≤ high
- forward와 reverse 일치 property test
- BigInt 또는 안전 정수 범위 정책과 표시 format 경계

---

## 7. 노래 정보와 TJ/KY 노래방 번호 자동 수급 계획

### 7.1 해결된 원칙

사용자가 수만 곡을 직접 수집하거나 CSV로 준비하게 하지 않는다. 구현팀이 provider adapter와 자동 ingest 파이프라인을 만든다. 그러나 **기술적으로 접근 가능함은 상업적 저장·가공·재배포 권리를 뜻하지 않는다.** 권리 근거가 없으면 production catalog를 켜지 않는다.

앱 runtime 검색은 항상 우리 서버의 `POST /api/search`만 호출한다. 사용자의 검색어를 TJ/KY/제3자 사이트로 실시간 proxy하지 않는다. upstream 수집은 별도 운영 job에서 수행하고 검증된 own catalog만 원자적으로 publish한다.

### 7.2 provider 계층

다음 인터페이스와 adapter를 구현한다.

```ts
type CatalogUse = 'FIXTURE_ONLY' | 'TECHNICAL_SPIKE' | 'APPROVED_PRODUCTION';
type CatalogRightsStatus =
  | 'UNKNOWN'
  | 'TECHNICAL_ONLY'
  | 'APPROVED'
  | 'SUSPENDED'
  | 'REVOKED';

interface CatalogProvider {
  id: string;
  use: CatalogUse;
  rightsStatus: CatalogRightsStatus;
  bootstrap(cursor?: string): AsyncIterable<ProviderRecord>;
  fetchDelta(since: Date, cursor?: string): AsyncIterable<ProviderRecord>;
  lookupByNumber?(brand: 'TJ' | 'KY', songNo: string): Promise<ProviderRecord | null>;
  healthcheck(): Promise<ProviderHealth>;
}
```

구현 대상:

- `FixtureAdapter`: 가짜 제목·가짜 가수·가짜 번호만 포함한 결정적 합성 데이터. 언제나 사용 가능하되 화면과 artifact에 `TEST DATA`를 영구 표시한다. 실제 TJ/KY row를 섞지 않는다.
- `MananaAdapter`: 초기 기술 검증용. 명시적 상업 이용/저장/재배포 허가가 확보되기 전에는 `TECHNICAL_SPIKE`다.
- `TJOfficialAdapter`: TJ 공식 검색/신곡 화면의 구조와 변경을 검증하는 adapter. 공식 허가 또는 계약 전 production publish 금지다.
- `KYOfficialAdapter`: 금영/KYSing 공식 검색/책/신곡 화면을 검증하는 adapter. 이용약관상 사전 승인이 필요한 것으로 취급하고 승인 전 production publish 금지다.

provider 선택은 환경변수 한 줄로 권리를 우회하지 못하게 한다. `APPROVED_PRODUCTION`은 코드 값만으로 승격하지 않고 `catalog_rights_manifest`의 증거 ID, 허용 범위, 만료일, takedown 연락처가 유효해야 한다. release bundle/DB에서 fixture나 `TEST DATA`를 찾으면 `verify:release`가 실패해야 한다.

권리 상태는 publish뿐 아니라 **fetch와 보존 자체**를 통제한다.

- `UNKNOWN` 또는 `TECHNICAL_ONLY`: scheduler, bootstrap, reconciliation, 대량/반복 live fetch, raw response 영구 보존을 코드 수준에서 비활성화한다.
- 이 상태에서 허용되는 것은 합성 parser fixture와, 목적·범위·요청 수·관찰자·삭제 시각을 사전에 기록한 소량의 일회성 live probe뿐이다. live probe 결과는 권리 범위가 불명확하면 row/raw body를 보존하지 않고 schema와 response hash 같은 최소 증거만 남긴다.
- `APPROVED`라도 rights manifest에 `automatedFetch`, `cache`, `rawRetention`, `normalize`, `display`, `redistribute` capability가 각각 명시되어야 해당 동작을 활성화한다.
- raw retention이 허용된 경우에만 허용 필드, 보존기간, encryption, ACL, 저장 위치, 삭제 조건을 manifest가 통제한다.
- `SUSPENDED` 또는 `REVOKED`는 즉시 모든 fetch/publish를 중단하고 takedown runbook을 실행한다.

### 7.3 2026-07-22에 확인된 기술 경로

아래는 adapter 연구의 출발점이며 안정된 공개 API 계약이나 이용 허가로 간주하지 않는다. 새 세션은 구현 전에 공식 페이지와 약관을 다시 확인하고 관찰일·응답 hash를 남긴다.

| 공급원 | 기술 경로 | 관찰 내용 | production 권리 상태 |
|---|---|---|---|
| API Manana | `https://api.manana.kr/karaoke.json?brand=tj`, `https://api.manana.kr/karaoke.json?brand=kumyoung` | `brand`, `no`, `title`, `singer`, `composer`, `lyricist`, `release` 관찰 | 명시적 상업 저장·재배포 라이선스 미확인, 승인 전 금지 |
| TJ 공식 검색 | `https://www.tjmedia.com/song/accompaniment` | GET `/song/accompaniment_search`; `nationType`, `strType`, `searchTxt`, `strWord`, `pageNo`, `pageRowCnt` | 기술 검증 가능성과 재배포 권리는 별개, 공식 협의 필요 |
| TJ 공식 신곡 | `https://www.tjmedia.com/song/monthNewSong` | 화면이 POST `/legacy/api/newSongOfMonth`, form `searchYm=YYYYMM`를 사용한 것이 관찰됨 | 문서화된 SLA/라이선스/삭제 feed 미확인 |
| KY/KYSing 검색 | `https://kysing.kr/search/` | `/search/?keyword=...`, category 기반 검색 | 이용약관 제33조의 사전 승인 조건으로 확인, 서면 승인 전 자동 수집·production 금지 |
| KY 노래방 책 | `https://kysing.kr/karaoke-book/` | 번호/제목/가수 목록과 pagination 관찰 | 사전 승인 전 재사용 금지로 취급 |
| KY 최신곡 | `https://kysing.kr/latest/` | 최신곡 pagination과 번호 재검증에 사용 가능 | 사전 승인 전 재사용 금지로 취급 |

참고 연락/정책:

- TJ 사업 제안: `https://www.tjmedia.com/support/business_apply`
- KY FAQ: `https://www.kyentertainment.kr/bbs/board.php?bo_table=faq&wr_id=221`
- KYSing 이용약관: `https://kysing.kr/useguide/`
- KY 사업 문의로 확인된 주소: `biz@kyentertainment.kr`

robots 허용은 라이선스가 아니다. 페이지 구조를 대량 수집 가능한 endpoint로 해석해도 계약·저작권·데이터베이스권·서비스 약관 검토를 대체하지 않는다.

TJ의 undocumented 월별 endpoint가 과거 입력에서 누적 범위처럼 보였더라도 이를 안정된 full-snapshot 계약으로 간주하지 않는다. 승인 전에는 대량 과거 범위 호출을 하지 않고 저장된 합성 parser fixture와 작은 수동 기술 검증만 허용한다. 승인 후에도 bounded delta, rate limit, schema-drift 감시를 적용한다.

다음 오픈소스는 코드 라이선스와 데이터 권리가 다르므로 production seed 근거로 쓰지 않는다.

- `Alfex4936/tj-media-karaoke-api`
- `ghkim887/karaoke-search`
- `devhaemin/KaraokeCrawler`

### 7.4 canonical catalog 모델

최소 테이블:

```text
catalog_sources
catalog_rights_manifest
catalog_import_runs
catalog_quarantine
songs
karaoke_codes
song_aliases
catalog_takedowns
catalog_publish_versions
```

필수 의미:

- `songs`: 곡의 정규화된 개념. title/artist와 canonical normalization을 보관한다.
- `karaoke_codes`: `brand`, `songNo`, `songId`, `versionLabel`, `active`, `firstSeenAt`, `lastSeenAt`을 보관한다.
- TJ와 KY 번호를 한 문자열 또는 한 row에 억지로 합치지 않는다.
- 같은 곡이 한 브랜드에서 live/remix/재등록으로 여러 번호를 가질 수 있다.
- 같은 `brand + songNo`의 메타데이터가 바뀌면 자동 덮어쓰지 말고 quarantine diff를 만든다.
- `song_aliases`: 검색용 제목/가수 별칭이며 출처와 confidence를 가진다.
- 모든 row는 `sourceId`, `sourceUrl`, `observedAt`, `lastSeenAt`, `sourceHash`, `providerVersion`, `rightsBasis`, `confidence`를 추적할 수 있어야 한다.
- 가사·음원·앨범 이미지는 저장하지 않는다.
- 사용자 직접 추가 곡은 로컬 plan 안에서만 동작하며 검증된 production catalog row처럼 승격하지 않는다.

### 7.5 ingest 파이프라인

```text
provider fetch
→ immutable raw snapshot
→ quarantine
→ schema/size/content-type validation
→ UTF-8/NFC/control-character validation
→ title/artist/brand/songNo normalization
→ exact key + alias candidate dedupe
→ previous publish diff
→ rights manifest check
→ 200-song golden set comparison
→ human-review queue for conflicts
→ atomic version publish
→ search index refresh
→ audit evidence
```

운영 계획:

- 아래 예약 작업은 source가 `APPROVED`이고 계약/rights manifest가 해당 자동 fetch·cache·보존을 허용할 때만 켠다.
- 허용된 초기 bootstrap은 checkpoint/cursor를 지원한다.
- 허용된 공식 신곡 delta는 매일 실행한다.
- 허용된 전체 또는 월 단위 reconciliation은 주 1회 실행한다.
- provider 장애 시 last-known-good version을 계속 제공한다.
- exponential backoff, rate limit, circuit breaker를 적용한다.
- 응답 schema나 checksum이 달라지면 publish하지 않고 quarantine한다.
- 삭제/번호 변경/권리 철회는 tombstone과 takedown audit로 처리한다.
- 잘못된 publish는 이전 version으로 원자적 rollback할 수 있어야 한다.
- source 응답 원문에 개인정보나 secret이 있으면 보존 전에 제거하며, 접근 권한과 retention을 분리한다.
- adapter parser는 saved fixture로 contract test하고 live probe와 분리한다.

### 7.6 catalog 출시 게이트

모두 충족해야 release catalog를 활성화할 수 있다.

- TJ/KY 또는 합법적 공급자별 서면 권리/계약/허용범위 evidence
- source attribution과 takedown 절차
- source별 관찰일, version, checksum, rollback 가능성
- TJ/KY 합계 200곡 golden set을 사람이 공식 화면과 대조
- golden set 노래방 번호 정확도 ≥99%
- 검색 top-3 성공률 ≥95%
- 정상 부하에서 검색 p95 ≤800ms
- 잘못된 번호, 삭제, 중복, 제목/가수 변경 처리 검증
- 공급 장애 중 last-known-good 제공 검증

권리 증거가 없으면 자동화 skeleton과 fixture demo는 완성하되:

```text
buildCapability <= LOCAL_DEMO_READY
productionGate = BLOCKED
blockerKind = EXTERNAL_AUTHORITY
fixture watermark = TEST DATA
```

이때 합성 fixture 테스트는 `PASS + AUTOMATED + FIXTURE_ONLY`, 실제 catalog 품질은 `NOT_RUN + BLOCKED(CATALOG_RIGHTS)`로 별도 기록한다. fixture 결과로 실제 golden 200곡 gate를 통과했다고 쓰지 않는다.

사용자는 노래 데이터를 직접 가져오지 않는다. 사람에게 요청할 것은 대량 row가 아니라 계약/허가 결정과 필요한 계정·운영 권한뿐이다.

### 7.7 takedown과 기존 immutable 공유 처리

곡/번호/source의 권리 철회·정정 요청은 catalog row만 숨기는 것으로 끝내지 않는다.

1. 해당 `source/vendor/code`를 즉시 비활성화한다.
2. 검색 결과, 신규 plan 선택, 신규 managed ticket/share 생성을 차단한다.
3. 영향받은 활성 share와 OG artifact를 provenance index로 식별한다.
4. 계약·요청 범위가 기존 공유에도 적용되면 해당 share/OG를 generic unavailable 상태로 revoke한다. immutable payload를 제자리 수정하지 않는다.
5. 처리 근거, operator reference, 시작/완료 시각, SLA, 영향 count만 감사 기록하고 raw 개인정보나 전체 payload는 기록하지 않는다.
6. 재수록/relisting은 새로운 권리 evidence와 사람 승인 후 새 catalog publish version으로만 수행한다.
7. 곡 하나 삭제, 잘못된 번호 정정, source 전체 중단, 계약 만료, 기존 30일 share/OG revoke, rollback/relisting을 각각 E2E rehearsal하고 release gate에 포함한다.

---

## 8. 검색 계약

- browser는 `POST /api/search`만 호출한다.
- JSON body는 1KiB 이하, 결과는 최대 20개다.
- 검색어를 URL, access log, analytics, error report에 남기지 않는다.
- seed normalization과 query normalization은 같은 함수를 사용한다.
- 한글/라틴문자/숫자, Unicode NFC, 공백·구두점·대소문자 규칙을 명시한다.
- token은 AND 의미이며 입력 순서와 무관한 안정적 ranking을 사용한다.
- ranking 우선순위는 exact number, exact normalized title/artist, prefix, token coverage, alias, popularity가 있더라도 provenance 없는 인기값은 금지 순이다.
- IME composition 중 요청하지 않는다. `compositionend` 후 200ms pause를 적용한다.
- 이전 요청은 `AbortController`로 취소하고 sequence guard로 stale 결과가 화면을 덮지 못하게 한다.
- offline/timeout/zero-result/parser failure를 구분한다.
- zero-result에서 동일 화면 내 직접 추가를 제공한다.
- 직접 추가에는 `직접 추가됨` 상태를 명확히 표시하고 공식 TJ/KY 번호처럼 보이게 하지 않는다.

---

## 9. 기술 스택과 프로젝트 구조

정본이 지정한 major/minor 라인 안에서 새 세션 시작 시 공식 1차 문서로 최신 stable patch를 확인한 뒤 정확히 pin하고 `TOOLCHAIN_LOCK.md`에 근거·날짜·checksum을 기록한다.

기준 라인:

- Node `24.18.0`
- pnpm `11.9.0`
- Next.js `16.1.x`
- React/React DOM `19.2.x`
- Tailwind CSS `4.x`
- Base UI `1.6.x` 계열 검토 후 exact pin
- `motion/react`
- Dexie
- Zod
- Supabase/Postgres
- `html-to-image`
- Serwist
- Vitest
- Playwright
- axe

공식 참고:

- Node 24 archive: `https://nodejs.org/en/download/archive/v24`
- Next.js 16.1: `https://nextjs.org/blog/next-16-1`
- React 19.2: `https://react.dev/blog/2025/10/01/react-19-2`
- Base UI: `https://base-ui.com/react/overview/quick-start`
- Motion React upgrade: `https://motion.dev/docs/react-upgrade-guide`
- Next.js PWA: `https://nextjs.org/docs/app/guides/progressive-web-apps`
- Serwist/Turbopack: `https://serwist.pages.dev/docs/next/turbo`

권장 경계:

```text
app/                 routes, server components, route handlers
components/          semantic UI and Session Strip components
features/plan/       local plan state and operations
features/calculator/ pure calculation functions and oracles
features/catalog/    provider contracts, normalization, ingest, search
features/ticket/     artwork model, ticket UI, PNG
features/share/      share/revoke/import flows
lib/db/              Dexie schema and revisions
lib/server/          Supabase BFF, abuse controls, request IDs
public/              reviewed static assets, manifest icons
supabase/migrations/ exact grants/functions/jobs
tests/               unit, property, contract, e2e, visual, a11y
```

코드 규칙:

- TypeScript strict.
- `any`, silent catch, unsafe cast, duplicated 계산식 금지.
- pure domain function과 browser/server side effect를 분리한다.
- runtime input은 모두 Zod 등으로 검증한다.
- client에 server secret이나 Supabase privileged credential을 보내지 않는다.
- dependency lifecycle script와 provenance를 설치 전 감사한다.
- 기존 dirty worktree에 scaffold를 직접 덮지 않는다. 필요하면 workspace 내부의 명시적 임시 디렉터리에 생성한 뒤 diff를 검토하고 필요한 파일만 `apply_patch`로 선별 통합한다.

---

## 10. 서버 API, 공유, 보안 계약

P0 API는 다음 네 종류다.

```text
POST /api/search
POST /api/shares
GET  /api/shares/[slug]
POST /api/shares/[slug]/revoke
```

모든 API:

- 응답에 `X-Request-Id`
- 오류 envelope: `{ "error": { "code": "...", "requestId": "...", "retryAfterSec": 0 } }`
- 민감 응답과 공유 응답은 `Cache-Control: no-store`
- query, payload, raw token, full IP, secret을 log하지 않음
- 크기·content-type·method·origin·Unicode/control-character 검증

공유 payload:

- allowlist field만 허용
- 1–100곡
- canonical JSON ≤96KiB
- raw request ≤128KiB
- server가 시간·비용을 재계산
- canonical JSON SHA-256 보관
- immutable snapshot

identifier/secret:

- versioned HMAC slug와 reservation 전략
- revoke token 256-bit CSPRNG
- idempotency key 128-bit 이상
- raw secret은 저장/로그하지 않고 비교 가능한 hash만 보관

Supabase:

- browser가 Supabase에 직접 접근하지 않는다.
- public/anon/authenticated/service_role의 direct table grants를 0으로 만든다.
- 정확히 allowlist된 security-definer function만 사용한다.
- function owner는 `NOLOGIN`, `search_path`는 빈 값, statement/lock/idle timeout을 건다.
- old key는 실제 staging에서 `401`, valid BFF path는 성공하는지 검증한다.
- 정적 SQL review나 mock 200을 실제 ACL PASS로 승격하지 않는다.

Turnstile:

- server-side Siteverify
- expected action, hostname, timestamp, single-use 검증
- create: IP HMAC 기준 10/hour, 30/day
- revoke: 60/hour, 200/day
- secret/IP/token 원문 log 금지

공유 lifecycle:

- 기본 TTL 30일
- revoke 가능
- 정확한 slug로만 접근
- missing/expired/revoked는 enumeration을 막는 generic 화면
- pg_cron 등으로 매일 만료 정리
- scheduler 실제 등록·관찰 전에는 production PASS 금지

보안 header:

- CSP는 report-only 관찰 후 enforce
- `Permissions-Policy`: camera, microphone, geolocation, payment, usb 등 불필요 기능 차단
- web-share는 self
- `Referrer-Policy: no-referrer`
- 공유 URL/검색어가 analytics/referrer에 누출되지 않도록 검증

공식 참고:

- Supabase API keys: `https://supabase.com/docs/guides/getting-started/api-keys`
- Turnstile server validation: `https://developers.cloudflare.com/turnstile/get-started/server-side-validation/`

---

## 11. 공유 UX와 저장소 handoff

링크 공유 전에는 다음을 한 화면에서 고지한다.

- unlisted 링크라는 점
- 링크를 받은 사람이 볼 수 있다는 점
- 30일 뒤 만료된다는 점
- 공유 순간의 immutable snapshot이라는 점
- 철회 capability가 이 기기 저장소에 있다는 점

Web Share API는 user activation을 잃지 않게 설계한다.

1. 첫 click에서 preflight 설명과 payload 준비 상태를 확인한다.
2. 실제 두 번째 동기 click handler 안에서 바로 `navigator.share()`를 호출한다.
3. Promise resolve를 “상대에게 전송 완료”라고 말하지 않는다. OS 공유창 처리가 끝난 것뿐이다.
4. `AbortError`는 조용히 취소 처리한다.
5. 미지원/실패 시 링크 복사 fallback을 제공한다.
6. PNG 저장은 링크 공유와 별도 action이다.

수신/가져오기:

- `/s/[slug]`는 읽기 전용 SSR 공유 화면이다.
- `내 앱에 가져오기`는 기존 로컬 초안을 덮어쓸 수 있으므로 preflight와 명시적 확인이 필요하다.
- 원본 snapshot과 local copy의 관계를 동기화로 표현하지 않는다.
- Kakao WebView → 외부 브라우저/PWA 이동 시 `import` handoff를 사용한다.
- `/import`가 받는 입력은 canonical origin의 정확한 `/s/<22-char-base64url>` URL 또는 raw 22자 slug뿐이다.
- URL 해석과 allowlist 검증은 client에서 하고, protocol/host/port/path가 canonical 계약과 다르면 거부한다. 임의 URL을 server에 보내 fetch하게 하거나 redirect를 따라가게 하지 않는다.
- client는 `[A-Za-z0-9_-]{22}`로 normalize한 slug만 exact BFF lookup에 전달한다. 응답 snapshot을 동일 schema/size/Unicode 규칙으로 다시 검증한 뒤 Dexie transaction으로 import한다.
- 별도 one-time import token이나 새 protocol은 위 단순 경로가 실제 iOS/Android/Kakao 실기기에서 실패했다는 증거와 사람의 제품·보안 결정이 있을 때만 `UNKNOWN_RESOLUTIONS.md`에서 검토한다.
- overwrite, duplicate import, expired/revoked, offline, app-not-installed, return-to-WebView를 각각 테스트한다.

---

## 12. PWA, offline, update 계약

- installable manifest, 검수된 아이콘, theme/background color, standalone display를 구현한다.
- iOS meta와 safe-area를 검증한다.
- local draft/plan 편집은 offline에서 동작한다.
- offline shell은 제어된 정적 shell만 제공한다.
- 다음은 service worker cache에서 제외한다.
  - `/s/*`
  - `/api/*`
  - OG 이미지 endpoint
  - 검색 결과
  - 공유 생성/철회 mutation
- 공유 URL과 개인 snapshot을 runtime cache에 넣지 않는다.
- waiting worker는 사용자 승인 후 활성화한다.
- `skipWaiting`과 자동 reload로 작성 중 초안을 날리지 않는다.
- update 적용 전 로컬 write flush, revision 확인, 복구 경로를 제공한다.
- storage persistence는 best-effort로 설명하고 백업을 약속하지 않는다.

---

## 13. 시각 디자인 정본: Session Strip / CUTLINE

제품 전체는 한 물성으로 이어져야 한다.

```text
Search Ledger → Working Strip → Issued Ticket
```

서로 다른 카드 앱 세 화면이 아니라 같은 세션 종이가 채워지고 계산되고 발권되는 생명주기다.

핵심 색 역할:

| 역할 | light 기준 |
|---|---|
| canvas | `#FDF6F9` |
| paper | `#FFFFFF` |
| ink | `#1C1622` |
| action fill | `#FF2E74` |
| action text/accent | `#D3155B` |
| money | `#995F00` |

dark mode는 `VISUAL_MOTION_DIRECTION.md`의 semantic mapping을 정확히 구현한다.

색 의미:

- rose: 행동과 진행
- ochre: 금액과 비용
- ink: 정보와 구조
- 상태 전달은 색만 쓰지 않고 text/icon/pattern을 함께 사용

형태 원칙:

- Strip, 1px rule, 주요 경계의 1.5px perforation, 제한된 registration mark
- 기본 radius 8–12px, hero TicketCard만 20px
- full pill은 chip/segmented track/icon hit area에만 허용
- primary button을 pill로 만들지 않음
- 한 view에서 강한 raised surface 최대 1개
- 정보 구분은 먼저 spacing과 rule, 마지막에 제한된 shadow
- tabular number와 정돈된 좌측 정렬

금지:

- gradient, glass, glow, neon, 3D, 종이 texture
- 음표·마이크·헤드폰 등 상투적 음악 심볼을 브랜드 장식으로 남발
- 카드 stack, 모든 섹션에 shadow, pill primary CTA
- confetti, bounce, shake, count-up animation
- AI가 만든 raster를 제품 아이콘이나 최종 UI 조각으로 그대로 출하
- 실재 노래방 기기 UI를 모사해 복잡하게 만들기

자산 규칙:

- 컨셉 PNG는 reference-only다.
- 프로덕션 UI는 semantic HTML/CSS와 사람이 검수한 SVG로 재구성한다.
- 현재 문서가 참조하는 `session-strip-concept-board.png`가 없고 실제 `docs/design/assets/최종.png`가 대응 자산으로 확인됐다. 구현 시 원본을 보존하고 byte-identical 영문 alias를 추가한 뒤 hash 동일성을 검증한다.
- logo/icon은 작은 크기, dark, forced-colors, maskable safe zone에서 사람이 검수한다.

---

## 14. 레이아웃, Base UI, 접근성

breakpoint:

- compact: `<360px`
- phone: `360–599px`
- tablet: `600–899px`
- wide: `≥900px`

검증 범위:

- 320–1440px
- 200% text
- 400% zoom/reflow
- light/dark
- forced colors
- portrait/landscape
- safe area
- software keyboard
- 1곡/24곡/100곡

구성:

- ActionDock tap target 높이 최소 52px
- 동시에 열린 bottom overlay는 하나의 `BottomSlot`만 허용
- BottomSlot은 최대 `25dvh`, 키보드가 열리면 in-flow로 이동해 필드를 가리지 않음
- Base UI primitive를 사용하고 custom focus trap을 만들지 않음
- pricing 선택은 tabs가 아니라 radiogroup
- Ticket은 semantic `<article>`, heading, `<dl>` 구조
- icon-only action에는 accessible name
- drag-only reorder 금지, 명시적 up/down button 제공
- focus ring을 clipping하지 않음
- 오류는 field association과 summary/focus 이동을 모두 제공
- screen reader live region은 중복·과도한 발표를 피함

WCAG 2.2 AA를 목표로 하고 axe Critical/Serious 0을 필수로 한다. 자동 도구만으로 접근성 PASS를 선언하지 않는다.

---

## 15. 모션 계약

motion token:

| token | duration |
|---|---:|
| press | 80ms |
| fast | 120ms |
| state | 160ms |
| route | 180ms |
| sheet-in | 260ms |
| sheet-out | 180ms |
| ticket | 360ms |

규칙:

- production animation은 주로 transform과 opacity만 사용한다.
- layout thrash를 만드는 width/height/top/left 연속 animation을 피한다.
- route transition과 ticket issuance motion을 겹치지 않는다.
- press는 작은 시각 피드백이며 bounce/pop 효과로 만들지 않는다.
- `MotionConfig reducedMotion="user"`와 `useReducedMotion()`를 적용한다.
- reduced motion에서는 이동·회전을 제거하고 opacity 변화만 허용한다.

티켓 발권 모션:

```text
reserved slot은 처음부터 고정
y: 24px → 0
opacity: 0 → 1
rotate: -0.6deg → 0deg
duration: 360ms
```

- layout shift 없이 고정 slot에서 나타난다.
- Dexie의 `lastAnimatedRevision` CAS로 동일 발권 revision당 정확히 한 번만 재생한다.
- reload, back, 새 tab, 엄격 모드 double effect에서 중복 재생하지 않는다.
- 같은 발권 revision의 TicketArtworkModel/snapshot은 reload, multi-tab, PNG, 링크 공유에서 byte-equivalent canonical payload를 사용한다.
- reduced motion은 opacity-only 160ms 이하 또는 즉시 표시다.
- 테스트는 duplicate 0, long task >50ms target 0, 4x CPU slowdown에서도 입력 응답성을 본다.

---

## 16. Ticket, PNG, OG

- TicketCard, private PNG, server OG는 같은 `TicketArtworkModel`과 token을 사용한다.
- private PNG: 1080×1350
- OG: 1200×630
- PNG는 기기에서 생성하며 서버에 업로드하지 않는다.
- 배경·font·SVG가 완전히 준비된 뒤 capture한다.
- 실패 시 원인을 설명하고 재시도/텍스트 공유를 제공한다.
- QR은 실제 공개 URL이 있고 권리·보안 검토가 된 경우에만 넣는다. local/private state를 가리키는 가짜 QR 금지다.
- 공유 OG에 private/revoke 정보, 검색어, 불필요한 상세를 넣지 않는다.
- 긴 제목, 다국어, emoji, 1/24/100곡, dark, 200% text에서 잘림을 검증한다.

---

## 17. 분석, 개인정보, 운영

- analytics는 최소수집·allowlist event만 사용한다.
- 곡 제목, 가수, 검색어, 공유 URL, slug, revoke token, IP, raw payload를 보내지 않는다.
- 설치 프롬프트 결과, 첫 곡 추가, valid calculation, ticket issue, share sheet open/cancel 같은 상태도 개인을 재식별하지 않는 집계로만 수집한다.
- child/teen 대상은 추적·광고 SDK를 기본 금지하고 법적 검토 전 analytics를 가장 보수적으로 구성한다.
- crash report에도 payload scrubber를 적용한다.
- 운영 runbook은 provider 장애, 잘못된 catalog publish, 공유 abuse, key rotation, scheduler failure, rollback, takedown을 포함한다.
- 비밀키는 저장소/클라이언트/스크린샷/로그에 남기지 않는다.

10–13세 관련 법률 검토 참고 출발점:

- 대한민국 개인정보 보호법 관련 조문: `https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=02&joNo=0022&lsiSeq=270351&urlMode=lsScJoRltInfoR`

법률 링크는 법률 자문을 대체하지 않는다.

---

## 18. 멀티에이전트 운영: 9개 파동, 최대 27개 전문 과업

동시 슬롯 4개 기준으로 총괄 1명 + 전문 에이전트 3명을 유지한다. 완료된 reviewer는 다음 파동 reviewer로 교체한다. 이는 최대한 많은 에이전트를 쓰되 파일 충돌과 증거 오염을 막기 위한 구조다.

| 파동 | Agent A | Agent B | Agent C | 총괄 통합 결과 |
|---|---|---|---|---|
| 0 정본/기반 감사 | 정본·unknown·충돌 감사 | repo/toolchain/dirty-state 감사 | 디자인·자산·접근성 정본 감사 | 구현 계약과 파일 소유권 |
| 1 핵심 기반 | 계산/Dexie 모델 reviewer | design system/Base UI reviewer | Supabase/API/security reviewer | scaffold·domain skeleton |
| 2 로컬 여정 | home/calculator reviewer | search/manual-add/IME reviewer | ticket/PNG reviewer | 첫 로컬 vertical slice |
| 3 연결 흐름 | share/revoke reviewer | `/s`/import/Kakao reviewer | PWA/offline/update reviewer | 공유와 handoff slice |
| 4 자동 검증 | property/CAS oracle | API/DB security/fault auditor | E2E/visual matrix auditor | 자동 gate |
| 5 전문 품질 | visual integrity auditor | motion/performance auditor | a11y/responsive auditor | 디자인 품질 수정 |
| 6 UX 검증 | organizer persona tester | recipient/handoff tester | copy/error-recovery tester | MOCK_ONLY findings와 연구 준비 |
| 7 출시 운영 | bundle/perf auditor | backup/monitoring/runbook auditor | catalog rights/privacy/legal auditor | 운영·외부 blocker gate |
| 8 fresh final | product trace auditor | security red-team auditor | design/motion/a11y fresh auditor | 독립 최종 감사 |

에이전트 규칙:

- 각 과업에 concrete scope, 입력 파일, base hash, 반환 형식, 종료 조건을 준다.
- reviewer는 기본 읽기 전용이며 finding, severity, evidence path, 재현 명령, 권장 patch만 반환한다.
- 총괄이 공통 파일에 patch를 통합한다.
- 다른 에이전트가 작업 중인 파일을 만지지 않는다.
- dependency/lockfile/migration/service-worker/golden set/Git은 총괄 전용이다.
- 각 파동 종료 시 Critical/High 0 또는 명시적 blocker가 아니면 다음 파동으로 가지 않는다.
- 이전 reviewer에게 fresh audit를 맡기지 않는다.
- 에이전트 답변 자체는 PASS 증거가 아니다. 총괄이 독립 재현한다.

---

## 19. Stage 0–10 구현 순서와 종료 조건

### Stage 0 — 실행 소유권, fingerprint, 계약 동결

구현:

- repo/environment 재측정
- 모든 Markdown 완독 원장
- active-run lock 확보
- `RUN_STATE.md`, `IMPLEMENTATION_CONTRACT.md`, `REQUIREMENTS_TRACE.md`, `CONFLICT_REGISTER.md` 생성
- toolchain·권한·외부 blocker inventory
- 정본과 현재 파일의 working-tree fingerprint

종료 조건:

- 기존 사용자 변경 보존 확인
- 요구사항 ID와 정본 source 연결
- blocker가 있어도 가능한 local scope 정의

### Stage 1 — scaffold와 디자인/오류 기반

구현:

- 정확히 pin된 Next/React/TypeScript/Tailwind/Base UI scaffold
- lint/typecheck/unit/build script
- semantic tokens, typography, spacing, focus, error boundary
- route skeleton과 responsive shell
- 영문 자산 alias/hash 검증

종료 조건:

- clean install 재현 가능
- empty route가 320–1440px에서 동작
- production dependency와 lifecycle audit 기록

### Stage 2 — 로컬 핵심 계획

구현:

- Dexie schema/revision
- 단일 plan, 직접 추가, reorder, delete/undo, 최대 100
- Working Strip
- calculator input와 local persistence

종료 조건:

- reload/multi-tab/limit/keyboard/a11y unit+E2E
- 데이터 손실 0

### Stage 3 — catalog ingest와 검색

구현:

- provider interface와 Fixture/Manana/TJ/KY adapter skeleton
- quarantine/diff/publish/rollback pipeline
- production rights gate
- own catalog search BFF
- IME/debounce/abort/sequence/manual add

종료 조건:

- fixture contract PASS와 `TEST DATA` 표시
- upstream rights 없으면 production catalog 명시적 BLOCKED
- live provider 응답을 runtime user query로 proxy하지 않음

### Stage 4 — 계산과 역산

구현:

- 순수 forward 함수
- 표시 rounding 분리
- reverse 최대 prefix
- oracle/property/boundary tests

종료 조건:

- 동일 함수를 UI/server/share에서 사용
- 모든 경계·불변식 PASS

### Stage 5 — semantic ticket와 발권 모션/PNG

구현:

- TicketArtworkModel
- semantic TicketCard
- CAS 1회 발권 모션
- reduced-motion
- private 1080×1350 PNG

종료 조건:

- 동일 revision 중복 모션 0
- screenshot/PNG matrix 시각 검수
- long task target 충족

### Stage 6 — 공유/철회 backend

구현:

- migration, direct grant 0, definer functions
- share/revoke/expiry/idempotency
- Turnstile/rate limit/request ID
- payload canonicalization/server recompute

종료 조건:

- 실제 local Supabase contract 및 fault injection
- mock/static evidence만 있으면 staging PASS 금지

### Stage 7 — 수신/가져오기/Kakao handoff

구현:

- SSR `/s/[slug]`
- generic missing/expired/revoked
- canonical `/s/<22-char-base64url>` 또는 raw slug만 허용하는 `/import`, exact BFF lookup, schema validation, Dexie transaction, overwrite guard
- 임의 protocol/host/port/path/redirect와 server-side arbitrary URL fetch 거부
- Web Share 2-click activation-safe flow
- link copy와 PNG 별도 fallback

종료 조건:

- iOS/Android Kakao 계획과 자동 가능한 부분 PASS
- 저장소 자동 연결 가정 0

### Stage 8 — install/offline/update

구현:

- manifest/icons/install education
- controlled offline shell
- cache exclusion
- waiting-worker 승인형 update

종료 조건:

- 설치를 닫아도 핵심 여정 완료
- local draft offline edit
- `/s`, API, OG, mutation cache 0

### Stage 9 — 통합 품질과 실제 연구 준비/수행

구현:

- analytics/privacy scrub
- perf/bundle/a11y/visual/security matrix
- persona와 연구 문서
- 12개 agent walkthrough `MOCK_ONLY`
- 가능한 경우 승인된 실제 사용자/기기 세션 수행
- 발견 피드백 반영과 retest

종료 조건:

- 자동 gate green
- actual evidence가 없으면 해당 gate는 `NOT_RUN/BLOCKED`
- 사용자 피드백이 요구사항/patch/test에 trace됨

### Stage 10 — fresh 독립 감사와 handoff

구현:

- 이전 구현자와 다른 fresh agent 3명 감사
- product trace, security red team, visual/motion/a11y audit
- reproducible clean install/build/test
- readiness 판정과 human release checklist

종료 조건:

- Critical/High 0 또는 owner/unlock 조건이 명확한 blocker
- 거짓 PASS 없음
- `HANDOFF.md`에서 local/staging/production 가능 범위를 분리

---

## 20. 실행 잠금, checkpoint, 재개 규칙

동시에 여러 세션이 저장소를 쓰지 못하게 `ACTIVE_RUN.lock/` directory를 atomic create한다.

- owner에는 `schemaVersion`, CSPRNG `runId`/`ownerNonce`, PID, process start, hostname, `startedAt`, `heartbeatAt`, owned process/port를 기록한다.
- heartbeat는 owner nonce를 다시 확인한 뒤 atomic replace한다.
- lock이 살아 있거나 다른 host/PID 상태가 불명확하면 persistent write를 하지 않고 `BLOCKED + ENVIRONMENT`로 멈춘다.
- stale takeover는 별도 `ACTIVE_RUN.takeover.lock/`, 동일 host의 죽은 PID, 다른 process start, 10분 초과 heartbeat 등 정본의 모든 조건과 증거가 있을 때만 한다.
- 불명확한 다른 host lock은 사람 승인 없이 탈취하지 않는다.
- 종료 시 owner nonce가 정확히 일치할 때만 lock을 제거한다.

`RUN_STATE.md`는 checkpoint pointer이며 유일 원본처럼 과신하지 않는다.

필수 필드:

```text
schemaVersion
runId
currentStage
latestCheckpointHash
lastGreenCheckpointHash
workingTreeFingerprint
environmentDigest
buildCapability
productionGate
nextAction
```

각 Stage boundary에서 `test-results/<run-id>/checkpoints/<seq>/` immutable checkpoint를 만들고 다음을 hash chain으로 보존한다.

- source manifest
- 상태 문서 byte hash
- evidence index와 file hash
- environment subject/digest
- volatile evidence의 `observedAt`, `validUntil`, `revalidatePolicy`
- previous checkpoint hash

재개 시 최신 valid checkpoint를 scan하고 `RUN_STATE.md`와 다르면 checkpoint를 정본으로 삼아 `STATE_DIVERGED`를 기록한다. 환경 digest 또는 volatile subject가 바뀌면 이전 PASS를 자동 재사용하지 않고 필요한 gate를 다시 실행한다.

---

## 21. UX 연구와 피드백 문서화

### 21.1 에이전트 시뮬레이션

실제 사용자 모집 전 12개 시나리오를 수행한다.

- P-ORG: 연령 cohort와 iOS/Android를 섞은 4개
- P-REC: Kakao iOS/Android와 설치 안 함을 섞은 3개
- P-HANDOFF: WebView→Safari/Chrome/PWA, overwrite/expired를 섞은 3개
- P-SOLO/접근성 edge: 2개

모든 결과의 evidenceLevel은 `MOCK_ONLY`다. 발견된 문제는 재현 step, severity, affected requirement, proposed change, patch, retest 결과로 기록한다.

### 21.2 실제 연구 계획

- discovery interview 16명
  - 각 14–18/19–24/25–29/30–39 cohort마다 organizer 2, recipient 1, solo control 1
- usability 32명
  - 각 cohort organizer 5, recipient 3
  - organizer: iOS 10, Android 10
  - install-first 8, web-first→install 8, web-only 4
  - recipient: iOS Kakao 6, Android Kakao 6
- 보조기술 3명
  - NVDA/Chrome
  - VoiceOver/Safari
  - TalkBack/Chrome
- 수정 후 fresh retest 12명
- field calibration 실제 노래방 방문 10회부터 시작, 정확도 주장 전 30회

10–13세는 보호자 동의/법무/연구윤리 절차가 준비된 별도 protocol이 있을 때만 추가한다.

### 21.3 성공 기준

- organizer 20명 중 ≥18명 전체 성공, 각 cohort 5명 중 ≥4명 성공
- 성공 정의: 무도움, 3곡 이상, 유효 계산, 120초 이내 티켓 발권
- recipient 12명 중 ≥10명이 5초 노출 후 곡 수·시간·비용 범위를 회상
- import 12명 중 ≥11명 무도움 완료, 전원이 저장소/복사 의미를 이해
- false success, data loss, silent overwrite 0
- duplicate ticket motion 0
- group test 5개에서 각각 의사결정 4개 이상 관찰
- field calibration median MAPE ≤15%
- 실제 시간이 표시 범위 안에 드는 비율 ≥80%

### 21.4 필수 연구 문서

```text
docs/research/PERSONAS_AND_RECRUITMENT.md
docs/research/USABILITY_TEST_PROTOCOL.md
docs/research/CONSENT_PRIVACY_PROTOCOL.md
docs/research/EVIDENCE_LEDGER.md
docs/research/USABILITY_FINDINGS.md
docs/research/USABILITY_RETEST_REPORT.md
docs/research/FIELD_CALIBRATION.md
docs/research/templates/SESSION_NOTES.md
docs/research/AGENT_SIMULATION_FEEDBACK.md
```

개인 식별 정보, 원본 녹화, 서명 동의서는 Git 밖의 승인된 보관소에 둔다. repo에는 비식별 session ID, 집계, finding, 결정, patch link만 남긴다.

실제 참가자나 실기기가 없으면 문서 틀·모의 walkthrough·모집/진행 protocol까지 완성하고 actual 결과는 `NOT_RUN/BLOCKED`로 둔다. 빈 표를 PASS로 해석하지 않는다.

---

## 22. 자동/수동 검증 매트릭스

기준 명령:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm supabase:start
pnpm supabase:reset
pnpm test:contract
pnpm test:e2e
pnpm test:a11y
pnpm test:visual
pnpm build
pnpm verify:demo
pnpm verify:release
pnpm verify:staging -- --origin <origin>
```

실제 script명은 구현과 일치하게 만들고 `pnpm run`에서 발견 가능해야 한다.

자동 검증:

- unit/property/oracle: 계산, normalization, canonical JSON, reverse
- Dexie: migration, revision CAS, multi-tab, 100 limit
- API contract: size, Unicode, idempotency, expiry, revoke, rate limit, error envelope
- DB security: grants/functions/search_path/timeouts/old key
- fault injection: DB/provider/Turnstile/scheduler/network failure
- Chromium/WebKit E2E
- axe
- visual regression
- PWA cache/update/install checks
- bundle/performance budget

screenshot matrix:

```text
320×568
390×844
768×1024
1440×900
```

각 viewport에서:

- light/dark/reduced-motion/forced-colors
- 200% text/400% zoom
- empty/1/24/100 songs
- invalid calculator
- offline
- IME composing
- ticket issuing/issued
- share/import/missing/expired/revoked
- keyboard open/safe area

실기기:

- iOS Safari와 standalone PWA
- Android Chrome + Gboard
- Samsung Internet
- Kakao iOS/Android WebView

성능 provisional budget:

- home route JS gzip ≤170KiB
- cold/warm 각 5회 이상 측정
- ticket motion 4× CPU slowdown
- ticket issuance 중 >50ms long task target 0
- layout shift와 interaction latency를 evidence와 함께 기록

---

## 23. 필수 구현/검증 문서 산출물

저장소 루트 또는 정본이 지정한 위치에 다음을 만든다.

```text
RUN_STATE.md
MD_READ_LEDGER.md
IMPLEMENTATION_CONTRACT.md
REQUIREMENTS_TRACE.md
CONFLICT_REGISTER.md
UNKNOWN_RESOLUTIONS.md
DECISIONS_LOG.md
VERIFICATION_REPORT.md
HANDOFF.md
TOOLCHAIN_LOCK.md
docs/verification/TEST_PLAN_V3.md
docs/verification/QA_MATRIX_V3.md
docs/catalog/CATALOG_RIGHTS.md
docs/catalog/INGESTION_RUNBOOK.md
docs/catalog/PROVENANCE.md
docs/catalog/TAKEDOWN.md
```

기존 `TEST_PLAN.md`와 `QA_MATRIX.md`는 이력으로 보존한다. 새 검증은 `_V3` 문서에 쓴다.

각 검증 record:

```text
requirementId
testResult: PASS | FAIL | BLOCKED | NOT_RUN
evidenceLevel: AUTOMATED | MANUAL | STATIC_ONLY | MOCK_ONLY | NONE
blockerKind: EXTERNAL_AUTHORITY | ENVIRONMENT | TECHNICAL | PRODUCT_DECISION | null
featureDisposition: REQUIRED | DEFERRED_APPROVED | OUT_OF_SCOPE
buildSha
workingTreeFingerprint
environmentDigest
command
exitCode
observedAt
validUntil
evidencePath
owner
unlockCondition
```

증거는 `test-results/<run-id>/`에 저장하고 채팅 설명만을 증거로 사용하지 않는다.

---

## 24. readiness 상태 머신

```text
NOT_READY
→ LOCAL_WEB_CORE_READY
→ LOCAL_DEMO_READY
→ STAGING_READY
→ PRODUCTION_CANDIDATE
```

별도 `productionGate`는 `BLOCKED | READY_FOR_HUMAN_RELEASE`다.

승격 규칙:

- `LOCAL_WEB_CORE_READY`: 로컬 계획/계산/티켓 core와 자동 테스트 green
- `LOCAL_DEMO_READY`: fixture 검색, 공유 local adapter, PWA demo, visual/a11y 자동 gate green
- `STAGING_READY`: 실제 Supabase, keys, domain, Turnstile, scheduler, OG, DB ACL가 staging에서 검증됨
- `PRODUCTION_CANDIDATE`: production-like 환경, catalog 권리/정확도, 실기기, actual user research, 운영 runbook, fresh audit까지 증거가 있음
- 사람 승인 전 `RELEASED` 금지

다음 중 하나라도 없으면 최대 `LOCAL_DEMO_READY + BLOCKED`다.

- production catalog 권리와 정확도 evidence
- Supabase/Vercel/domain/Turnstile/scheduler 운영 권한
- 실제 iOS/Android/Kakao evidence
- 승인된 실제 사용자 연구
- privacy/legal/ops 승인
- backup/rollback/monitoring/takedown 준비

---

## 25. blocker가 있을 때의 안전한 기본 행동

| blocker | 계속 수행할 일 | 금지되는 승격 |
|---|---|---|
| catalog 권리 없음 | adapter, fixture, quarantine, diff, tests, rights manifest 틀 | release catalog, production candidate |
| Supabase/도메인/Turnstile 없음 | local DB adapter, migration, contract tests, deploy config | staging ready |
| Docker daemon/CLI 없음 | pure unit/E2E mock separation, migration static preparation | actual DB security PASS |
| 참가자 없음 | protocol, persona, MOCK_ONLY walkthrough, research tooling | actual UX PASS |
| 실기기 없음 | browser automation, device matrix 준비 | device PASS |
| 네트워크 없음 | local code/docs/tests, dependency plan | clean install/build PASS |
| 사람 결정 없음 | 가장 보수적인 공개성·개인정보·비용 기본값 | 범위 확대 또는 위험한 공개 |

같은 수정 시도는 같은 증거로 무한 반복하지 않는다. 동일 접근은 증거 기반 재시도 2회까지만 하고, 계속 실패하면 재현 명령·원인 가설·owner·unlock 조건과 함께 `FAIL` 또는 `BLOCKED`로 전환해 다른 안전한 slice를 진행한다. 동일 blocker 때문에 세 번 이상 연속 세션에서 진전이 전혀 불가능할 때만 장기 blocked 상태를 선언한다.

---

## 26. 최종 fresh audit 체크리스트

### 제품/흐름

- [ ] 설치하지 않아도 핵심 여정 완결
- [ ] 설치/첫 실행/첫 곡/계산/발권/공유가 끊기지 않음
- [ ] 최대 100곡, 단일 plan, 허용 route만 존재
- [ ] 금지 기능이 조용히 추가되지 않음
- [ ] 계산과 역산이 동일 함수 사용

### catalog

- [ ] 사용자가 대량 row를 직접 준비할 필요 없음
- [ ] provider/runtime 경계 분리
- [ ] rights manifest 없이는 production publish 불가
- [ ] golden 200, 정확도, diff, rollback, takedown 증거
- [ ] 가사/음원/앨범아트 미수집

### 보안/공유

- [ ] browser direct Supabase 0
- [ ] direct grants 0과 definer allowlist 실제 검증
- [ ] raw secret/IP/query/payload log 0
- [ ] share immutable/TTL/revoke/idempotency
- [ ] Web Share user activation 보존
- [ ] `/import`는 canonical URL/raw 22자 slug만 client parse하고 arbitrary server URL fetch 0
- [ ] cache exclusion과 no-referrer

### 디자인/모션

- [ ] Search Ledger → Working Strip → Issued Ticket 일관성
- [ ] rose/ochre/ink semantic 사용
- [ ] 금지 스타일 없음
- [ ] raised surface/view ≤1
- [ ] ticket motion revision당 1회
- [ ] reduced motion에 이동·회전 없음
- [ ] reference PNG를 production UI로 출하하지 않음

### 접근성/반응형

- [ ] 320–1440, 200%, 400%, forced-colors, safe area, keyboard
- [ ] Base UI semantics, focus, radiogroup, article/dl
- [ ] up/down reorder
- [ ] axe Critical/Serious 0 + manual assistive-tech evidence

### 증거 정직성

- [ ] MOCK_ONLY와 actual 분리
- [ ] static/mock DB 검증을 staging PASS로 부르지 않음
- [ ] 실행하지 않은 검증 `NOT_RUN`
- [ ] blocker owner/unlockCondition 존재
- [ ] fresh auditor가 이전 finding을 독립 재현
- [ ] `RELEASED` 선언 없음

---

## 27. 다른 세션의 정확한 시작 절차

1. 저장소 루트가 `C:\Users\agape\Desktop\코딩\singsong`인지 확인한다.
2. `git status --short --branch`, branch, HEAD, 전체 파일 inventory, 도구 버전을 읽는다.
3. `ACTIVE_RUN.lock/`와 `RUN_STATE.md`를 읽는다.
4. lock이 없고 쓰기 권한이 있으면 원자적으로 소유권을 얻는다. 살아 있는 lock은 임의 탈취하지 않는다.
5. 이 문서를 포함한 모든 Markdown을 완독하고 `MD_READ_LEDGER.md`를 만든다.
6. 정본 다섯 개와 우선순위를 다시 확인한다.
7. working-tree fingerprint, environment digest, Stage 0 checkpoint를 만든다.
8. 총괄 writer와 read-only reviewer 3명을 파동 0에 배치한다.
9. 외부 blocker를 기록하되 가능한 local implementation을 시작한다.
10. 각 Stage를 구현→검증→독립 감사→checkpoint 순으로 닫는다.
11. 이전 세션의 PASS는 source/environment/evidence freshness가 일치할 때만 재사용한다.
12. 마지막에 `HANDOFF.md`와 `VERIFICATION_REPORT.md`를 실제 결과로 갱신한다.

---

## 28. 종료 보고 형식

최종 응답은 짧게 꾸미지 말고 다음을 정확히 보고한다.

```text
buildCapability: ...
productionGate: ...
branch/head/fingerprint: ...

Stage 0–10:
- status
- 실제 구현 기능
- 실행한 검증과 evidence path
- 남은 blocker와 owner/unlock condition

품질:
- 계산
- catalog 정확도/권리
- 보안
- visual/motion
- accessibility/responsive
- performance
- device
- UX research/retest

Critical: n
High: n
NOT_RUN: ...

Local에서 가능한 것: ...
Staging에서 가능한 것: ...
Production 전에 필요한 사람 승인: ...

핵심 산출물 링크:
- HANDOFF.md
- VERIFICATION_REPORT.md
- REQUIREMENTS_TRACE.md
- USABILITY_FINDINGS.md
```

실패, 미실행, 외부 승인 대기를 성공처럼 요약하지 않는다. 사용자가 다음 세션에서 바로 재개할 수 있게 정확한 다음 명령과 가장 최신 green checkpoint를 남긴다.

---

## 29. 흔한 실패를 금지하는 마지막 경고

- dirty worktree를 scaffold/reset으로 지우지 말 것.
- 새 handoff가 기존 정본을 조용히 덮어쓰지 말 것.
- API가 열려 있다는 이유로 곡 데이터를 production에 복제하지 말 것.
- Manana/TJ/KY row를 권리 manifest 없이 seed하지 말 것.
- 같은 파일을 여러 에이전트가 동시에 수정하지 말 것.
- agent persona walkthrough를 실제 사용자 검증으로 보고하지 말 것.
- 10–13세를 보호자 동의 없이 모집하지 말 것.
- local endpoint 200이나 SQL 정적 review를 실제 Supabase 보안 PASS로 부르지 말 것.
- `navigator.share()` 전에 비동기 작업을 끼워 user activation을 잃지 말 것.
- Kakao/Safari/PWA IndexedDB가 이어진다고 가정하지 말 것.
- service worker 기본 cache에 공유/API/OG를 넣지 말 것.
- `skipWaiting`으로 작성 중 draft를 자동 reload하지 말 것.
- reference PNG를 제품 UI/아이콘으로 그대로 출하하지 말 것.
- reduced-motion에서 이동/회전을 남기지 말 것.
- catalog/계정/실기기 blocker 때문에 구현 가능한 local vertical slice까지 중단하지 말 것.
- blocker가 있는데 `PRODUCTION_CANDIDATE`, `READY`, `RELEASED`를 과장하지 말 것.
- checkpoint와 환경 digest 없이 다른 세션의 PASS를 재사용하지 말 것.

이제 계획을 다시 요약하는 데서 멈추지 말고 Stage 0부터 실행하라. 모든 변경은 작고 검증 가능하게 만들고, 사용자 작업을 보존하며, 디자인·모션·접근성·catalog 권리·증거 정직성을 동일한 출시 조건으로 취급하라.
