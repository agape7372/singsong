# TEST_PLAN.md — 테스트 정본

> **v3 레거시 경고 (2026-07-21)**: 시나리오 참고용이다. BUILD_PLAN의 잘못된 계산 벡터, mock RLS/정적 a11y 대체, Lighthouse PWA pass는 폐기됐다. [`../FINAL_BLUEPRINT.md`](../FINAL_BLUEPRINT.md) §4·§10과 원샷 v3를 따른다.

> **정본 범위**: 테스트 종류(단위·계약·e2e·시각·a11y·성능) · 시나리오 전문(정상+비정상) · 시드 데이터 의존성 목록 · 검증 리포트 형식 · 실패 프로토콜.
> 계산 규칙·테스트 벡터 값 자체는 여기 없다 — `BUILD_PLAN.md §6-3`을 그대로 실행할 뿐이다(값 복사 금지, README §3).
> **버전**: v1.0 · 2026-07-21 · 짝 문서: [`QA_MATRIX.md`](./QA_MATRIX.md)(품질 매트릭스 정본)

---

## 0. 이 문서의 용도

`BUILD_PLAN.md §15`(기능 동작 검증 프로토콜)를 승계·확장한다. `prompts/ONESHOT_MASTER.md` Phase 8이 이 문서를 **실제로 실행**하는 단계이며, Phase 8.5(`QA_MATRIX.md`)는 이 실행 결과를 코드 근거로 채점한다. 이 문서는 "무엇을, 어떤 순서로, 어떤 증거와 함께 검증하는가"의 정본이다.

---

## 1. 원칙 (BUILD_PLAN §15 승계)

1. **컴파일/타입 통과 ≠ 동작.** `tsc`·`eslint` 통과는 최소 조건일 뿐 완료조건이 아니다.
2. **실행 증거 필수.** Vitest 로그, Playwright 리포트, 스크린샷 파일 경로를 첨부한다. 서술만으로 "통과"는 인정하지 않는다.
3. **실패는 실패로 보고 → 수정 → 재실행.** 실패를 숨기거나 조건을 완화해 우회하지 않는다.
4. **실서버 키가 없어 못 도는 부분은 "로컬/모의 대체 검증"임을 명시한다.** 예: Kakao JS 키 없이는 실제 카톡 공유를 못 열어보므로 "SDK 호출까지 확인, 실제 카톡 앱 렌더는 미검증(키 필요)"처럼 정직하게 구분한다. **가짜 통과 금지** — 이 규칙 위반이 발견되면 해당 Phase 전체를 재검증 대상으로 본다.

---

## 2. 단위 테스트 (Vitest)

### 2-1. 계산 엔진 (`test/calc.test.ts`)

정본: `BUILD_PLAN.md §6-3`(테스트 벡터 표). 이 문서는 값을 복사하지 않고 실행 절차만 정의한다.

- `BUILD_PLAN.md §6-3`에 나열된 벡터를 **1행 = 1 `it()` 블록**으로 1:1 구현한다. 벡터가 추가되면 `BUILD_PLAN.md`를 먼저 갱신하고 여기서는 "벡터 수 = 테스트 케이스 수" 일치만 확인한다.
- 커버리지 목표: `lib/calc.ts` 100%(순수 함수라 예외 없음).
- 부동소수점 반올림 함수(`round`, `ceil`, `floor`)는 음수·0 입력에 대한 경계 케이스를 벡터 표에 없더라도 최소 1건씩 추가한다(예: `people=0`은 `max(people,1)`로 방어되는지).

### 2-2. 초성 유틸 (`test/chosung.test.ts`)

정본: `engineering/PLATFORM_NOTES.md`의 엣지 표 — **다만 그 표는 "어떤 문자가 어떻게 처리돼야 하는가"의 규칙 정본이고, 아래 케이스 목록은 이 문서(`TEST_PLAN.md`)가 정본이다**(지시사항 원문). `PLATFORM_NOTES.md`가 아직 작성되지 않은 시점에는 아래를 잠정 케이스 목록으로 삼고, 문서 작성 후 규칙과 어긋나면 `PLATFORM_NOTES.md`를 우선하되 이 표를 갱신한다(`기획 확인 필요`).

