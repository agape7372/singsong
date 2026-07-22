# ARCHITECTURE.md — 클라이언트 구조·상태 소유권·에러/성능/캐싱 정본

> **v3 레거시 경고 (2026-07-21)**: 기존 구조 이력 참고용이다. 단일 플랜, BFF 공유 경계, 최소 상태 라이브러리, PWA cache 정책은 [`../FINAL_BLUEPRINT.md`](../FINAL_BLUEPRINT.md)가 우선한다.

> **정본 범위**: 데이터 흐름 · 상태 소유권(Dexie/Zustand/TanStack Query/URL) · 폴더 구조와 모듈 의존 규칙 · Dexie 스키마와 마이그레이션 정책 · 클라 에러 처리 전략 · 성능 예산 · PWA 캐싱 전략 · 무거운 의존성 지연 로드 규칙.
> 다른 문서(BUILD_PLAN 구§4-2 포함)와 이 문서가 어긋나면 **이 문서가 이긴다**.
> **버전**: v1.0 · 2026-07-21 · 짝 문서: [`API_CONTRACT.md`](./API_CONTRACT.md)(서버 쪽 소유권), [`ANALYTICS.md`](./ANALYTICS.md)(계측)

---

## 0. 전제

이 문서는 BUILD_PLAN §2(스택)·§3(아키텍처 개요)을 승계·상술한다. 스택 자체(Next.js 15 등)를 바꾸는 결정은 이 문서가 아니라 BUILD_PLAN §2 정본이다. 여기서는 "그 스택 안에서 상태와 코드가 어디에 사는가"만 정한다.

---

## 1. 데이터 흐름도

```
                          ┌─────────────────────────────┐
                          │   사용자 기기 (브라우저)        │
                          │                               │
  검색어 입력 ──────────▶  │  UI (app/, components/)      │
                          │        │            ▲         │
                          │        │읽기/쓰기    │구독      │
                          │        ▼            │         │
                          │   Zustand(draft)  Dexie(liveQuery)
                          │   계산 파라미터    lists/listItems/
                          │   UI 상태          history/settings
                          │        │            ▲         │
                          │        │  "티켓 만들기"│ fork   │
                          │        │  "공유하기"   │ 저장   │
                          └────────┼─────────────┼─────────┘
                                   ▼             │
                     [검색만]                [공유 시에만]
                    search_songs RPC        shared_lists insert/select
                    (Supabase, anon)        (Supabase, anon) — slug 발급
                          │                       │
                          ▼                       ▼
                  ┌───────────────┐      ┌────────────────────┐
                  │ songs (읽기전용) │      │ shared_lists (스냅샷) │
                  │ Supabase Postgres│      │ Supabase Postgres    │
                  └───────────────┘      └────────────────────┘
                                                  │
                                    다른 기기가 /s/[slug] 열람
                                    → SSR select → payload Zod 파싱
                                    → "내 플리로 저장" → 그 기기의 Dexie로 복제
```

**요지 (API_CONTRACT §0 승계)**
- 서버는 두 가지만 안다: **곡 카탈로그**(읽기) · **공유 스냅샷**(제한적 쓰기).
- 개인 리스트·노트·히스토리·계산 draft는 **서버에 절대 전송되지 않는다**. "공유하기"를 누른 순간에만 그 시점 스냅샷이 `shared_lists`로 push된다 — 이후 원본을 수정해도 이미 공유된 slug는 갱신되지 않는다(불변 스냅샷, API_CONTRACT §1-3 고찰).
- 검색은 항상 서버 왕복(RPC), 계산은 항상 로컬(순수 함수, `lib/calc.ts`).

---

## 2. 상태 소유권 표 (핵심)

**원칙: 같은 데이터를 두 곳에 "정본"으로 두지 않는다.** 아래 표에서 소유자가 아닌 계층에 같은 값이 보이면 그것은 파생/캐시/복사본이며, 정본이 바뀌면 갱신되어야 한다.

