# 싱송 — 구현 계획 (Build Plan) & AI 빌드 프롬프트

> 짝 문서: [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) (제품/설계) · **문서 지도: [`README.md`](./README.md)** (14개 상세 설계 문서의 읽기 순서·정본 소유권 표 — 반드시 여기서 시작).
> 이 문서는 **엔지니어링 실행 계획(스택·마일스톤·계산 엔진 스펙 §6)**의 정본이다. 상세 설계(디자인·화면·계약·보안·검증)는 각 도메인 문서가 정본(README §3).
> **범위**: Phase A = 로그인 없는 PWA MVP (담기 → 계산 → 티켓 공유 → fork). 발견/셀럽·결제·네이티브는 이 문서 범위 밖(후속).
> **버전**: v1.3 · 2026-07-21 (문서 체계 개편: §4→API_CONTRACT/ARCHITECTURE 이관, §13→prompts/ONESHOT_MASTER v2 이관, §15→TEST_PLAN 이관, §11에 참조 문서 명시, Framer Motion §2 편입, 탭바 2탭 확정)
> *(v1.2: §14 디자인 퀄리티 바 + §15 검증 프로토콜 추가)*

---

## 0. 이 문서 사용법 (코덱스 vs 오푸스 병행)

0. **원샷으로 돌릴 거면 이 문서의 §11이 아니라 [`prompts/ONESHOT_MASTER.md`](./prompts/ONESHOT_MASTER.md)를 쓴다**(§13 참조). §11은 마일스톤 단위로 쪼개 돌릴 때의 프롬프트다. 두 체계의 환산은 [`README.md`](./README.md) §4.
1. 실제 구현은 **코덱스와 오푸스에 각각** 프롬프트를 붙여넣어 돌린 뒤, [`verification/QA_MATRIX.md`](./verification/QA_MATRIX.md) 채점표 점수로 비교해 좋은 쪽 채택(취향 비교 금지).
2. **§11-0(공통 컨텍스트)를 항상 먼저** 붙이고, 그다음 해당 마일스톤 프롬프트를 이어붙인다.
3. 마일스톤은 **M1→M6 순서대로** (앞 산출물에 의존). M0(곡 DB 시드)는 병렬 트랙.
4. 각 프롬프트의 **완료 조건(AC)**을 그대로 수용 테스트로 쓴다. AC 미충족이면 "AC n번 실패, 수정" 재프롬프트.
5. 프롬프트는 스택·파일경로·제약을 못박아 **모델 무관하게 재현**되도록 작성됨. 스택을 바꾸려면 §2와 프롬프트를 동시에 고칠 것.

---

## 1. MVP 범위 (Phase A)

### 포함
- 곡 검색(TJ/KY 번호, 초성) + 리스트에 담기
- 리스트(플리) CRUD + 곡별 노트(내 키, 상황 태그)
- **세션 계산기**: 코인 곡당/시간제 + 룸 시간제 + 예산·시간 역계산
- **티켓 생성 + 공유**: 공유 링크(slug) + 카톡 OG 미리보기 + 스샷 이미지(PNG) export
- **플리 fork**: 공유 링크 열면 "내 플리로 저장"(로컬 복제)
- 로컬 저장(익명, IndexedDB) + 부른 곡 히스토리(로컬)
- PWA(설치 가능, 오프라인 shell)

### 제외(후속)
로그인/회원가입 · 결제 · 발견(셀럽 플리) 탭 · 실시간 그룹 큐 · 플리 임포트(멜론/유튜브) · 서버 계정 동기화 · 네이티브 앱.
> 단, **데이터 모델·라우팅은 후속 확장을 막지 않게** 설계(예: `forked_from`, slug, 익명 device_id 자리).

---

## 2. 기술 스택 (확정)