| # | 입력 | 기대 동작 | 근거 |
|---|---|---|---|
| 1 | `"밤편지"` | `"ㅂㅍㅈ"` | 완성형 한글 3음절 → 초성 3개 |
| 2 | `"IU"` | `"IU"`(영문 그대로 통과) | 초성 추출 대상 아님, 원문 유지 |
| 3 | `"2NE1"` | `"2NE1"`(숫자·영문 혼합 그대로) | 노래방 번호·영문 그룹명 검색 대비 |
| 4 | `"밤 편지"`(공백 포함) | `"ㅂ ㅍㅈ"` — **공백 위치 보존(확정)**. `songs.chosung` 자체가 title+artist를 공백으로 잇는 형식(`"ㅂㅍㅈ ㅇㅇㅇ"`, API_CONTRACT §1-2)이고, PLATFORM_NOTES §2 케이스 6의 공백 토큰 분리 매치와 정합 | 케이스 7과 동일 규칙 |
| 5 | `"ㅂㅍㅈ"`(이미 초성만 입력) | 초성 검색 RPC에서 `chosung like` 매치되어야 함(추출 함수 자체는 통과 문자 그대로 반환) | `API_CONTRACT.md §2-1` chosung 매치 조건 |
| 6 | `""`(빈 문자열) | `""` 반환, 예외 없음 | 방어적 프로그래밍 |
| 7 | `"아이유 밤편지"`(가수+제목 혼합) | `"ㅇㅇㅇ ㅂㅍㅈ"`(단어 경계 유지) | `songs.chosung` 생성 규칙(`BUILD_PLAN §4-1` 주석: title+artist 초성) |
| 8 | 조합 중 문자(예: `"ㅂ"` 단독 자음, 완성 안 된 상태) | 예외 없이 해당 자모 그대로 통과 | 실시간 IME 조합 중 호출 대비 |
| 9 | 특수문자 포함(`"Just Dance!"`, `"밤편지(Live)"`) | 특수문자는 그대로 통과, 한글만 초성 변환 | 곡 제목에 괄호·느낌표 실재 |
| 10 | 매우 긴 문자열(120자, `songs.title` 최대 길이) | 성능 저하·예외 없이 처리 | `API_CONTRACT.md §1-2` title check 상한과 정합 |


### 2-3. 공유 payload 왕복 (`test/share.test.ts`)

정본: `engineering/API_CONTRACT.md §4`(Zod 스키마). 이 문서는 값을 복사하지 않고 검증 축만 정의한다.

- **왕복(직렬화→역직렬화 동등) 테스트**: `listItemSnapshotSchema` 유효 객체 1개를 `JSON.stringify` → `JSON.parse` → `schema.parse()`한 결과가 원본과 `deep-equal`인지 확인. `sharedPayloadSchema`(배열, 1~100개)도 동일하게 왕복.
- **거부 케이스**: `API_CONTRACT.md §8` 체크리스트의 Zod 항목(`myKey:"+13"`, `tags` 6개, `memo` 101자)을 그대로 실행해 `safeParse().success === false`인지 확인. 값은 `API_CONTRACT.md §8`을 그대로 인용해 케이스로만 옮긴다(임의로 다른 값 추가 금지 — 정본이 아니므로 이 문서에서 새 경계값을 발명하지 않는다).
- **항목 단위 drop 테스트**: 배열 중 1개 항목만 스키마 위반일 때, `sharedPayloadSchema` 전체가 아니라 해당 항목만 걸러지는 로직(`lib/share.ts` 구현)이 실제로 나머지 항목을 보존하는지 확인(`API_CONTRACT.md §4` "항목 단위 실패는 해당 항목만 제외" 규칙).

---

## 3. 계약 테스트 (로컬 Supabase)

정본: `engineering/API_CONTRACT.md §8`(검증 체크리스트). 실행 환경: `supabase start`로 로컬 인스턴스 기동.