| 계층 | 소유하는 데이터 | 수명 | 왜 여기인가 |
|---|---|---|---|
| **Dexie**(IndexedDB) | 영속 개인 데이터: `lists`, `listItems`, `history`, `settings`(deviceId·요금 프리셋·마지막 사용 모드) | 기기에 영구(사용자가 지우기 전까지) | 로그인 없는 local-first 모델의 유일한 "내 데이터" 저장소(PRODUCT_SPEC §10-2, §11). 새로고침·오프라인에도 살아있어야 하는 것 전부. |
| **Zustand** | 휘발 세션 상태: 계산 draft(`mode`, `people`, `price` 파라미터 편집 중 값), UI 상태(BottomSheet 열림, 선택된 탭, 진행 중 폼 입력) | 탭을 닫으면 소멸(새로고침 시 §2-1의 settings 값으로 재초기화) | "지금 만지작거리는 중"인 값. 매 키입력마다 Dexie에 쓰면 과도한 I/O·마이그레이션 리스크가 커진다. 유효 확정 시에만(§2-1) Dexie로 내려간다. |
| **TanStack Query** | 서버 읽기 캐시: `search_songs` 결과, `/s/[slug]` 공유 뷰 데이터 | 쿼리 키 기준 짧은 staleTime(추정: 검색 0, 공유 뷰는 SSR 최초 로드 후 클라 refetch 안 함) | 서버가 정본인 데이터의 읽기 캐시일 뿐, 우리가 쓰기를 소유하지 않는다. 로컬에 영속시키지 않는다(다음 방문 시 다시 최신을 받아야 함 — 곡 DB는 계속 갱신되므로). |
| **URL** | 화면 위치: 라우트, `[id]`, `[slug]` — 검색어는 URL에 싣지 않는다(SCREENS §4-6: `/search` 재진입 시 검색어 초기화가 확정 동작) | 브라우저 히스토리 수명 | 뒤로가기·새 탭 공유·북마크가 동작하려면 "어느 화면을 보고 있었나"는 상태 라이브러리가 아니라 URL이 정본이어야 한다. |

### 2-1. 예외: 계산 파라미터의 이중 존재 (자동 영속, 동기화 방향 명시 — 확정)

계산 파라미터(`mode`·`people`·`price`)는 **Dexie `settings`에 마지막 유효값이 영속**되면서 **Zustand draft가 편집 버퍼**를 가진다. 이는 "같은 데이터 두 곳 금지" 원칙의 유일한 의도적 예외이며, 동기화 방향은 **한 방향씩 고정**한다.

```
Dexie.settings(lastMode·lastPeople·pricePreset) ──(앱 시작 시 1회 read)──▶ Zustand.draft
Zustand.draft ──(값이 "유효 확정"될 때마다 자동 write, 디바운스)──▶ Dexie.settings
```

- **자동 영속 확정(명시 "기억하기" 버튼 없음)**: 모드 전환·인원 변경·요금 입력의 **유효 확정값**(PriceInput은 blur+검증 통과 시점, Stepper/SegmentedControl은 즉시)이 디바운스 후 `settings`로 내려간다. 새로고침·재방문 시 마지막 값이 복원된다(UX_FLOWS 여정③ "유지된다" 확정과 정합).
- **저장 제외**: 역계산 슬라이더(RangeSlider) 값은 탐색용 입력이라 영속하지 않는다 — "실수로 튕긴 슬라이더 값 고착" 문제는 애초에 저장 대상에서 빼는 것으로 해결. PriceInput의 검증 실패 값(NaN·범위 초과)도 저장되지 않는다(유효 확정값만).
- 계산 결과(`CalcResult`)는 어디에도 영속되지 않는다(항상 `lib/calc.ts`로 즉시 재계산되는 파생값). 단, "공유하기" 시점의 결과 스냅샷은 API_CONTRACT §4 `calcSnapshotSchema`로 **그 순간만** `shared_lists.calc_snapshot`에 박제된다(이후 원본이 바뀌어도 공유물은 안 바뀜).

