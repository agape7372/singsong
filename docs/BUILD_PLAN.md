# 싱송 — 구현 계획 (Build Plan) & AI 빌드 프롬프트

> 짝 문서: [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) (제품/설계). 이 문서는 **엔지니어링 실행 계획 + 코덱스/오푸스에 붙여넣을 프롬프트**다.
> **범위**: Phase A = 로그인 없는 PWA MVP (담기 → 계산 → 티켓 공유 → fork). 발견/셀럽·결제·네이티브는 이 문서 범위 밖(후속).
> **버전**: v1.0 · 2026-07-21

---

## 0. 이 문서 사용법 (코덱스 vs 오푸스 병행)

1. 실제 구현은 **코덱스와 오푸스에 각각** §11의 프롬프트를 붙여넣어 돌린 뒤, 결과 비교해 좋은 쪽 채택.
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
| 테스트 | **Vitest**(계산·유틸), Playwright(후속 e2e) | 계산 엔진은 순수함수라 단위테스트 필수 |
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

## 4. 데이터 모델

### 4-1. Supabase (Postgres) DDL
```sql
-- 곡 카탈로그 (읽기 전용, 시드/델타로 채움)
create table songs (
  id           bigint generated always as identity primary key,
  title        text not null,
  artist       text not null,
  tj_no        text,
  ky_no        text,
  chosung      text,          -- 예: "ㅂㅍㅈ ㅇㅇㅇ" (title+artist 초성)
  itunes_art_url text,
  duration_sec int,
  created_at   timestamptz default now()
);
create index songs_trgm    on songs using gin ((title || ' ' || artist) gin_trgm_ops);
create index songs_chosung on songs using gin (chosung gin_trgm_ops);

-- 공유 스냅샷 (링크/포크용). 개인 리스트는 여기 안 옴; 공유 시에만 스냅샷 저장
create table shared_lists (
  slug            text primary key,     -- nanoid(10)
  title           text not null,
  payload         jsonb not null,       -- ListItemSnapshot[] (아래 타입)
  calc_snapshot   jsonb,                -- {mode, people, price, result} (옵션)
  created_by_device text,               -- 익명 device uuid (소유 판단용, 로그인 아님)
  fork_count      int default 0,
  created_at      timestamptz default now()
);

-- RLS: songs 읽기 public; shared_lists insert/select public(slug 기반), update는 fork_count만
```
```jsonc
// payload 항목 타입 (ListItemSnapshot)
{ "songId": 123, "title": "밤편지", "artist": "아이유",
  "tjNo": "48210", "kyNo": null, "myKey": "-2", "memo": "",
  "tags": ["발라드"], "order": 0 }
```

### 4-2. 로컬 (Dexie) 스키마
```ts
// lib/db.ts
db.version(1).stores({
  lists:     '++id, title, forkedFrom, updatedAt',
  listItems: '++id, listId, songId, [listId+order]',  // 곡 필드 비정규화(오프라인)
  history:   '++id, songId, sungAt',
  settings:  'key',                                     // deviceId, 요금 프리셋 등
});
```
> `tags`는 문자열 배열이지만 Dexie/JSON은 배열 OK. 서버 payload도 JSON이라 §SPEC의 "PG 배열 회피"와 일관(Postgres 컬럼엔 배열 안 씀).

---

## 5. 정보구조 / 라우팅 (코어 우선)

| 경로 | 화면 | 비고 |
|---|---|---|
| `/` | **홈 = 세션 플래너** | 현재 리스트 + 계산 요약 + "티켓 만들기". 앱의 중심 |
| `/search` | 곡 검색·담기 | 홈에서 모달로 열어도 됨 |
| `/list/[id]` | 리스트 상세/편집 | 곡 순서·노트·태그 |
| `/ticket/[id]` | 티켓 미리보기·공유 | 이미지 export·링크·카톡 |
| `/s/[slug]` | **공유 뷰(읽기전용)** | "내 플리로 저장"(fork) 버튼 |
| `/discover` | (후속) 발견 탭 | Phase A 미포함, 라우트 자리만 |

> IA 원칙(§SPEC 7-5): 홈은 항상 플래너. 발견은 후속 2차 탭.

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

## 9. 테스트 전략
- **계산 엔진**: Vitest 단위테스트(§6-3 벡터) — 필수, 커버리지 100% 목표.
- **초성 유틸**: 단위테스트(경계: 자음/모음/영문/숫자 혼합).
- **fork/공유 payload**: Zod 스키마 검증 + 왕복(직렬화→역직렬화) 테스트.
- **e2e(후속)**: Playwright로 담기→계산→공유→fork 해피패스.

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
제품/설계는 docs/PRODUCT_SPEC.md, 구현계획은 docs/BUILD_PLAN.md 에 있다(먼저 읽어라).

[스택 고정] Next.js 15(App Router, TS strict), Tailwind CSS v4, Dexie.js(IndexedDB),
Supabase(Postgres) JS SDK, TanStack Query, Zustand, Zod, html-to-image, next/og,
Kakao JS SDK, Vitest, pnpm, Node 20+.