| 영역 | 선택 | 이유/비고 |
|---|---|---|
| 프레임워크 | **Next.js 15 (App Router, TS)** | 공유 링크 SSR/OG, PWA, 웹우선 전략 |
| 스타일 | **Tailwind CSS v4** + 디자인 토큰(§SPEC 14) | 컨셉 보드 컬러/타이포 반영 |
| 로컬 저장 | **Dexie.js (IndexedDB)** + `dexie-react-hooks` | local-first 개인 데이터 |
| 서버/DB | **Supabase (Postgres)** | 곡 카탈로그 검색 + 공유 스냅샷(slug) |
| 곡 검색 | Postgres **pg_trgm** + `chosung` 컬럼 + RPC | 초성/부분일치 DB단 처리 |
| 이미지 export | **html-to-image** | 티켓 카드 → PNG (클라, 서버비 0) |
| OG 이미지 | **next/og (ImageResponse)** | 카톡 링크 미리보기 |
| 공유 | Web Share API + **Kakao JS SDK** | 링크/이미지 공유 |
| 데이터패칭 | **TanStack Query** + Dexie liveQuery | 서버=Query, 로컬=Dexie |
| 세션 빌더 상태 | **Zustand** | 담는 중 draft |
| 스키마 검증 | **Zod** | 공유 payload/폼 |
| 테스트 | **Vitest**(계산·유틸) + **Playwright**(e2e 필수 — [`verification/TEST_PLAN.md`](./verification/TEST_PLAN.md)) | 계산 엔진은 순수함수라 단위테스트 필수 |
| 애니메이션 | **Framer Motion** | 모션 토큰(스프링 파라미터)은 [`design/DESIGN_SYSTEM.md`](./design/DESIGN_SYSTEM.md) §6 정본. 핵심 3~4곳만, reduced-motion 존중 |
| 배포 | **Vercel**(MVP) | Hobby는 비상업 한정 → 수익화 시 Pro/Cloudflare |
| 품질 | ESLint + Prettier + TS strict | |

**Node 20+, 패키지매니저 pnpm.**

---

## 3. 아키텍처 (local-first + 공유 스냅샷)

```
[개인 데이터]  브라우저 IndexedDB(Dexie)  ← 익명, 로그인 없음
     │  (담기·리스트·노트·히스토리 전부 로컬)
     ▼  "공유하기" 누를 때만
[공유 스냅샷]  Supabase shared_lists (slug 발급)  ← 링크로 열람·fork
     ▼
[곡 카탈로그]  Supabase songs (검색 전용, 읽기)   ← pg_trgm+초성
```

- **개인 리스트는 서버에 안 올라감**(익명·프라이버시·비용). 오직 "공유" 시 스냅샷만 push → slug URL.
- **fork** = 공유 slug 스냅샷을 읽어 로컬 Dexie에 새 리스트로 복제(`forked_from` 기록).
- 곡 검색만 서버(Supabase) 호출. 결과의 앨범아트 URL은 iTunes(§SPEC 13, 캐시).
- 후속(Phase B)에서 익명 device_id → 이메일 계정 승격 시 로컬을 서버 동기화로 확장(지금은 자리만).

---

## 4. 데이터 모델 — 이관됨 (v1.3)

> **이 절의 내용은 정본 문서로 이관·승격되었다.** 여기 있던 초안 DDL·스키마는 폐기하고 아래를 따른다:
>
> - **서버(Postgres) DDL·인덱스·RPC·RLS·공유 payload Zod 스키마** → [`engineering/API_CONTRACT.md`](./engineering/API_CONTRACT.md) §1~§4 (CHECK 제약·정렬 계약·`increment_fork` 포함 — 초안보다 강화됨)
> - **로컬(Dexie) 스키마·`settings` 키 목록·마이그레이션 정책** → [`engineering/ARCHITECTURE.md`](./engineering/ARCHITECTURE.md) §4
>
> 단위 확정: 곡 길이는 `duration_sec`(초) 하나뿐이다 — PRODUCT_SPEC §12 초안의 `duration_min`은 폐기된 표기.

---

## 5. 정보구조 / 라우팅 (코어 우선)