---

## 3. 폴더 구조 정본

```
singsong/
  app/                          # 라우트 (Next.js App Router)
    layout.tsx                  # 루트 레이아웃: 하단 TabBar, 상단 브랜드
    globals.css                 # 디자인 토큰 CSS 변수 (DESIGN_SYSTEM.md 정본 값을 그대로 옮김)
    page.tsx                    # /  — 홈 = 세션 플래너 (코어, IA 원칙 PRODUCT_SPEC §7-5)
    not-found.tsx                # 전역 404
    search/
      page.tsx                  # /search — 독립 페이지(모달 아님, 확정 결정)
    list/[id]/
      page.tsx                  # /list/[id] — 리스트 상세/편집
    ticket/[id]/
      page.tsx                  # /ticket/[id] — 티켓 미리보기·공유
    s/[slug]/
      page.tsx                  # /s/[slug] — 공유 뷰(SSR, 읽기전용)
      opengraph-image.tsx       # next/og — 카톡 미리보기 이미지
    manifest.webmanifest        # 또는 app/manifest.ts (Next 동적 manifest)
    sw.ts                       # 서비스워커 소스(§7). 빌드 시 public/sw.js로 산출(추정, 도구 미확정 — §7 참조)
  components/
    ui/                         # 공통 컴포넌트 16종 (목록·props·상태 COMPONENTS.md 정본)
      Button.tsx  Chip.tsx  Stepper.tsx  SegmentedControl.tsx  PriceInput.tsx
      RangeSlider.tsx  TabBar.tsx  SongRow.tsx  TicketCard.tsx  BottomSheet.tsx
      Toast.tsx  Skeleton.tsx  EmptyState.tsx  ConfirmDialog.tsx  SearchInput.tsx
      AttributionBadge.tsx
    session/                    # 화면 조립: 홈(세션 플래너) 전용 조합 컴포넌트 (예: SessionPlanner, CalcCard)
    search/                     # 화면 조립: /search 전용 (예: SearchResultsList)
    ticket/                     # 화면 조립: /ticket, /s 공용 티켓 렌더 래퍼
  lib/                          # React를 모르는 순수 로직 계층
    db.ts                       # Dexie 인스턴스·스키마(§4 정본)
    calc.ts                     # 계산 엔진(순수 함수, BUILD_PLAN §6 정본 그대로 구현)
    chosung.ts                  # 한글 초성 추출 유틸(순수)
    share.ts                    # 공유 payload Zod 스키마 재노출 + 직렬화/역직렬화(API_CONTRACT §4 정본 구현)
    supabase.ts                 # Supabase 클라이언트(anon key)
    analytics.ts                # track() 인터페이스(ANALYTICS.md 정본 구현)
  test/
    calc.test.ts  chosung.test.ts  share.test.ts   # Vitest, lib/ 1:1 대응
  supabase/
    migrations/                 # API_CONTRACT §6 파일 규칙을 따르는 DDL/RPC/RLS
  scripts/
    seed/                       # 로컬 실행 전용, service_role 키 사용(BUILD_PLAN §7)
  public/
    icons/                      # PWA 아이콘 등 코드 생성 SVG/PNG 산출물
```

### 3-1. 모듈 의존 규칙 (역방향 금지)

```
app/  ──▶  components/  ──▶  components/ui/  ──▶  lib/
                 │                                    ▲
                 └──────────────▶  lib/  ─────────────┘
```