### 3-1. 절차

1. `supabase start` — 로컬 Postgres·PostgREST 기동.
2. `supabase/migrations/`를 순번대로 적용(`API_CONTRACT.md §6` 파일 규칙 준수 확인 포함).
3. `scripts/seed`로 §5(시드 데이터 의존성)의 고정 시드 곡을 upsert.
4. anon key로 클라이언트를 생성해 `API_CONTRACT.md §8`의 각 체크박스를 **순서대로** 실행:
   - `songs` INSERT/UPDATE(anon) → 거부 확인 (RLS)
   - `shared_lists` UPDATE/DELETE(anon) → 거부 확인
   - payload 101곡·33KB 초과 INSERT → CHECK 위반 확인
   - `search_songs('%')` → literal 매치 확인(이스케이프)
   - `search_songs('48210')`(시드에 포함된 예시 번호) → 1위 정렬 확인
   - 같은 검색어 2회 호출 → 순서 동일성(tie-break) 확인
   - `increment_fork('없는slug')` → 무오류 무시 확인
5. 결과를 §7 리포트 표에 기록.

### 3-2. 실서버 대체 규칙

CI 등 로컬 Supabase를 못 띄우는 환경에서는 §8 체크리스트 각 항목을 **모의(mock) Postgres 클라이언트 또는 SQL 파일 직접 실행**으로 대체하고, 리포트에 "로컬 Supabase 미실행 — SQL 파일 직접 실행으로 대체 검증"을 명시한다. 무증거 통과는 금지.

---

## 4. E2E (Playwright)

전제: 로컬 Supabase 기동 + §5 시드 완료 + `pnpm build && pnpm start`(프로덕션 빌드, PWA·성능 검증과 조건 통일).

### 4-1. 정상 해피패스 6종 (BUILD_PLAN §15-B 승계)

**H1. 검색→담기→반영**
- 전제: 시드에 "밤편지"(아이유) 포함.
- 단계: `/search` 진입 → "밤편지" 입력 → 결과 대기 → 첫 결과 "담기" 클릭 → `/`(홈) 이동.
- 기대: 검색 결과에 TJ/KY 번호(예시 번호) 표시. 담기 후 홈 리스트에 해당 곡 1건 존재.

**H2. 새로고침 유지**
- 전제: H1 완료 상태(리스트에 곡 1건 이상).
- 단계: 페이지 새로고침(`page.reload()`).
- 기대: 리스트 곡 수·순서가 새로고침 전과 동일(IndexedDB 영속 확인).

**H3. 계산 3모드 + 역계산**
- 전제: 리스트에 곡 24개 담긴 상태(시드 또는 스크립트로 준비).
- 단계: 계산 카드에서 "코인 곡당" 모드, 단가 500원 입력 → 결과 확인 → "룸 시간제" 전환, 시간당 20000원 입력 → 결과 확인 → 역계산 슬라이더(예산 또는 시간) 조작.
- 기대: 모드 전환마다 총 금액·1인당이 실시간 갱신. 역계산 시 가능 곡수(M) 표시가 슬라이더 값에 연동돼 변함.

**H4. 티켓 PNG**
- 전제: 리스트에 곡 1개 이상.
- 단계: `/ticket/[id]` 진입 → "이미지 저장" 클릭.
- 기대: PNG 파일 다운로드 이벤트 발생, 파일 크기 > 0.

**H5. 공유→fork**
- 전제: H4 상태.
- 단계: "링크 공유" 클릭 → 생성된 `/s/[slug]` URL 확보 → **새 브라우저 컨텍스트(시크릿)**로 해당 URL 열람 → "내 플리로 저장" 클릭 → 홈 이동.
- 기대: 새 컨텍스트에서 로그인 없이 열람 가능. fork 후 새 컨텍스트의 홈에 복제 리스트 존재, `forkedFrom` 필드에 slug 기록(Dexie 조회로 확인).