| 경로 | 화면 | 비고 |
|---|---|---|
| `/` | **홈 = 세션 플래너** | 현재 리스트 + 계산 요약 + "티켓 만들기". 앱의 중심 |
| `/search` | 곡 검색·담기 | **독립 페이지 확정**(모달 아님 — 뒤로가기·딥링크·IME 단순화, [`design/SCREENS.md`](./design/SCREENS.md) §4) |
| `/list/[id]` | 리스트 상세/편집 | 곡 순서·노트·태그 |
| `/ticket/[id]` | 티켓 미리보기·공유 | 이미지 export·링크·카톡 |
| `/s/[slug]` | **공유 뷰(읽기전용)** | "내 플리로 저장"(fork) 버튼 |
| `/discover` | (후속) 발견 탭 | **경로 예약만 — 라우트 파일 생성 안 함**(빈 스텁 화면은 QA 결함이 됨. v1.3 확정) |

> IA 원칙(§SPEC 7-5): 홈은 항상 플래너. 발견은 후속 2차 탭. 하단 탭바는 **홈/검색 2탭**(다중 리스트 전환은 홈의 스위처 시트 — [`design/UX_FLOWS.md`](./design/UX_FLOWS.md) §2-1 확정).
> 화면별 상세(와이어·상태 매트릭스·인터랙션)는 [`design/SCREENS.md`](./design/SCREENS.md) 정본.

---

## 6. 계산 엔진 스펙 (`lib/calc.ts`) — 순수 함수

### 6-1. 타입
```ts
export type KaraokeMode = 'coin_per_song' | 'coin_per_time' | 'room_per_time';

export interface PriceParams {
  pricePerSong?: number;                 // 코인 단품 곡당(원)
  bundle?: { x: number; y: number };     // 묶음: X원에 Y곡 (옵션)
  blockMin?: number;                     // 코인 시간제 블록(분)
  blockPrice?: number;                   // 블록당 요금
  hourlyRate?: number;                   // 룸 시간당
  freeMin?: number;                      // 서비스타임(분, 옵션)
}
export interface CalcInput {
  songCount: number;
  avgMinPerSong?: number;                // 기본 3.7
  perSongMinutes?: number[];             // 있으면 합산이 avg보다 우선
  mode: KaraokeMode;
  people: number;                        // >=1
  price: PriceParams;
}
export interface CalcResult {
  totalMin: number; totalCost: number; perPerson: number;
  blocks?: number; hours?: number;
}
```

### 6-2. 규칙 (SPEC §8과 동일)
- `totalMin = perSongMinutes 합` 또는 `songCount × (avgMinPerSong ?? 3.7)`, 반올림 정수.
- **코인 곡당** 묶음 최저가(과다청구 방지):
  `coinCost(N,P,bundle) = bundle ? floor(N/Y)*X + min((N%Y)*P, X) : N*P`
- **코인 시간제**: `blocks = ceil((totalMin - freeMin?) / blockMin)`, `cost = blocks*blockPrice` (blocks ≥ 0).
- **룸 시간제**: `hours = ceil((totalMin - freeMin?) / 60)`, `cost = hours*hourlyRate`.
- `perPerson = round(totalCost / max(people,1))`.
- 역계산: `reverseByTime(limitMin) = floor(limitMin / avg)`; `reverseByBudget(budget)`는 곡당 유효단가(`bundle ? X/Y : P`)로 `floor(budget / unit)`.

### 6-3. 테스트 벡터 (Vitest 필수)
| 입력 | 기대 |
|---|---|
| 코인곡당 N=4, P=500, bundle{X:1000,Y:3} | cost 1500 |
| 〃 N=3 | 1000 |
| 〃 N=6 | 2000 |
| 코인곡당 N=10, P=500, no bundle | 5000 |
| 코인시간제 totalMin=90, block=30, price=5000 | blocks 3, cost 15000 |
| 룸 totalMin=90, hourly=20000 | hours 2, cost 40000 |
| perPerson cost=12000, people=4 | 3000 |
| reverseByTime limit=60, avg=3.7 | 16 |
| N=0 (전부) | cost 0, perPerson 0, 에러 없음 |

---

## 7. 곡 DB 시드 파이프라인 (M0, 병렬 트랙)