- **`lib/`은 React를 모른다.** `lib/*.ts`에 `"use client"`, JSX, React 훅 import 금지 — 전부 순수 함수/클래스/클라이언트 초기화 코드만. 예외: `db.ts`의 `dexie-react-hooks` 재노출은 허용(hooks 자체는 컴포넌트에서 호출).
- **`components/`은 `lib/`을 쓴다.** 계산·초성·DB 접근은 항상 `lib/` 경유. 컴포넌트 안에서 Dexie 쿼리를 직접 새로 짜지 않는다(재사용성·테스트 가능성).
- **`components/ui/`은 도메인을 모른다.** `SongRow`가 `lib/db.ts`를 직접 import하지 않는다 — props로 데이터를 받는다. 도메인 연결은 `components/session/`, `components/search/` 같은 조립 계층의 책임.
- **역방향 금지**: `lib/`이 `components/`나 `app/`을 import하는 순간 순환·번들 비대화가 생긴다. ESLint `no-restricted-imports`로 강제(추정 — Phase 0 셋업 시 규칙 추가 권장).

---

## 4. Dexie 스키마 정본 (BUILD_PLAN 구§4-2에서 이관)

> **이 절이 Dexie 스키마의 유일한 정본이다.** BUILD_PLAN §4-2는 이 문서로 승격 이관되었으며 해당 절은 이력용 초안으로 강등된다(README §3).

```ts
// lib/db.ts
import Dexie, { type Table } from 'dexie';

db.version(1).stores({
  lists:     '++id, title, forkedFrom, updatedAt',
  listItems: '++id, listId, songId, [listId+order]',  // 곡 필드는 비정규화 저장(오프라인 자립)
  history:   '++id, songId, sungAt',
  settings:  'key',                                     // deviceId, 요금 프리셋, 마지막 사용 모드 등
});
```

### 4-1. `settings` 키 목록 (`key` 컬럼 값)

| key | 값 형태 | 용도 |
|---|---|---|
| `deviceId` | UUID 문자열 | 익명 기기 식별(로그인 아님). `shared_lists.created_by_device`에 그대로 실림(API_CONTRACT §1-3). PII 아님 — 이 기기가 만들었다는 표시일 뿐, 계정과 무관. |
| `pricePreset` | `PriceParams` JSON(§2-1) | 마지막 유효 확정 요금 파라미터(자동 영속). |
| `lastMode` | `KaraokeMode` 문자열 | 마지막 사용 계산 모드. 다음 방문 시 Zustand draft 초기값. |
| `lastPeople` | number | 마지막 인원값(자동 영속). 다음 방문 시 draft 초기값. |
| `lastVisitAt` | ISO 8601 문자열 | 재방문 판정용(ANALYTICS §3 `return_visit` 산출 로직에서 읽고 씀). |

`settings`는 key-value 테이블이라 새 설정 추가가 스키마 변경(버전업) 없이 가능하다 — 단 위 표는 **알려진 키의 정본 목록**이므로 새 키를 쓰면 이 표도 갱신한다.

### 4-2. 마이그레이션 정책

1. **version은 단조 증가만 한다.** 되돌리거나 같은 번호를 재사용하지 않는다.
2. **`upgrade()` 콜백 필수.** 스키마를 바꾸는 모든 `db.version(N)` 호출에는 이전 버전 데이터를 새 형태로 옮기는 `upgrade` 콜백을 짝지어 작성한다 — 빈 upgrade라도 명시적으로 남겨 "이관 불필요를 확인했다"는 의도를 드러낸다.
3. **새 필드는 optional만.** 기존 로우에 없는 값이라 `undefined`가 되어도 읽는 쪽이 깨지지 않게 타입을 `field?: T`로 정의하고 읽기 지점에서 기본값을 채운다.
4. **기존 필드의 의미를 바꾸지 않는다.** 예: `listItems.order`가 지금 "0부터 시작하는 정수"라면 나중에 "1부터 시작"으로 바꾸지 않는다 — 바꿔야 하면 새 필드(`orderV2`)를 추가하고 구필드는 deprecate 주석만 남긴다.
5. **기기마다 구버전 공존을 전제한다.** PWA는 서비스워커 캐시 때문에 사용자마다 다른 앱 JS 버전이 오래 남아있을 수 있다(§7-3 업데이트 정책 참고) — 즉 "모든 사용자가 곧 최신 스키마로 넘어온다"고 가정하지 않는다. 구버전 앱 JS가 신버전 Dexie 스키마를 마주쳤을 때 크래시하지 않도록, 필드 삭제보다 "안 쓰지만 남겨두기"를 기본값으로 한다.