**H6. 오프라인 열람**
- 전제: 리스트에 곡 1개 이상 담긴 상태로 최소 1회 방문(서비스워커 캐시 완료).
- 단계: 네트워크 오프라인 토글(Playwright `context.setOffline(true)`) → `/` 재방문.
- 기대: 앱쉘 렌더 + 마지막 리스트 열람 가능(오류 화면 아님).

### 4-2. 비정상 경로 6종 (신설)

**A1. 잘못된 slug 404**
- 전제: 존재하지 않는 slug 문자열(예: `"zzzzzzzzzz"`, `API_CONTRACT.md §1-3` 정규식 형식은 맞지만 DB에 없음).
- 단계: `/s/zzzzzzzzzz` 직접 접근.
- 기대: 친절한 404 상태(`design/MICROCOPY.md` 카피, `API_CONTRACT.md §5` "slug 없음" 행). 서버 에러 원문 미노출.

**A2. 위조 payload(스크립트 문자열 포함) 텍스트 렌더**
- 전제: `shared_lists.payload`에 `title: "<script>alert(1)</script>"` 같은 문자열을 **테스트 셋업 단계에서 직접 DB insert**(정상 UI 플로우 우회, 위조 시뮬레이션).
- 단계: 해당 slug로 `/s/[slug]` 접근.
- 기대: 스크립트가 실행되지 않고 화면에 텍스트 그대로("&lt;script&gt;..." 또는 원문 그대로) 렌더. `page.on('dialog')` 등으로 `alert` 미호출 확인. `API_CONTRACT.md §4` XSS 방어 규칙, `SECURITY.md` XSS 절 대상.

**A3. 오프라인에서 공유 생성 시도 → 안내**
- 전제: 네트워크 오프라인 토글.
- 단계: `/ticket/[id]`에서 "링크 공유" 클릭.
- 기대: 실패가 아니라 **오프라인 배너/안내** 표시(`API_CONTRACT.md §5` "네트워크 없음" 행). 앱이 멈추거나 무한 로딩되지 않음.

**A4. 빈 리스트에서 티켓 시도 → 차단 안내**
- 전제: 리스트를 비운 상태(곡 0개).
- 단계: `/ticket/[id]` 접근 또는 "티켓 만들기" CTA 클릭 시도.
- 기대: 티켓 생성이 차단되고 "곡을 먼저 담아줘" 계열 안내로 리다이렉트 또는 인라인 안내. 빈 티켓이 생성되지 않음.

**A5. 한글 조합 중 Enter 오발동 없음**
- 전제: `/search` 진입.
- 단계: IME 조합 시뮬레이션 — `compositionstart` 이벤트 발생 → 한글 입력 중 `Enter` keydown → `compositionend`.
- 기대: 조합 중 Enter로 검색이 조기 실행되거나 잘못된 조합 문자로 검색되지 않음(`engineering/PLATFORM_NOTES.md` IME 절, `ONESHOT_MASTER.md` Phase 3 "isComposing 처리" 인용 요구사항과 연결).

**A6. 곡 100개 초과 담기 시나리오**
- 전제: 리스트에 곡 100개 담긴 상태(스크립트로 준비, `API_CONTRACT.md §1-3` `payload` 배열 상한 100).
- 단계: 101번째 곡 담기 시도 → "링크 공유" 시도.
- 기대: 클라이언트 선검증으로 100개 초과 시 담기 자체를 막거나(우선) 또는 공유 생성 전에 안내(`API_CONTRACT.md §5` "CHECK/RLS 위반" 행 — 클라 선검증이 서버 도달 전에 차단). 서버 CHECK 에러가 사용자에게 원문 노출되지 않음.

---

## 5. 시드 데이터 의존성

e2e가 전제하는 고정 시드 곡 목록. **번호는 전부 예시이며 실제 TJ/KY 번호가 아니다.** `scripts/seed/`에 이 목록을 upsert하는 스크립트를 포함해야 e2e가 재현 가능하다.

