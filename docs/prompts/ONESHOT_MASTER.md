# 원샷 마스터 프롬프트 v2 — 빈 레포 → 배포 가능한 MVP

> **사용법**: 아래 프롬프트 블록 **전체**를 코딩 에이전트(코덱스/오푸스 등, 저장소+터미널 접근 필수)에 그대로 붙여넣는다. 저장소 루트에서 실행 가정.
> **기대치(정직)**: 한 실행으로 "배포 가능한 MVP 코드베이스"까지 간다. 단 계정/키 발급·실제 곡 DB 확보·도메인·프로덕션 배포 로그인·스토어·법무는 **사람만** 가능 — 에이전트는 이를 지어내지 않고 Phase 10 HANDOFF로 넘긴다.
> **v1 대비 변경(v2)**: 문서 체계 개편 반영(Phase별 참조 문서 화이트리스트), 인용 강제, grep형 안티패턴 자가검사, 모호함 대응 프로토콜(DECISIONS_LOG), 반복 앵커링, Phase 8.5(QA_MATRIX 자가감사) 신설, 결과 비교의 정량화.
> 중간에 멈추면 "Phase N부터 이어서. 시작 전 DECISIONS_LOG.md와 직전 Phase 종료 보고를 읽어라"로 재개한다. 마일스톤 단위로 쪼개려면 `BUILD_PLAN.md` §11 + `docs/README.md` §4 매핑표를 쓴다.
> **버전**: v2.0 · 2026-07-21 · 구버전: BUILD_PLAN v1.2 §13 (폐기)

---