---

## 5. 에러 처리 전략

### 5-1. 분류 → 표시 계층 매핑

| 에러 종류 | 표시 계층 | 근거 |
|---|---|---|
| 렌더 중 예기치 못한 JS 예외(버그) | **전역 ErrorBoundary**(`app/` 루트 세그먼트) | 화면 전체가 깨진 상태로는 인라인 처리가 불가능. "새로고침" CTA만 제공, 진단 정보는 사용자에게 노출 안 함(API_CONTRACT §5 공통 규칙: 서버 에러 원문 비노출과 동일 원칙을 클라 예외에도 적용). |
| 검색·공유 생성 등 **서버 요청 실패**(네트워크/5xx/CHECK 위반/slug 없음/Zod 실패) | **화면 인라인** | 분류 자체는 API_CONTRACT §5 정본. 클라는 그 분류를 받아 해당 화면(예: `/search` 결과 영역, `/s/[slug]` 본문)에 재시도 버튼·빈 상태 UI로 흡수한다. 화면을 통째로 날리지 않는다. |
| 부수적·비차단 실패(예: `increment_fork` RPC 실패, analytics 전송 실패) | **무시 또는 Toast(선택)** | 사용자의 주 목표(fork 저장 자체)는 이미 로컬에서 성공했으므로 흐름을 막지 않는다. fire-and-forget(API_CONTRACT §2-2 고찰과 동일 정신). |
| **Dexie 쓰기 실패** | **화면 인라인 + 로컬 상태 유지** | §5-2 참조. |

### 5-2. 로컬(Dexie) 실패 처리

- **용량 초과(`QuotaExceededError`) / 다른 탭에서 스키마 업그레이드 중 차단(`blocked`/`versionchange`)**: Dexie 쓰기가 실패해도 **Zustand/폼 상태의 입력값은 그대로 남긴다** — 실패했다고 입력창을 비우지 않는다. 화면에 "저장 안 됐어, 다시 시도해줄래?" 계열 인라인 문구(정본 문구는 MICROCOPY §X, 여기서는 플레이스홀더)와 재시도 버튼을 둔다.
- 용량 초과는 곡 100개·리스트 다수 수준에서는 사실상 발생하지 않을 것으로 추정(텍스트 데이터 중심, PRODUCT_SPEC §17)이지만, 브라우저별 쿼터 정책 차이(특히 iOS Safari)는 PLATFORM_NOTES §(확인 필요)의 몫이다.

### 5-3. 원칙 — 사용자 입력 보존

**에러로 사용자 입력이 유실되면 안 된다.** 구체적으로:
- 폼/계산 파라미터는 Zustand(휘발이지만 요청 실패와 무관하게 살아있음)에만 의존하고, "저장 성공 후에만 폼을 초기화"하는 패턴을 쓴다 — 낙관적으로 먼저 비우지 않는다.
- 공유 생성(`shared_lists` insert)이 실패해도 로컬 리스트·티켓 draft는 그대로 남아 재시도 시 같은 데이터를 다시 보낼 수 있어야 한다.

---

## 6. 성능 예산