| 제목 | 가수 | TJ 번호(예시) | KY 번호(예시) | 용도 |
|---|---|---|---|---|
| 밤편지 | 아이유 | `00001`(예시) | `00001`(예시) | H1(검색), A5(IME) — 기존 AC 승계 필수 포함곡 |
| (제목 미정 2) | (가수 미정) | (예시) | (예시) | 초성 검색 케이스(예: `ㅂㅍㅈ`) 추가 검증용 |
| … 총 20~30곡 | | | | `BUILD_PLAN.md §7` 시드 파이프라인 산출물과 동일 소스 |

- H3(계산 3모드) 전제인 "곡 24개"는 시드 20~30곡 중 24개를 담아 스크립트로 구성하거나, 동일 곡을 노트만 다르게 24회 복제해도 무방(계산 엔진은 `songId` 중복 허용, `API_CONTRACT.md §4` 스키마상 제약 없음).
- A6(101개)은 시드 전체를 다 못 채우면 테스트 셋업에서 더미 `ListItemSnapshot`을 직접 생성해 채운다(실제 곡 DB 100곡 확보를 전제하지 않음).
- 시드 스크립트 실행 절차·소스 확보 방식은 `BUILD_PLAN.md §7`을 따른다(이 문서는 "무슨 곡이 있어야 e2e가 재현되는가"만 정의, 크롤링 방식은 소유하지 않음).

---

## 6. 시각 검증

- **대상 4화면**: 홈(`/`) · 검색(`/search`) · 티켓(`/ticket/[id]`) · 공유뷰(`/s/[slug]`).
- **모드**: 라이트 · 다크(각 화면당 2장, 총 8장).
- **절차**: 각 화면에 최소 1개 이상 데이터가 채워진 상태(빈 상태 아님 — 빈 상태는 `QA_MATRIX.md` C8에서 별도 확인)로 뷰포트 375×812(모바일 기준, `design/DESIGN_SYSTEM.md` 브레이크포인트 최소값) 스크린샷.
- **저장 위치**: `test-results/screenshots/{화면명}-{라이트|다크}.png` (예: `test-results/screenshots/home-light.png`). Playwright의 `page.screenshot()` 또는 `toHaveScreenshot()` 사용 시 동일 경로 규칙 적용.
- **확인 항목**: `QA_MATRIX.md` C3(시각 위계)·C4(디자인 일관성)의 근거 스크린샷으로 겸용.

---

## 7. 접근성(a11y)

### 7-1. 자동 검사

- Playwright에 `@axe-core/playwright`(또는 동등 axe 통합) 연결 — **의존성 추가가 필요하면 `BUILD_PLAN.md §2` 스택 목록 밖이므로 `DECISIONS_LOG.md`에 사유 기록 후 최소 추가**(`ONESHOT_MASTER.md` 스택 고정 규칙).
- 4화면(§6과 동일 대상)에서 axe 스캔 실행, `critical`·`serious` 등급 위반 0건 목표.
- 실행 못 하면(의존성 미설치 등) "정적 코드 검토로 대체"임을 리포트에 명시.

### 7-2. 수동 시나리오

| 시나리오 | 절차 | 기대 |
|---|---|---|
| 키보드만으로 담기→계산→공유 | 마우스 없이 Tab/Enter/Space만으로 `/search`→곡 담기→홈 계산 카드 조작→"링크 공유"까지 완주 | 모든 인터랙션 요소에 포커스 도달·Enter/Space로 활성화 가능, 포커스 순서가 시각 순서와 일치 |
| BottomSheet 포커스 트랩 | 곡 편집 BottomSheet 오픈 → Tab 반복 | 포커스가 시트 내부에서만 순환, 시트 밖 요소로 새지 않음. Esc로 닫히고 트리거 요소로 포커스 복귀 |
| prefers-reduced-motion | OS/브라우저 설정에서 reduced-motion 활성화 → 담기·계산 카운트업·티켓 발권 모션 확인 | 모든 모션이 대체 동작(즉시 전환 등)으로 바뀜, `BUILD_PLAN.md §14` "전부 prefers-reduced-motion 존중" 규칙과 정합 |