- 목표: `songs` 테이블에 title/artist/tj_no/ky_no/chosung/itunes_art_url 채움.
- 절차: ① 시드 소스 확보(오픈소스/2차, §SPEC 9) → ② 정규화·중복 병합 → ③ 초성 생성 → ④ iTunes로 앨범아트/길이 보강(곡당 1회, 캐시) → ⑤ Supabase upsert.
- 신곡 델타: cron(하루 1회) 신곡 목록만 append(§SPEC 9-3).
- **주의**: 통째 미러링 금지, 출처 고지·삭제요청 경로. iTunes 호출은 rate-limit 존중·캐시.
- 산출: `scripts/seed/` (Node 스크립트) + `songs` 채워진 상태. **MVP는 소규모 시드(인기곡 수천)로 시작 가능.**

---

## 8. 작업 분해 (마일스톤)

| M | 이름 | 핵심 산출 | 완료조건(요약) |
|---|---|---|---|
| **M0** | 곡 DB 시드 | `songs` 채움, 검색 RPC | 인기곡 검색 시 TJ/KY 번호 반환 |
| **M1** | 스캐폴딩·디자인·PWA shell | Next 프로젝트, 토큰, 레이아웃, manifest/SW | 빈 홈이 디자인 토큰으로 렌더, 설치 가능 |
| **M2** | 검색·담기 | `/search`, Dexie 리스트, 담기 | 검색→담기→홈 리스트 반영, 새로고침 유지 |
| **M3** | 계산 엔진·UI | `lib/calc.ts`+테스트, 홈 계산 요약 | 3모드+역계산 동작, 테스트 통과 |
| **M4** | 티켓·공유 | 티켓 카드, 이미지 export, slug 저장, OG | 링크 생성·카톡 미리보기·PNG 저장 |
| **M5** | fork | `/s/[slug]` 뷰 + "내 플리로 저장" | 공유 링크 열어 로컬 복제, forked_from 기록 |
| **M6** | 폴리시·히스토리·배포 | 히스토리, 빈상태/에러, a11y, 배포 | Lighthouse PWA 통과, Vercel 배포 |

각 M의 상세 태스크·AC는 §11 프롬프트에 포함.

---

## 9. 테스트 전략 — 정본은 TEST_PLAN (v1.3)

> 테스트 종류·시나리오 전문(정상 6종+비정상 6종)·시드 의존성·리포트 형식·실패 프로토콜의 정본: [`verification/TEST_PLAN.md`](./verification/TEST_PLAN.md).
> 계산 엔진 **테스트 벡터 값**만 이 문서 §6-3이 정본으로 유지된다(TEST_PLAN이 그 표를 실행). 자가감사 채점은 [`verification/QA_MATRIX.md`](./verification/QA_MATRIX.md).

## 10. 배포·환경
- `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_KAKAO_JS_KEY`.
- Vercel 배포(Preview=PR, Prod=main). PWA는 프로덕션에서 검증.
- 비밀키는 클라 노출 금지(anon key만 공개). 시드 스크립트는 service_role을 로컬 env로만.

---

## 11. AI 빌드 프롬프트 (코덱스/오푸스 붙여넣기용)

> 규칙: **11-0을 항상 먼저 붙이고**, 이어서 해당 마일스톤 프롬프트를 붙인다. 저장소 루트에서 실행 가정.