| 항목 | 예산/전략 | 비고 |
|---|---|---|
| 검색 체감 지연 | 입력 디바운스 200ms + `AbortController`로 이전 요청 취소 + 새 결과 도착 전까지 이전 결과 유지(빈 화면 깜빡임 방지) | "체감 <150ms"(PRODUCT_SPEC §15)는 네트워크 왕복 자체를 줄이는 게 아니라 **빈 상태를 보여주지 않는 것**으로 달성 — 디바운스 종료 시점부터 스켈레톤이 아니라 "이전 결과 유지"가 기본. |
| LCP(모바일) | 목표 2.5s (`추정`) | 실측 필요. 홈(`/`)의 LCP 요소는 세션 요약 카드의 큰 숫자로 추정 — 서버 왕복 없이 로컬 계산이라 지연 요인은 폰트·JS 하이드레이션 쪽. |
| 초기 JS 번들(홈 라우트) | `추정` gzip 170KB 이하 | 실측 필요(빌드 후 `next build` 산출 확인). Kakao SDK·html-to-image는 §8에서 지연 로드로 이 예산에서 제외. |
| 폰트 | Pretendard **self-host**(npm 패키지, `next/font/local`) subset, `font-display: swap`. 숫자 표기(모노)는 시스템 모노 스택(`ui-monospace` 계열, 확정 결정 §6)이라 **다운로드·preload 대상 자체가 없음**. Pretendard 중 초기 렌더에 쓰이는 굵기/서브셋만 preload. | 외부 웹폰트 요청 0(확정 결정). |
| 앨범아트 | `loading="lazy"`, 고정 `aspect-ratio` 박스로 CLS 방지, 로드 실패 시 플레이스홀더(마이크/음표 아이콘, §DESIGN_SYSTEM 아이콘 규칙) | iTunes CDN 이미지는 크로스오리진 — 실패를 항상 가정한다. |
| 리스트 렌더(최대 100곡) | **가상화 없음(MVP)** | 근거: (1) `shared_lists` payload 상한이 100곡(API_CONTRACT §1-3 CHECK)이라 DOM 상한이 정해져 있다. (2) 100개 `SongRow`는 텍스트 위주 카드라 리렌더 비용이 낮다(이미지도 lazy). (3) 가상화는 드래그 정렬(§BUILD_PLAN §11-2 순서변경)과 상호작용이 까다로워 MVP 범위에서 복잡도 대비 이득이 낮다. 리스트 상한이 커지면(후속) 재검토. |

---

## 7. PWA 캐싱 전략

### 7-1. 캐시 계층

| 대상 | 전략 | 상세 |
|---|---|---|
| 앱쉘(HTML/JS/CSS 정적 산출물) | **precache**(설치 시 미리 캐시) | 오프라인에서도 라우트 진입 자체는 가능해야 한다(§7-4). |
| 앨범아트(iTunes CDN 이미지) | **stale-while-revalidate**, 상한 개수 `추정` 200장 | 캐시가 무한정 커지지 않게 개수 상한을 둔다(정확한 상한은 실측/기획 확인 필요). 크로스오리진 opaque 응답이라 캐시 내부에서 크기 검사가 불가능함에 유의 — 상한은 "요청 개수"로 강제. |
| `search_songs` RPC / 공유 생성 요청 | **network-only** | 검색·공유는 항상 최신이어야 하는 살아있는 데이터라 캐시하면 오히려 오동작(오래된 곡 목록, 중복 공유 등). |
| `/s/[slug]` 뷰 | **network-only**(SSR) — 서비스워커 캐시 대상 아님 | 공유 스냅샷은 불변이지만 "곡이 삭제(takedown)됐을 수도 있다"는 최신성이 더 중요.(`확인 필요`: SEO/OG 요청까지 캐시할지는 후속 결정) |

### 7-2. 오프라인 폴백

- 앱쉘이 precache되어 있으므로 오프라인에서도 `/`, `/list/[id]` 등은 열리고 **로컬 Dexie 데이터는 그대로 보인다**(§1 데이터 흐름의 핵심 이점).
- `/search`, `/ticket/[id]`의 공유 생성 버튼처럼 서버가 반드시 필요한 동작만 "오프라인 배너 + 재시도"(§5-1 인라인 규칙)로 막는다. 화면 자체를 오프라인 전용 폴백 페이지로 통째로 바꾸지 않는다 — BUILD_PLAN §11-6 완료조건("오프라인에서 내 리스트 열람 가능")과 일치.