---

## 8. 성능

- **실행 조건**: `pnpm build && pnpm start`(프로덕션 빌드) 상태에서 Lighthouse 실행. 개발 서버(`pnpm dev`) 측정은 무효(HMR·비압축 번들로 왜곡).
- **기준값**:
  - PWA 설치 가능: 통과/실패(이진, `BUILD_PLAN.md §9`·`§15` AC와 동일)
  - 접근성 점수: 90+ (`BUILD_PLAN.md §9`·`§15` AC와 동일)
  - 성능 점수(Performance)·LCP·TBT 등 구체 수치: **실측 필요** — 이 문서 작성 시점엔 목표 수치를 단정하지 않는다. 최초 Phase 9 실행 시 측정값을 리포트에 기록하고, 이후 이 값을 회귀 기준선으로 삼는다.
- 측정 환경(디바이스 모사·네트워크 스로틀링 프로필)은 Lighthouse 기본값(Mobile, Simulated Slow 4G) 사용을 기본으로 하되, 다르게 설정했다면 리포트에 명시.

---

## 9. 검증 리포트 표 형식 (BUILD_PLAN §15-D 승계·확장)

Phase 8 종료 시 아래 표를 **실제 실행 결과로** 채워 제출한다.

| 검증 | 도구 | 결과 | 증거 링크 |
|---|---|---|---|
| 계산 벡터(§6-3 전부) | Vitest | pass/fail | `test-results/vitest-calc.log` |
| 초성 유틸(§2-2 10케이스) | Vitest | pass/fail | `test-results/vitest-chosung.log` |
| 공유 payload 왕복+거부(§2-3) | Vitest | pass/fail | `test-results/vitest-share.log` |
| 계약 테스트(§3, API_CONTRACT §8 전항목) | 로컬 Supabase | pass/fail (항목별) | `test-results/contract.log` |
| 해피패스 H1~H6(§4-1) | Playwright | pass/fail (건별) | `test-results/playwright-report/` |
| 비정상경로 A1~A6(§4-2) | Playwright | pass/fail (건별) | `test-results/playwright-report/` |
| 시각 검증 4화면×2모드(§6) | 스크린샷 | O/X | `test-results/screenshots/*.png` |
| a11y 자동(§7-1) | axe | critical/serious 건수 | `test-results/a11y-report.json` |
| a11y 수동(§7-2) | 수기 확인 | O/X (시나리오별) | 리포트 본문 서술 |
| Lighthouse(§8) | Lighthouse | PWA/a11y 점수 + 성능 수치(실측) | `test-results/lighthouse.json` |

**규칙**: 실패는 실패로 보고 → 수정 → 재실행(§1-3과 동일). 실서버 키가 없어 못 도는 부분(Kakao 실제 공유 렌더 등)은 "로컬/모의로 대체 검증"했음을 증거 링크 칸에 함께 명시한다(가짜 통과 금지, §1-4).

---

## 고찰