### 11-0. 공통 컨텍스트 (프리앰블 — 매 프롬프트 앞에)
```
너는 '싱송(SingSong)' — 코인노래방 세션 플래너 PWA를 만드는 시니어 프론트엔드 엔지니어다.
가장 먼저 docs/README.md 를 읽어라(문서 지도·정본 소유권 표). 제품은 docs/PRODUCT_SPEC.md §1·§6·§7,
실행 계획은 docs/BUILD_PLAN.md §1~§3. 그 외 문서는 각 마일스톤의 [참조 문서]에 지정된 것만 읽는다.

[스택 고정] BUILD_PLAN §2가 정본: Next.js 15(App Router, TS strict), Tailwind CSS v4, Dexie.js,
Supabase(Postgres) JS SDK, TanStack Query, Zustand, Zod, html-to-image, next/og,
Kakao JS SDK, Framer Motion, Vitest, Playwright, pnpm, Node 20+. 임의 추가 금지.

[불변 원칙]
- 로그인/회원가입 없음. 개인 데이터는 전부 로컬(Dexie). 서버엔 '공유 스냅샷'만 올린다.
- 미디어(오디오/이미지)를 우리가 호스팅하지 않는다. 앨범아트는 iTunes URL만.
- 홈은 항상 '세션 플래너'가 중심. 발견/셀럽/결제는 이번 범위 아님.
- 색·타이포·간격·모션 값은 docs/design/DESIGN_SYSTEM.md 토큰이 유일 정본 — 코드에 hex 하드코딩 금지.
  (골드 대비 교정 --gold-text, --danger 등 초안에 없던 토큰이 그 문서에 있다. 요약을 믿지 말고 읽어라.)
- 사용자 노출 문구는 docs/design/MICROCOPY.md 사전에서만. 즉석 작문 금지.
- 공유 payload(title/memo/tags)는 신뢰 불가 입력 — dangerouslySetInnerHTML 전면 금지.

[작업 방식] 파일 단위로 완결되게 작성. 타입 명시. 마일스톤 시작 전 [참조 문서]에서 핵심 규칙
1~2문장을 그대로 인용해 재진술하고 시작하라(인용 없으면 안 읽은 것). 문서에 답 없는 결정은
보수적 기본값 채택 후 저장소 루트 DECISIONS_LOG.md에 기록. 끝나면 '완료 조건'을 실제 실행으로
점검하고 통과 여부를 리포트하라(형식: docs/verification/TEST_PLAN.md).
```

### 11-1. M1 — 프로젝트 스캐폴딩 · 디자인 토큰 · PWA shell
```
[참조 문서] design/DESIGN_SYSTEM.md(전체 — 토큰 정본), design/COMPONENTS.md(기본 컴포넌트),
engineering/ARCHITECTURE.md §3(폴더 구조)
[작업] Next.js 15 프로젝트를 스캐폴딩하고 디자인 시스템과 PWA shell을 구성하라.
1) pnpm으로 Next 15(App Router, TS, ESLint) 생성. Tailwind v4, §2 스택 의존성 설치.
   폴더 구조는 ARCHITECTURE §3 정본 그대로.
2) app/globals.css에 DESIGN_SYSTEM §1·§3의 토큰 표를 CSS 변수로 그대로 옮긴다
   (라이트/다크: prefers-color-scheme + [data-theme] 오버라이드 둘 다). hex는 그 문서에만 있다.
   폰트: DESIGN_SYSTEM §4(Pretendard self-host + 시스템 모노 스택). tabular-nums 유틸.
3) app/layout.tsx: 하단 탭바(홈/검색 — 2탭 확정, UX_FLOWS §2-1) + 상단 브랜드('싱송'). 코어=홈 강조.
4) PWA: manifest.webmanifest(이름 싱송, 테마컬러=DESIGN_SYSTEM의 --point 값, 아이콘 자리),
   서비스워커로 앱쉘 캐시(전략: ARCHITECTURE §7).
5) app/page.tsx: 빈 홈 — CTA·빈 상태 카피는 MICROCOPY §4-1 키 사용.
[완료조건]
- pnpm dev 로 홈 렌더, 라이트/다크 전환 시 토큰 반영(DESIGN_SYSTEM §2 대비표 값과 일치).
- Lighthouse PWA "설치 가능" 통과, manifest 유효.
- 색/폰트가 토큰에서만 나옴(하드코딩 색 grep 0건). TS strict 에러 0.
```