### 7-3. 서비스워커 업데이트 정책

- 새 서비스워커가 설치 대기(`waiting`) 상태가 되면 **자동으로 활성화(skipWaiting)하지 않는다.** Zustand draft(계산 중인 값 등)가 페이지 리로드로 날아가는 것을 피하기 위해서다(§2 상태 소유권 표의 "Zustand는 휘발" 원칙과 상충하지 않도록 사용자 스스로 타이밍을 고르게 한다).
- 대신 Toast(`components/ui/Toast.tsx`)로 "새 버전이 있어, 지금 새로고침할까?" 계열 문구를 띄우고, 사용자가 눌렀을 때만 `skipWaiting` + `location.reload()`.

### 7-4. 구현 라이브러리 — `확인 필요`

BUILD_PLAN §11-1은 "서비스워커로 앱쉘 캐시"라고만 명시하고 구체 라이브러리(예: `next-pwa`, Workbox 수동 구성, Next 15 네이티브 SW 지원)를 지정하지 않았다. 이 문서도 특정 라이브러리를 정본으로 못박지 않는다 — 구현 시점에 고르고 `DECISIONS_LOG.md`에 근거를 남긴다. 단, 위 §7-1~§7-3의 **캐시 전략·정책은 라이브러리와 무관하게 정본**이다.

---

## 8. 무거운 의존성의 지연 로드 규칙

| 의존성 | 규칙 | 이유 |
|---|---|---|
| **Kakao JS SDK** | 초기 번들에 포함 금지. `/ticket/[id]`에서 사용자가 "카톡 공유" 버튼을 처음 누르는 시점에 `<script>` 동적 삽입(또는 동적 import 래퍼)으로 로드. | 카톡 공유를 안 쓰는 사용자(대다수 세션)에게 외부 SDK 무게를 지우지 않는다. §6 초기 JS 예산에서 제외되는 전제. |
| **html-to-image** | 정적 import 금지, PNG export 핸들러 내부에서 `await import('html-to-image')`로 동적 로드. | 티켓 PNG 저장은 `/ticket/[id]`에서도 일부 사용자만 누르는 액션. |
| **next/og(`ImageResponse`)** | 이건 라우트 핸들러(`opengraph-image.tsx`)라 자연히 서버에서만 실행 — 클라 번들에 안 들어감. 별도 지연 로드 조치 불필요, 표에는 "해당 없음"으로 명시해 혼동 방지. | — |

---

## 고찰