| 결정 | 근거 | 기각한 대안 |
|---|---|---|
| 초성 유틸 케이스 목록을 이 문서(TEST_PLAN)에 정본으로 둠 | 클러스터 지시가 "PLATFORM_NOTES의 엣지 표 기반 케이스 목록(여기가 테스트 케이스 정본)"이라 명시 — 규칙은 PLATFORM_NOTES, 구체 케이스 나열은 여기 | PLATFORM_NOTES에 케이스까지 다 넣고 여기선 포인터만 — 지시된 정본 경계와 불일치 |
| e2e를 정상 6종+비정상 6종으로 균등 분리 | BUILD_PLAN §15-B(정상)만으로는 실패·경계 상황에서의 UX(친절한 안내 vs 크래시)를 검증 못함 — QA_MATRIX C8·C11이 요구하는 상태 표현·신뢰 안전과 직결 | 정상 패스만 유지하고 비정상은 QA_MATRIX 수동 체크로만 남김 — "실행 증거"가 아닌 서술 판단이 되어 §1 원칙(실행 증거 필수) 위반 |
| 시드 곡 목록에서 "밤편지"(아이유) 외 나머지는 자리만 두고 확정하지 않음 | 클러스터 지시가 실제 시드 소스는 BUILD_PLAN §7 소관이라 명시 — 여기서 실곡 목록을 지어내면 "존재하지 않는 데이터를 사실처럼" 쓰는 금지 규칙 위반 | 임의로 20~30곡을 나열 — 실제 시드 파이프라인 산출물과 어긋날 위험, 검증 불가능한 가짜 정본 생성 |
| 성능 기준값을 "실측 필요"로 폭만 남김 | 프로덕션 코드가 아직 없어 LCP·TBT 등은 예측 불가 — 단정하면 §1의 "확실하지 않은 내용은 사실처럼 쓰지 않는다" 위반 | 업계 평균치(예: LCP 2.5s)를 임의 기준으로 채택 — 싱송의 실제 번들 크기·이미지 export 비용(html-to-image)을 반영 못한 채 조기 확정 |
| a11y 자동 도구(axe)를 스택 밖 의존성으로 취급해 DECISIONS_LOG 기록을 요구 | `BUILD_PLAN.md §2`·`ONESHOT_MASTER.md`가 스택을 못박고 "임의 추가 금지"라 axe도 예외 없이 절차를 따라야 함 | 암묵적으로 axe를 이미 스택에 포함된 것처럼 서술 — 불변 원칙(스택 고정)과 충돌 |

## 검증 체크리스트

- [ ] `test/calc.test.ts`의 `it()` 개수가 `BUILD_PLAN.md §6-3` 벡터 행 수와 정확히 일치하는가
- [ ] §2-2 초성 케이스 10개 전부가 `test/chosung.test.ts`에 1:1 대응하는가(케이스 4는 공백 보존 확정 규칙대로)
- [ ] §3 계약 테스트가 `API_CONTRACT.md §8` 체크리스트 7항목을 빠짐없이 실행했는가(항목 수 대조)
- [ ] §4의 H1~H6, A1~A6 총 12개 시나리오가 전부 Playwright 스펙 파일로 존재하고 실행됐는가
- [ ] §5 시드 목록에 "밤편지"(아이유)가 포함되어 있고 `scripts/seed/`가 이를 실제로 upsert하는가
- [ ] §9 리포트 표의 모든 행이 "미실행" 없이 pass/fail 또는 대체검증 명시로 채워졌는가
- [ ] 이 문서에 계산 규칙 수치·hex 색상·문구 원문이 직접 등장하지 않고 전부 포인터로만 참조되는가(README §3)

## 미결

- ~~케이스 4 공백 처리~~ → **해소(v1.0 리뷰)**: 공백 위치 보존으로 확정(§2-2 표 갱신됨).
- §5 시드 목록의 "밤편지" 외 곡들은 제목·가수가 미정 — `BUILD_PLAN.md §7` 시드 파이프라인 실행 후 실제 목록으로 이 표를 갱신해야 함(`확인 필요`).
- §8 성능 기준값(Performance 점수·LCP·TBT)은 `실측 필요` — Phase 9 최초 실행 시 실측치를 채워 넣고 이후 회귀 기준선으로 승격.
- §7-1 axe 통합 여부(정확한 패키지명·설정)는 `engineering/PLATFORM_NOTES.md`·`ARCHITECTURE.md` 완성 후 충돌 여부 재확인 필요(현재 두 문서 모두 미작성 상태로 확인됨).
- A2(위조 payload) 테스트의 DB 직접 insert 방식이 로컬 Supabase 환경에서 RLS 정책(§3 `shared_lists_public_insert`)과 충돌 없이 가능한지는 실제 구현 시점에 재확인 필요 — anon insert 정책이 `with check (true)`라 값 자체는 통과하지만, 테스트 셋업이 서버 CHECK(§API_CONTRACT §1-3 title/payload 크기 제약)를 우회하려는 게 아니라 그 안에서 악성 문자열만 넣는 것인지 명확히 할 것.