### 11-2. M2 — 곡 검색 · 담기
```
[참조 문서] engineering/API_CONTRACT.md §1~§3(DDL·RPC·RLS 정본), engineering/ARCHITECTURE.md §4(Dexie),
design/SCREENS.md(/·/search), engineering/PLATFORM_NOTES.md §1~§2(IME·초성 엣지)
[전제] Supabase에 songs 테이블과 검색 RPC가 있다(API_CONTRACT §1~§2 그대로).
없으면 supabase/migrations 에 API_CONTRACT §6 파일 규칙대로 DDL·RPC·RLS를 함께 작성하라.
[작업]
1) lib/supabase.ts: 클라이언트(anon). lib/chosung.ts: 초성 유틸(PLATFORM_NOTES §2 케이스 표) + Vitest.
2) lib/db.ts: Dexie 스키마(ARCHITECTURE §4 정본). lib/lists.ts: 리스트/아이템 CRUD(로컬).
3) /search: SCREENS §4 그대로 — 독립 페이지, SearchInput(디바운스 200ms+AbortController+
   isComposing 처리는 PLATFORM_NOTES §1 스니펫), 결과에 TJ/KY 번호·앨범아트, 담기(＋)·재탭 제거 토글.
   담을 리스트 없으면 자동 '오늘의 플리' 생성.
4) 홈(/): SCREENS §3 그대로 — 현재 리스트(liveQuery), 곡 삭제·순서변경, 상태 매트릭스 전부.
[완료조건]
- "밤편지"·"ㅂㅍㅈ"(초성)·번호로 검색 시 해당 곡 반환(정렬 계약: API_CONTRACT §2-1 ①~④).
- 담기→홈 즉시 반영, 새로고침 후 유지(IndexedDB). 한글 조합 중 Enter 오발동 없음.
- chosung 유틸 테스트 통과(TEST_PLAN §2-2 10케이스).
```

### 11-3. M3 — 계산 엔진 · 계산 UI
```
[참조 문서] BUILD_PLAN §6(계산 스펙 정본 — 이 문서), design/SCREENS.md §3(계산 카드),
design/COMPONENTS.md(SegmentedControl·Stepper·PriceInput·RangeSlider), engineering/ARCHITECTURE.md §2-1(파라미터 자동 영속)
[작업]
1) lib/calc.ts: docs/BUILD_PLAN.md §6의 타입·규칙 그대로 구현(순수 함수).
   estimateTotalMin, calcCost, reverseByBudget, reverseByTime.
2) test/calc.test.ts: §6-3 테스트 벡터 전부 구현. 전부 통과해야 함.
3) 홈 하단 '세션 요약' 카드: 모드 탭(코인 곡당 / 코인 시간제 / 룸 시간제),
   인원 스텝퍼, 요금 파라미터 입력(프리셋: 코인 500원/곡, 시간제 30분 5000원, 룸 시간당 20000원).
   출력: 총 시간·총 금액·1인당(--gold-text — 골드 원색 텍스트 금지, DESIGN_SYSTEM §2).
   역계산: 예산/시간 슬라이더 → 가능 곡수 M 표시. 파라미터는 유효 확정 시 자동 영속(ARCHITECTURE §2-1).
[완료조건]
- Vitest 전부 통과(특히 묶음 최저가 1500원 케이스).
- 모드 전환·인원·요금 바꾸면 요약이 실시간 갱신, 1인당은 --gold-text+tabular-nums.
- N=0에서 에러 없이 0 표기. 새로고침 후 모드·인원·요금 복원.
```

### 11-4. M4 — 티켓 생성 · 공유(링크 + 이미지 + OG)
```
[참조 문서] design/SCREENS.md §6(/ticket — slug 세션 재사용 정책 포함), design/COMPONENTS.md §9(TicketCard 크래프트),
engineering/API_CONTRACT.md §1-3·§4(shared_lists·Zod), engineering/SECURITY.md §2(XSS),
engineering/PLATFORM_NOTES.md §5~§8(카카오 인앱·html-to-image·next/og·Web Share)
[작업]
1) components/TicketCard.tsx: 컨셉 보드의 티켓 디자인(절취선·타공·바코드·좌석=곡수/시간/1인당).
   props로 title·when·songCount·totalMin·perPerson·serial.
2) /ticket/[id]: 내 리스트로 티켓 미리보기. 버튼 3개:
   (a) 이미지 저장: html-to-image로 카드 PNG 다운로드.
   (b) 링크 공유: 현재 리스트 스냅샷을 Supabase shared_lists에 upsert(slug=nanoid) → /s/[slug] URL 생성 → Web Share/복사.
   (c) 카톡 공유: Kakao SDK 링크 공유(썸네일=OG).
3) app/s/[slug]/opengraph-image.tsx: next/og로 티켓형 OG 이미지 생성(카톡 미리보기).
4) lib/share.ts: 스냅샷 직렬화(Zod 스키마 ListItemSnapshot[]) + slug 생성.
[완료조건]
- '이미지 저장'이 실제 PNG(티켓 디자인) 저장.
- '링크 공유'가 유효한 /s/[slug] 생성, 새 slug가 shared_lists에 저장.
- /s/[slug] 링크를 카톡에 붙이면 OG 티켓 미리보기가 뜬다(OG 이미지 200 응답).
- 미디어 자체 호스팅 없음(이미지는 클라 렌더).
```