| 결정 | 근거 | 기각한 대안 |
|---|---|---|
| Dexie=영속, Zustand=휘발, TanStack Query=서버 캐시, URL=위치 — 4계층 고정 | 각 계층이 정확히 하나의 책임을 가지면 "이 값이 왜 안 바뀌지"류 버그의 원인 후보가 좁아진다. local-first 앱에서 가장 흔한 버그는 두 상태 저장소가 몰래 어긋나는 것. | 전부 Zustand(persist 미들웨어로 Dexie 흉내) — Dexie의 쿼리·인덱스·liveQuery 이점을 버리게 됨. 전부 Dexie(계산 draft도 저장) — 매 키입력마다 IndexedDB 쓰기는 낭비이고 "취소" UX가 어려워짐. |
| 계산 파라미터 자동 영속(명시 "기억하기" 없음) | 코인노래방 요금·인원은 사용자별로 거의 고정 — 매 방문 재입력은 저마찰 철학과 어긋남. "실수 값 고착" 리스크는 (a) 검증 통과값만 저장 (b) 슬라이더는 저장 제외로 원천 차단되어, 별도 버튼(UI 추가·발견 비용)보다 낫다. | 명시 "기억하기" 버튼 — UI 요소 추가·발견 실패 시 사실상 휘발과 동일. 전부 휘발(Zustand만) — 매번 재입력. |
| 리스트 렌더 가상화 안 함(MVP) | 상한 100곡이 CHECK 제약으로 이미 걸려 있어(API_CONTRACT §1-3) "얼마나 커질지 모른다"는 가상화의 전제 자체가 약하다. | react-window 등 도입 — 드래그 정렬과의 상호작용 비용이 편익보다 큼(추정). |
| SW 업데이트는 수동 트리거(Toast) | 계산 draft 유실 방지가 자동 새로고침의 편의보다 우선(§2 원칙과 일관). | `skipWaiting()` 즉시 적용 — 사용자가 계산 중간에 리로드당할 위험. |
| PWA 캐시 라이브러리는 미확정으로 남김 | BUILD_PLAN이 명시하지 않은 결정을 이 문서가 대신 못박으면 "정본을 이 문서가 만들어낸" 상황이 되어 README §3 원칙(정본 소유권)과 어긋난다. 대신 라이브러리 **무관하게 지켜야 할 캐시 전략**만 못박았다. | next-pwa로 단정 — 실제 Next 15 App Router 호환성 재확인 없이 단정하면 "확인 필요" 사실을 사실처럼 서술하게 됨. |

## 검증 체크리스트

- [ ] `lib/*.ts` 어디에도 `"use client"`·JSX·React 훅 import가 없는지 grep으로 확인 (`grep -rn "use client\|from 'react'" lib/`)
- [ ] `lib/`이 `components/`나 `app/`을 import하는 곳이 0건인지 확인
- [ ] 계산 파라미터(모드/인원/요금)의 유효 확정값이 새로고침 후 복원되고, 편집 중(blur 전) 값·역계산 슬라이더 값은 복원 대상이 아닌지(§2-1 자동 영속 규칙) 수동 확인
- [ ] Dexie `db.version(1)` 다음에 `db.version(2)`가 생기는 시점, 두 버전 모두 `upgrade` 콜백이 있는지, 새 필드가 전부 optional인지 코드 리뷰로 확인
- [ ] 검색 실패(네트워크 끊기)·공유 생성 실패 시 입력했던 검색어/티켓 제목 등이 화면에서 사라지지 않는지 수동 확인(§5-3)
- [ ] `next build` 후 홈 라우트 초기 JS 크기가 예산(§6, `추정` 170KB)에 근접한지 확인, 벗어나면 원인(주로 지연 로드 누락) 조사
- [ ] 네트워크 탭에서 `/ticket/[id]` 최초 진입 시 Kakao SDK·html-to-image 요청이 없고, 각 버튼 클릭 시에만 로드되는지 확인(§8)
- [ ] 오프라인 토글 후 `/`, `/list/[id]` 진입 가능하고 로컬 리스트가 보이는지, `/search`는 오프라인 배너로 우아하게 막히는지 확인

## 미결

- PWA 서비스워커 구현 라이브러리(§7-4) — `확인 필요`, DECISIONS_LOG에서 확정.
- 초기 JS 번들 예산 수치(§6)는 `추정`이며 실제 `next build` 산출로 재보정 필요.
- 앨범아트 캐시 상한 개수(§7-1)는 `추정` — 실사용 패턴(리스트 개수·곡 다양성) 관찰 후 조정.
- LCP 목표 2.5s(§6)는 `추정`이며 실기기(중저가 안드로이드 기준 추정) 실측 필요.
- ~~프리셋 저장 "명시 액션" UI~~ → **해소(v1.0 리뷰)**: 자동 영속으로 확정(§2-1) — 별도 UI 불필요.
- ESLint `no-restricted-imports`로 모듈 의존 규칙(§3-1)을 실제로 강제할지, 코드 리뷰로만 지킬지는 `기획/구현 확인 필요`.