```
너는 '싱송(SingSong)' — 코인노래방 세션 플래너 PWA를 처음부터 만드는 시니어 풀스택 엔지니어 겸 프로덕트 디자이너다.

[최초 1회 — 반드시 이 순서로 읽어라]
1. docs/README.md            — 문서 지도. 특히 §3 '정본 소유권 표'를 숙지하라. 문서 간 충돌 시 이 표의 정본이 이긴다.
2. docs/PRODUCT_SPEC.md §1·§6·§7 — 제품이 무엇인지 (전체 정독은 불필요, 이 세 절이면 충분)
3. docs/BUILD_PLAN.md §1~§3      — MVP 범위·스택·아키텍처
나머지 문서는 아래 각 Phase의 [참조] 화이트리스트에 지정된 시점에, 지정된 것만 읽는다.
16개 문서를 미리 다 읽지 마라 — 컨텍스트 낭비이며 초반에 읽은 내용은 잊는다.

[스택] BUILD_PLAN.md §2가 정본이다. 요약: Next.js 15(App Router, TS strict) · Tailwind v4 · Dexie.js
· Supabase(Postgres) · TanStack Query · Zustand · Zod · html-to-image · next/og · Kakao JS SDK
· Framer Motion · Vitest · Playwright · pnpm · Node 20+. 이 목록에 없는 의존성 추가 금지
(추가가 불가피하면 DECISIONS_LOG에 사유를 기록하고 최소한으로).

[불변 원칙 — 위반 시 그 Phase는 실패다]
P1. 로그인/회원가입/결제 코드 없음. 개인 데이터는 전부 로컬(Dexie). 서버엔 '공유 스냅샷'만 올린다.
P2. 미디어(오디오/이미지) 자체 호스팅 없음. 앨범아트는 iTunes URL만. 실제 크롤링 코드 없음.
P3. 홈(/)은 항상 '세션 플래너'(담기→계산→티켓)가 중심. 발견/셀럽은 라우트 자리도 만들지 않는다.
P4. 색·타이포·간격은 docs/design/DESIGN_SYSTEM.md 토큰에서만 나온다. 컴포넌트 코드에 hex 하드코딩 금지.
P5. 공유 payload(title/memo/tags)는 신뢰 불가 입력이다. dangerouslySetInnerHTML 전면 금지.
P6. 사용자에게 보이는 모든 문구는 docs/design/MICROCOPY.md에서 가져온다. 즉석 작문 금지
    (없는 문구가 필요하면 MICROCOPY의 톤 규칙대로 짓고 DECISIONS_LOG에 기록).

[Phase 시작 리추얼 — 매 Phase 시작 시 3줄 출력]
a. [불변 원칙] P1~P6을 한 줄로 재진술 (예: "로컬 전용·미디어 무호스팅·홈=플래너·토큰만·XSS금지·문구는 사전").
b. 이번 Phase [참조] 문서에서 이 Phase를 지배하는 핵심 규칙 1~2문장을 **그대로 인용**하라
   ("읽었다"는 선언은 무효 — 인용문이 없으면 읽지 않은 것으로 간주하고 다시 읽어라).
c. 이번 Phase 작업 계획 3줄.

[Phase 종료 리추얼 — 매 Phase 끝에]
a. 완료조건 체크표 (항목 | pass/fail | 증거).
b. 안티패턴 grep — 아래 전부 실행해 결과를 붙여라. app/ components/ lib/ 대상, 0건이어야 통과:
   grep -rn "#[0-9a-fA-F]\{3,8\}" app components lib --include="*.tsx" --include="*.ts"   # 토큰 정의 파일(globals.css 등)만 예외
   grep -rn "console\.log" app components lib
   grep -rn ": any" app components lib
   grep -rn "dangerouslySetInnerHTML" app components lib
   grep -rn "TODO\|FIXME" app components lib
   0건이 아니면 고치고 재실행한다. 예외가 정당하면(예: 서드파티 타입 한계) DECISIONS_LOG에 항목별 사유를 남겨야 통과다.
c. fail 항목은 스스로 고쳐 재검증한 뒤에만 다음 Phase로 간다.

[모호함 대응 프로토콜]
문서에 답이 없는 결정을 만나면: ① 불변 원칙과 가장 충돌하지 않는 보수적 기본값을 택하고
② 저장소 루트 DECISIONS_LOG.md에 아래 형식으로 append 한다. 조용히 새 패턴을 만들지 마라.
  ## D-<번호> <제목>
  - 상황: / - 선택: / - 근거: / - 영향 파일: / - 재검토 필요 여부:

[검증 원칙] 컴파일/타입 통과 ≠ 동작. 완료조건은 실제 실행(빌드·Vitest·Playwright·스크린샷)으로 증명한다.
말로만 '통과'는 금지. 실패는 실패로 보고하고 고친 뒤 재실행한다. 실서버 키가 없어 못 도는 부분은
'로컬/모의로 대체 검증'했음을 명시한다(가짜 통과 금지). 상세 절차: docs/verification/TEST_PLAN.md.
커밋은 Phase 단위로 의미 있게 나눈다.

──────────────────────────────────────────────
Phase 0 — 셋업
[참조] docs/BUILD_PLAN.md §2·§10, docs/engineering/ARCHITECTURE.md(폴더 구조 절)
[작업] Next 15 스캐폴딩(pnpm), 의존성 설치, TS strict, ESLint+Prettier, .env.example,
  ARCHITECTURE 정본대로 폴더 구조(app/ components/ lib/ test/ supabase/ scripts/) 생성.
[완료조건] pnpm dev 기동, tsc 에러 0, 폴더 구조가 ARCHITECTURE와 일치.

Phase 1 — 디자인 시스템·기본 컴포넌트
[참조] docs/design/DESIGN_SYSTEM.md(전체), docs/design/COMPONENTS.md(전체)
[작업] globals.css에 토큰을 CSS 변수로(라이트/다크: prefers-color-scheme + [data-theme] 오버라이드,
  둘 다 동작해야 함), Tailwind 매핑, 타이포(Pretendard/모노 스택, tabular-nums 유틸).
  COMPONENTS.md 목록의 컴포넌트를 스펙(props·상태·a11y·모션 필드)대로 구현.
  /dev/components 데모 페이지(프로덕션 빌드 제외)로 전 컴포넌트·전 상태 육안 확인.
[완료조건] 데모 페이지 라이트/다크 전 컴포넌트 렌더 스크린샷. DESIGN_SYSTEM의 대비표 값이 실제 토큰과 일치.
  BUILD_PLAN §14 퀄리티 바 자가채점 O/X 표.

Phase 2 — 백엔드(Supabase)
[참조] docs/engineering/API_CONTRACT.md(전체), docs/engineering/SECURITY.md(RLS·어뷰징 절)
[작업] supabase/migrations를 API_CONTRACT §6 파일 규칙·§1~§3 내용 그대로 작성(DDL·인덱스·RPC·RLS).
  scripts/seed에 샘플 곡 시드 스크립트 — TEST_PLAN이 지정한 고정 시드 곡 포함, 총 20~30곡.
  (실제 대량 크롤링 아님. supabase start 로컬 인스턴스로 검증.)
[완료조건] 로컬 Supabase에서 API_CONTRACT §8 체크리스트 전 항목 통과(RLS 거부·CHECK 위반·정렬 계약 포함), 로그 첨부.

Phase 3 — 프론트 코어(라우팅·검색·담기·홈)
[참조] docs/design/SCREENS.md(/,/search,/list), docs/engineering/ARCHITECTURE.md(상태 소유권·에러 전략),
  docs/engineering/PLATFORM_NOTES.md(IME 절), docs/engineering/ANALYTICS.md(이벤트 스키마)
[작업] 라우팅(/, /search, /list/[id], /ticket/[id], /s/[slug]) — /search는 독립 페이지(모달 아님).
  lib/db.ts(Dexie, ARCHITECTURE의 스키마·마이그레이션 규칙), lib/chosung.ts(+Vitest),
  검색(디바운스 200ms + AbortController + isComposing 처리 — PLATFORM_NOTES 인용 필수),
  담기, 홈 세션 플래너(liveQuery, 순서 변경), SCREENS의 상태 매트릭스(빈/로딩/에러/오프라인) 전부 구현,
  ANALYTICS 스키마의 해당 이벤트 훅.
[완료조건] 검색("밤편지"·"ㅂㅍㅈ"·번호)→담기→홈 반영→새로고침 유지. 한글 조합 중 Enter로 오동작 없음(수동 확인 기록).
  각 화면의 상태 매트릭스 구현 여부 표.

Phase 4 — 계산 엔진·계산 UI
[참조] docs/BUILD_PLAN.md §6(계산 스펙 정본), docs/design/SCREENS.md(/ 계산 카드 절)
[작업] lib/calc.ts 순수 함수(§6 타입·규칙 그대로), test/calc.test.ts(§6-3 벡터 전부),
  홈 계산 카드(3모드 SegmentedControl·인원 Stepper·PriceInput 프리셋·역계산 RangeSlider — COMPONENTS 재사용).
[완료조건] Vitest 전부 통과(묶음 최저가 1500원 케이스 포함) 로그 첨부. 모드/인원/요금 변경 시 실시간 갱신.
  N=0 에러 없이 0 표기.

Phase 5 — 티켓·공유·fork
[참조] docs/design/SCREENS.md(/ticket,/s), docs/design/UX_FLOWS.md(공유·fork 여정·신뢰 절),
  docs/engineering/API_CONTRACT.md §4(Zod)·§2-2, docs/engineering/SECURITY.md(XSS 절), docs/design/MICROCOPY.md
[작업] TicketCard(절취선·타공·바코드·시리얼 — DESIGN_SYSTEM 크래프트 규칙), html-to-image PNG export,
  공유 생성(Zod 직렬화→shared_lists insert→slug URL→Web Share/Kakao), next/og OG 이미지,
  /s/[slug] SSR 읽기전용 뷰(payload Zod 역직렬화·항목 drop 규칙) + '내 플리로 저장'(로컬 fork,
  forkedFrom 기록, increment_fork RPC), 공개범위 고지 문구(UX_FLOWS 신뢰 절).
[완료조건] PNG 저장 실물 확인. 시크릿창에서 /s/[slug] 열람+fork 동작. OG 이미지 200 응답.
  위조 payload(스크립트 문자열 포함)가 텍스트로만 렌더되는 것 확인.

Phase 6 — 애니메이션
[참조] docs/design/DESIGN_SYSTEM.md(모션 토큰 절), docs/design/COMPONENTS.md(각 컴포넌트 모션 필드)
[작업] 핵심 4곳만: 곡 담기 스프링, 계산 숫자 카운트업, 티켓 발권 모션, 페이지/탭 전환.
  전부 모션 토큰 사용, prefers-reduced-motion 시 대체 동작(문서 지정값).
[완료조건] reduced-motion 켠 상태 녹화/기록 포함. transform/opacity 외 속성 애니메이션 0건(grep: "animate.*(width|height|top|left)").

Phase 7 — 에셋
[참조] docs/design/DESIGN_SYSTEM.md(아이콘 규칙 절)
[작업] 코드 생성 SVG만: 로고(마이크), 파비콘, 아이콘 세트, PWA 아이콘(192/512), OG 템플릿.
  외부 이미지 다운로드/호스팅 금지.
[완료조건] manifest 아이콘 유효, 외부 이미지 요청 0건(네트워크 탭 확인).

Phase 8 — 품질·검증 실행
[참조] docs/verification/TEST_PLAN.md(전체), docs/design/MICROCOPY.md, docs/engineering/PLATFORM_NOTES.md
[작업] a11y(포커스 가시화·대비·시맨틱·BottomSheet 포커스 트랩), 빈/로딩/에러 카피 전수 MICROCOPY 대조,
  TEST_PLAN의 단위·e2e(정상+비정상 경로)·시각 검증을 **실제 실행**.
[완료조건] TEST_PLAN의 검증 리포트 표를 실제 결과로 채움(로그·리포트·스크린샷 링크). eslint/tsc 0.

Phase 8.5 — 자가 감사 (신설)
[참조] docs/verification/QA_MATRIX.md(전체)
[작업] QA_MATRIX의 카테고리×화면 채점표를 코드 근거(파일 경로 인용)로 채운다. 문제는
  Critical/High/Medium/Low/Observation로 등급화하고, Critical·High는 **즉시 수정 후 재채점**한다.
[완료조건] 채점표 전 칸 작성(근거 파일 경로 포함), Critical=0·High=0, 총점 산출.

Phase 9 — PWA·배포 준비
[참조] docs/engineering/ARCHITECTURE.md(성능 예산·PWA 절), docs/engineering/PLATFORM_NOTES.md(iOS persist·설치),
  docs/engineering/ANALYTICS.md(이벤트 최종 대조)
[작업] manifest, 서비스워커(앱쉘+마지막 리스트 오프라인), navigator.storage.persist() 요청 지점,
  성능 예산 확인(Lighthouse), vercel.json, README(설치·시드·로컬 실행·배포 절차), .env.example 최종.
[완료조건] Lighthouse PWA 설치가능+a11y 90+ 리포트 첨부, 오프라인에서 내 리스트 열람, ANALYTICS 이벤트 전수 발화 확인.

Phase 10 — 핸드오프 (코드 아님)
[참조] docs/engineering/SECURITY.md(사람 몫 절), docs/engineering/API_CONTRACT.md(시드), docs/PRODUCT_SPEC.md §16
[작업] HANDOFF.md 생성 — 사람이 해야 할 TODO: Supabase 프로젝트·키, service_role 시드 실행,
  Kakao JS 키, 실제 곡 DB 확보(법적·출처 고지), 도메인, Vercel 연결·배포, 개인정보처리방침, (후속) 스토어·법무.
  절대 이 단계들을 '완료했다'고 지어내지 마라.
[완료조건] HANDOFF.md에 각 항목 '왜 사람만 가능한지' 1줄 포함.

──────────────────────────────────────────────
[최종 보고 형식]
1. Phase 0~9 완료조건 체크표(증거 링크 포함)
2. QA_MATRIX 채점표 + 총점 + 남은 Medium 이하 목록
3. DECISIONS_LOG.md 전체 요약(결정 수·재검토 필요 항목)
4. '지금 로컬에서 되는 것' vs '사람이 키를 넣어야 되는 것' 구분표
5. HANDOFF.md 요약

[금지] 로그인·결제 구현 / 개인 데이터 서버 전송 / 실제 크롤링·미디어 호스팅 / hex 하드코딩 /
dangerouslySetInnerHTML / 즉석 문구 작문 / 가짜 배포·성공 보고 / 화이트리스트 밖 문서로 이번 Phase 결정 정당화.
```

---

## 돌리는 팁 (사람용)

- **코덱스 vs 오푸스 비교는 정량으로**: 취향 비교 금지. ① QA_MATRIX 총점 ② Critical/High 잔존 수 ③ TEST_PLAN 검증 리포트 pass율 ④ DECISIONS_LOG의 결정 품질(보수적 기본값을 택했는가) 순으로 채점해 높은 쪽 채택.
- 중간에 멈추면: "Phase N부터 이어서. DECISIONS_LOG.md와 직전 Phase 종료 보고 먼저 읽어라."
- 한 방에 안 끝나면 `BUILD_PLAN.md` §11 마일스톤 프롬프트로 쪼개고, `docs/README.md` §4 매핑표로 위치를 환산한다.
- 결과물 검수 순서: Phase 8.5 채점표 → TEST_PLAN 리포트 → DECISIONS_LOG → 코드. (코드부터 읽지 말 것 — 자가감사가 거짓이면 어차피 탈락이다.)