### 11-5. M5 — 공유 뷰 · fork(내 플리로 저장)
```
[참조 문서] design/SCREENS.md §7(/s/[slug] — 원작자 표기 없음 확정), design/UX_FLOWS.md 여정⑤·§3(신뢰 UX),
engineering/API_CONTRACT.md §2-2·§4·§5(increment_fork·역직렬화 drop·에러 계약)
[작업]
1) app/s/[slug]/page.tsx: 공유 스냅샷을 SSR로 읽어 읽기전용 티켓+곡목록 표시. 원작자 표기(있으면).
2) '내 플리로 저장' 버튼: payload를 로컬 Dexie에 새 리스트로 복제,
   lists.forkedFrom=slug 기록, shared_lists.fork_count += 1(RPC).
3) fork 후 홈으로 이동, 저장 완료 토스트("내 플리에 담았어! 🎤").
[완료조건]
- 다른 브라우저/시크릿창에서 /s/[slug] 열람 가능(로그인 없이).
- '내 플리로 저장' → 로컬에 독립 복제본 생성, 원본과 별개로 편집 가능.
- forkedFrom 기록됨, fork_count 증가.
- 잘못된 slug는 친절한 404 카피.
```

### 11-6. M6 — 히스토리 · 폴리시 · a11y · 배포
```
[참조 문서] verification/TEST_PLAN.md(전체 — 실제 실행), verification/QA_MATRIX.md(자가감사),
design/MICROCOPY.md(문구 전수 대조), engineering/PLATFORM_NOTES.md §3~§4(persist·PWA 설치), engineering/ANALYTICS.md(이벤트 전수)
[작업]
1) 히스토리: 티켓 '오늘 이거 부름' 체크 시 history에 기록, 홈에 "지난번에 부른 곡" 섹션(재담기).
2) 빈상태/로딩/에러 카피 전부 친구톤. 스켈레톤.
3) a11y: 키보드 포커스 가시화, 대비 확인, prefers-reduced-motion. 시맨틱 태그.
4) PWA 마감: 오프라인에서 앱쉘+마지막 리스트 열람, 설치 프롬프트.
5) 배포: Vercel 연결, 환경변수, 프로덕션 빌드. README에 실행/배포 절차.
[완료조건]
- Lighthouse: PWA 설치가능 + a11y 90+.
- 오프라인에서 내 리스트 열람 가능.
- Vercel 프로덕션 URL에서 담기→계산→공유→fork 해피패스 동작.
```

---

## 12. 모델에게 강조할 주의점 (프롬프트에 이미 반영, 재확인용)
- 로그인·계정·결제 코드 만들지 말 것(이번 범위 아님).
- 개인 데이터를 서버로 보내지 말 것(공유 스냅샷 제외).
- 색·폰트는 토큰에서만. 하드코딩 금지.
- 곡·매장·번호는 예시 데이터 OK지만, 실제 크롤링/미디어 호스팅 코드는 넣지 말 것.
- 계산 엔진은 순수함수 + 테스트 우선(묶음 최저가 공식 정확히).

---

## 13. 원샷 마스터 프롬프트 — v2로 이관됨 (v1.3)