[불변 원칙]
- 로그인/회원가입 없음. 개인 데이터는 전부 로컬(Dexie). 서버엔 '공유 스냅샷'만 올린다.
- 미디어(오디오/이미지)를 우리가 호스팅하지 않는다. 앨범아트는 iTunes URL만.
- 홈은 항상 '세션 플래너'가 중심. 발견/셀럽/결제는 이번 범위 아님.
- 디자인 토큰(컨셉): 베이스 #FDF6F9, 포인트 로즈 #FF2E74, 코인 골드 #F5A623(금액에만),
  잉크 #1C1622. 라이트/다크 둘 다. 번호/금액은 모노스페이스+tabular-nums. 말투는 친구톤.

[작업 방식] 파일 단위로 완결되게 작성. 타입 명시. 임의 스택 추가 금지.
끝나면 '완료 조건'을 스스로 점검하고 통과 여부를 리포트하라.
```

### 11-1. M1 — 프로젝트 스캐폴딩 · 디자인 토큰 · PWA shell
```
[작업] Next.js 15 프로젝트를 스캐폴딩하고 디자인 시스템과 PWA shell을 구성하라.
1) pnpm으로 Next 15(App Router, TS, ESLint) 생성. Tailwind v4, 위 스택 의존성 설치.
2) app/globals.css에 디자인 토큰을 CSS 변수로 정의(라이트/다크: prefers-color-scheme + [data-theme]).
   토큰: --bg,--surface,--ink,--muted,--line,--point(#FF2E74),--gold(#F5A623),--point-soft.
   폰트: 본문 Pretendard 스택, 숫자/번호용 모노 스택. tabular-nums 유틸.
3) app/layout.tsx: 하단 탭바(홈/검색/내 리스트) + 상단 브랜드('싱송'). 코어=홈 강조.
4) PWA: manifest.webmanifest(이름 싱송, 테마컬러 #FF2E74, 아이콘 자리), 서비스워커로 앱쉘 캐시.
5) app/page.tsx: 빈 홈 — "부를 곡 담기" CTA + 빈 상태 카피(친구톤).
[완료조건]
- pnpm dev 로 홈 렌더, 라이트/다크 전환 시 토큰 반영.
- Lighthouse PWA "설치 가능" 통과, manifest 유효.
- 색/폰트가 토큰에서만 나옴(하드코딩 색 금지). TS strict 에러 0.
```

### 11-2. M2 — 곡 검색 · 담기
```
[전제] Supabase에 songs 테이블과 초성 검색 RPC가 있다(docs/BUILD_PLAN.md §4,§7).
없으면 supabase/migrations 에 DDL과 RPC search_songs(q text)를 함께 작성하라.
[작업]
1) lib/supabase.ts: 클라이언트(anon). lib/chosung.ts: 한글 초성 추출 유틸 + Vitest 테스트.
2) lib/db.ts: Dexie 스키마(§4-2). lib/lists.ts: 리스트/아이템 CRUD(로컬).
3) /search: 검색 인풋(디바운스) → search_songs 호출(제목/가수/번호/초성). 결과에 TJ/KY 번호·앨범아트.
   각 결과에 '담기(＋)'. 담을 리스트 없으면 자동 '오늘의 플리' 생성.
4) 홈(/): 현재 리스트의 곡들 표시(Dexie liveQuery), 곡 삭제·순서변경(드래그 or 위/아래).
[완료조건]
- "밤편지"·"ㅂㅍㅈ"(초성)·번호로 검색 시 해당 곡 반환.
- 담기→홈 즉시 반영, 새로고침 후 유지(IndexedDB).
- chosung 유틸 테스트 통과(자음/모음/영문/숫자 혼합 케이스 포함).
```

### 11-3. M3 — 계산 엔진 · 계산 UI
```
[작업]
1) lib/calc.ts: docs/BUILD_PLAN.md §6의 타입·규칙 그대로 구현(순수 함수).
   estimateTotalMin, calcCost, reverseByBudget, reverseByTime.
2) test/calc.test.ts: §6-3 테스트 벡터 전부 구현. 전부 통과해야 함.
3) 홈 하단 '세션 요약' 카드: 모드 탭(코인 곡당 / 코인 시간제 / 룸 시간제),
   인원 스텝퍼, 요금 파라미터 입력(프리셋: 코인 500원/곡, 시간제 30분 5000원, 룸 시간당 20000원).
   출력: 총 시간·총 금액·1인당(골드). 역계산: 예산/시간 슬라이더 → 가능 곡수 M 표시.
[완료조건]
- Vitest 전부 통과(특히 묶음 최저가 1500원 케이스).
- 모드 전환·인원·요금 바꾸면 요약이 실시간 갱신, 1인당은 골드 컬러+tabular-nums.
- N=0에서 에러 없이 0 표기.
```

### 11-4. M4 — 티켓 생성 · 공유(링크 + 이미지 + OG)
```
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

*이 계획은 Phase A(PWA MVP) 한정. Phase B(네이티브·계정·결제)·발견/셀럽·그룹 큐는 별도 계획 문서로.*