> **정본: [`prompts/ONESHOT_MASTER.md`](./prompts/ONESHOT_MASTER.md) (v2).** 이 절에 있던 v1 프롬프트는 폐기됐다 — v2는 v1의 Phase 0~10 골격·핸드오프·금지 항목을 승계하면서 하위모델 실패 방지 장치를 추가했다:
> Phase별 참조 문서 화이트리스트 · 인용 강제(읽었다는 자기신고 무효) · grep형 안티패턴 자가검사 · 모호함 대응 프로토콜(DECISIONS_LOG) · 반복 앵커링 · Phase 8.5 자가감사(QA_MATRIX 채점) · 정량 비교 채점.
> 코덱스 vs 오푸스 비교·재개 방법도 그 문서 하단 "돌리는 팁" 참조. Phase↔마일스톤(M) 환산표는 [`README.md`](./README.md) §4.

---

## 14. 디자인 퀄리티 바 (Design Quality Bar) — 자가채점표만 유지 (v1.3)

> 기준: "대충 되는 UI"가 아니라 **"캡처해서 공유하고 싶은 앱"**.
> 규칙의 **값**(타입 스케일·8pt 그리드·대비 수치·모션 토큰·금지 목록)은 [`design/DESIGN_SYSTEM.md`](./design/DESIGN_SYSTEM.md), 티켓 크래프트 상세는 [`design/COMPONENTS.md`](./design/COMPONENTS.md) §9가 정본이다. 여기는 **Phase 1/6/7 완료 인정용 O/X 자가채점 목록**만 남긴다.

**자가 채점 (Phase 8 보고 포함 — 각 항목 O/X + 근거 스크린샷)**
- [ ] 티켓 카드 = 히어로 (절취선·타공·바코드·시리얼 — COMPONENTS §9 스펙 그대로)
- [ ] 타입 스케일 고정·한 화면 위계 3단계 이하·큰 숫자가 시각적 주인공 (DESIGN_SYSTEM §4)
- [ ] 8pt 여백 리듬·라운드 일관·로즈=액션만·골드=금액만(텍스트는 `--gold-text`) (DESIGN_SYSTEM §5·§2)
- [ ] 라이트/다크 둘 다 1급 — 대비 검증표 값과 실측 일치 (DESIGN_SYSTEM §2)
- [ ] 모바일 퍼스트: 엄지 도달권 CTA·바텀시트/탭바·44px+ 터치 타깃 (DESIGN_SYSTEM §7)
- [ ] 빈상태/로딩/에러 성의: 스켈레톤 + MICROCOPY 카피 + 일러성 SVG
- [ ] 마이크로인터랙션 핵심 4곳만(담기 스프링·카운트업·발권·전환), 전부 reduced-motion 존중 (DESIGN_SYSTEM §6)
- [ ] AI 디폴트룩·하드코딩 색·이모지 남발 없음 (DESIGN_SYSTEM §9 금지 목록, grep 0건)
- 스크린샷: 홈/검색/티켓/공유뷰 × 라이트·다크 8장 (TEST_PLAN §6 규칙)

---

## 15. 기능 동작 검증 프로토콜 — 이관됨 (v1.3)

> **정본: [`verification/TEST_PLAN.md`](./verification/TEST_PLAN.md).** 이 절에 있던 프로토콜(원칙·해피패스 6종·리포트 형식)은 그 문서로 이관·확장됐다 — 비정상 경로 6종(잘못된 slug·위조 payload·오프라인 공유 시도·빈 리스트 티켓·IME 조합 Enter·100곡 초과), 계약 테스트(API_CONTRACT §8 실행 절차), 시드 의존성, a11y 자동+수동, 성능 기준까지 포함한다.
> 핵심 원칙은 불변: **컴파일/타입 통과 ≠ 동작. 실행 증거 필수. 실패는 실패로 보고 → 수정 → 재실행. 가짜 통과 금지.**

---

*이 계획은 Phase A(PWA MVP) 한정. Phase B(네이티브·계정·결제)·발견/셀럽·그룹 큐는 별도 계획 문서로.*
