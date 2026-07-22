# VISUAL_MOTION_DIRECTION.md — Session Strip 비주얼·모션 방향

> **상태**: v3.2 시각·모션 정본 v1.2 · 2026-07-21  
> **정본 범위**: 제품의 대표 비주얼 콘셉트, 브랜드 형태 문법, semantic color/layout/motion tokens, 핵심 화면의 반응형 조합, ActionDock, 티켓 PNG·OG 산출물 규격, 에셋 제작 원칙, 시각·실기기 승인 게이트.  
> **접근성 목표**: WCAG 2.2 AA.  
> **현재 적용 규칙**: `docs/README.md` v3에서 정식 채택되었다. 제품 범위·라우트·계산 방식은 `FINAL_BLUEPRINT.md`가 우선하고, 이 문서는 그 계약의 시각·모션 정본이다. 기존 DESIGN_SYSTEM.md·COMPONENTS.md·SCREENS.md와 충돌하면 이 문서와 FINAL_BLUEPRINT를 따른다.

---

## 0. 이 문서가 해결하는 문제

현재 문서군은 토큰 값과 컴포넌트 상태를 자세히 설명하지만, 제품 전체를 하나로 묶는 긍정적 시각 문법이 부족하다. 그대로 구현하면 다음과 같은 결과가 나올 위험이 크다.

- 로즈색 CTA, 흰 카드, pill control, 그림자로 구성된 일반적인 모바일 CRUD 앱
- 검색·리스트·계산은 범용 UI이고 마지막 티켓 화면만 별도 테마인 불연속 경험
- “그라디언트 금지” 같은 부정 규칙은 많지만, 무엇을 반복해야 싱송처럼 보이는지 불명확
- 음악앱을 뜻하기 위해 마이크·음표·헤드폰을 반복하는 클리셰
- 모든 빈 상태에 일러스트를 넣고 모든 조작에 scale/pop을 넣는 AI UI 디폴트

이 문서는 제품의 핵심 흐름인 **담기 → 계산 → 발권 → 공유**를 하나의 물성으로 연결하고, 화면·이미지·모션의 승인 기준을 구현 전에 고정한다.

---

## 1. 대표 콘셉트 — Session Strip

### 1-1. 한 문장

> 사용자가 곡을 담는 동안 화면은 “작성 중인 세션 티켓 원지”이고, 계산이 끝나는 순간 한 장의 공유 가능한 티켓으로 발권된다.

### 1-2. 시각 서사

1. 검색에서 곡을 담으면 단일 활성 플랜의 numbered ledger 행이 채워진다.
2. 홈의 곡 큐와 계산기는 서로 다른 카드가 아니라 하나의 연속된 Session Strip 안에 있다.
3. 계산 영역은 스트립 하단의 정산 인쇄 구역이다.
4. “티켓 만들기”는 새 디자인으로 이동하는 버튼이 아니라, 작성 중인 원지를 최종 artifact로 확정하는 행위다.
5. 최종 TicketCard, PNG, OG, 공유 뷰는 같은 정보 위계와 형태 문법을 재사용한다.

### 1-3. 제품 내 역할 구분

| 역할 | 시각적 표현 | 사용 위치 |
|---|---|---|
| Working Strip | 평평한 종이 면, ledger rule, 번호, 얇은 절취선 | 홈의 활성 플랜 편집 |
| Search Ledger | 카드 없는 연속 행, 선택 상태를 check와 텍스트로 표시 | 검색 |
| Issued Ticket | 타공·절취선·시리얼·정산 요약이 있는 hero artifact | 티켓·공유 |
| System Chrome | canvas 위의 조용한 내비·ActionDock | 전 화면 |

### 1-4. 비목표

- 노래방 실내의 네온·레이저·미러볼을 재현하지 않는다.
- 실제 종이 텍스처, 찢어진 사진, 3D 동전 같은 사실적 스큐어모피즘을 쓰지 않는다.
- 마이크·음표·헤드폰·재생 삼각형을 브랜드 로고로 쓰지 않는다.
- 티켓 타공과 절취선을 모든 작은 카드·칩에 복제하지 않는다.
- “음악 앱”처럼 보이는 것보다 “계획이 약속으로 발권되는 앱”처럼 보이는 것을 우선한다.

---

## 2. 브랜드 형태 문법

### 2-1. 기본 도형

- **Strip**: 세로로 긴 종이 면. 콘텐츠 흐름과 동일한 방향을 갖는다.
- **Rule**: 곡 행을 나누는 1px 선. 리스트마다 독립 카드 배경을 만들지 않는다.
- **Perforation**: 주요 상태 경계에만 쓰는 1.5px dashed line. 권장 dash/gap은 6px/6px.
- **Punch**: 최종 티켓 절취선 좌우의 지름 16px 반원 타공. Working Strip에는 사용하지 않는다.
- **Registration mark**: 로즈색의 작은 사각/원 표시. 선택·발권 위치를 암시하며 장식 개수는 artifact당 1~2개로 제한한다.
- **Queue index**: 01, 02처럼 2자리 tabular number. 장식이 아니라 곡 순서 정보다.

### 2-2. 모서리와 면

- 일반 입력·버튼 radius는 8~12px.
- hero TicketCard만 20px radius를 허용한다.
- full pill은 Chip, segmented track, 원형 icon hit-area에만 사용한다.
- primary Button을 pill로 만들지 않는다.
- 화면당 강한 raised surface는 최대 1개다. 홈에서는 Session Strip, 티켓 화면에서는 TicketCard가 그 역할을 가진다.
- 정보 구분은 먼저 spacing과 rule로 해결하고, 그다음 surface, 마지막으로 shadow를 쓴다.

### 2-3. 정렬

- 기본은 좌측 정렬이다.
- 수치 영역은 우측 정렬 또는 decimal/tabular 정렬을 허용한다.
- 중앙 정렬은 첫 방문 empty hero와 404의 짧은 안내에만 제한한다.
- 티켓 제목과 숫자는 동일한 중앙축에 억지로 맞추지 않는다. 제목은 좌측, 금액·시리얼은 정보 역할에 맞춰 정렬한다.

### 2-4. 브랜드 마크

브랜드 심볼은 다음 세 요소의 결합으로 탐색한다.

1. S자로 한 번 접힌 ticket strip
2. 양옆의 두 circular punch
3. 세 개의 queue/ledger bar

요구사항:

- 24px 단색에서도 식별 가능
- 잉크 단색만으로 의미 유지
- 마이크·음표·헤드폰·play icon 금지
- 작은 크기에서 내부 음각이나 얇은 선이 뭉개지지 않음
- PWA maskable icon의 중앙 66% safe zone 안에 핵심 실루엣이 들어감

### 2-5. AI UI slop 금지 기준

- 한 화면에서 독립 rounded card 3개 이상 금지
- 보라→파랑, 로즈→오렌지 gradient 금지
- glassmorphism, backdrop blur, glow 금지
- 모든 버튼/칩/탭을 pill로 통일하는 것 금지
- hero 문구·그림·CTA를 모든 화면에서 중앙정렬하는 것 금지
- 장식용 sparkle·confetti·floating orb 금지
- EmptyState마다 서로 다른 생성 일러스트를 붙이는 것 금지
- press feedback를 모든 요소의 spring scale로 해결하는 것 금지

---

## 3. Semantic color tokens 후보

기존 primitive token은 유지하되 구현 컴포넌트는 아래 semantic alias를 우선 사용한다. 색상값은 이 문서가 정식 채택될 때 DESIGN_SYSTEM.md로 이관한다.

### 3-1. 라이트

| Semantic token | 값 | 역할 |
|---|---:|---|
| --color-canvas | #FDF6F9 | 앱 배경 |
| --color-paper | #FFFFFF | Session Strip·TicketCard·입력 표면 |
| --color-surface-muted | #FBEFF3 | 장식적 구역 워시 |
| --color-ink | #1C1622 | 본문·제목·focus ring |
| --color-ink-muted | #6B5D6E | 보조 텍스트 |
| --color-accent-fill | #FF2E74 | primary fill·선택 그래픽 |
| --color-accent-text | #D3155B | 작은 링크·ghost text |
| --color-on-accent | #1C1622 | accent fill 위 텍스트·아이콘 |
| --color-money-text | #995F00 | 금액 텍스트 |
| --color-money-decoration | #F5A623 | 동전 점·얇은 장식 |
| --color-border-subtle | #F0DCE4 | 장식 rule |
| --color-border-control | #9B7F8A | 입력·버튼·slider 등 필요한 경계 |
| --color-danger | #C43A3A | 파괴·오류 텍스트와 경계 |
| --color-focus-ring | #1C1622 | 이중 focus ring 바깥색 |
| --color-toast-bg | #1C1622 | 시스템 toast 배경 |
| --color-toast-ink | #F5EEF3 | 시스템 toast 텍스트 |

### 3-2. 다크

| Semantic token | 값 | 역할 |
|---|---:|---|
| --color-canvas | #16111C | 앱 배경 |
| --color-paper | #221B29 | Session Strip·TicketCard·입력 표면 |
| --color-surface-muted | #2A2130 | 장식적 구역 워시 |
| --color-ink | #F5EEF3 | 본문·제목·focus ring |
| --color-ink-muted | #B8A9BC | 보조 텍스트 |
| --color-accent-fill | #FF6B9B | primary fill·선택 그래픽 |
| --color-accent-text | #FF6B9B | 링크·ghost text |
| --color-on-accent | #1C1622 | accent fill 위 텍스트·아이콘 |
| --color-money-text | #F5A623 | 금액 텍스트 |
| --color-money-decoration | #F5A623 | 동전 점·얇은 장식 |
| --color-border-subtle | #372C3F | 장식 rule |
| --color-border-control | #77697C | 필요한 컨트롤 경계 |
| --color-danger | #FF8177 | 파괴·오류 텍스트와 경계 |
| --color-focus-ring | #F5EEF3 | 이중 focus ring 바깥색 |
| --color-toast-bg | #F5EEF3 | 시스템 toast 배경 |
| --color-toast-ink | #1C1622 | 시스템 toast 텍스트 |

### 3-3. 검증된 핵심 대비

| 조합 | 대비율 | 사용 |
|---|---:|---|
| light ink / canvas | 16.62:1 | 본문 |
| light ink-muted / canvas | 5.77:1 | 보조 텍스트 |
| light accent-text / canvas | 4.90:1 | 16px 링크·ghost |
| light on-accent / accent-fill | 4.97:1 | primary Button |
| light money-text / canvas | 4.94:1 | 금액 |
| light border-control / canvas | 3.40:1 | 컨트롤 경계 |
| light border-control / paper | 3.62:1 | 입력 경계 |
| dark ink / canvas | 16.27:1 | 본문 |
| dark ink-muted / canvas | 8.35:1 | 보조 텍스트 |
| dark accent-text / canvas | 6.92:1 | 링크·ghost |
| dark on-accent / accent-fill | 6.59:1 | primary Button |
| dark money-text / canvas | 9.16:1 | 금액 |
| dark border-control / paper | 3.26:1 | 입력 경계 |
| dark danger / canvas | 7.66:1 | 오류·파괴 |

### 3-4. 색 사용 규칙

- --color-border-subtle은 장식 rule에만 쓴다. 입력·버튼·slider track의 유일한 경계가 될 수 없다.
- --color-accent-fill을 16px 일반 텍스트에 쓰지 않는다.
- 작은 accent text는 --color-accent-text를 사용한다.
- 금액 텍스트는 모드와 무관하게 --color-money-text만 사용한다.
- --color-money-decoration은 텍스트가 아니다.
- 오류·삭제를 로즈로 표현하지 않고 --color-danger를 쓴다.
- 성공/담김은 색 하나에 의존하지 않는다. check icon과 상태 텍스트를 함께 쓴다. `aria-pressed`는 실제 toggle button에만 쓰며 검색의 비상호작용 `담김` 상태에는 쓰지 않는다.
- focus ring은 요소 색과 겹치지 않도록 2px canvas/paper gap + 2px --color-focus-ring의 이중 링으로 만든다.

### 3-5. Forced Colors

- forced-colors에서는 custom background보다 시스템 Canvas, CanvasText, ButtonText, Highlight를 우선한다.
- focus-visible은 outline을 제거하지 않는다.
- 타공·바코드·registration mark가 사라져도 정보 의미가 유지되어야 한다.
- selected/added 상태는 아이콘과 텍스트를 반드시 동반한다.

---

## 4. Type, spacing, radius, elevation

### 4-1. Type

크기는 px 하드코딩 대신 rem으로 정의한다. 브라우저 확대와 사용자 기본 글꼴 크기를 존중한다.

| Token | 값 | line-height | 용도 |
|---|---:|---:|---|
| --type-caption | 0.75rem | 1rem | 시리얼·메타 |
| --type-body-sm | 0.875rem | 1.25rem | artist·chip |
| --type-body | 1rem | 1.5rem | 본문·입력·버튼 |
| --type-title | 1.25rem | 1.75rem | 화면·섹션 제목 |
| --type-display | 1.75rem | 2.125rem | 티켓 제목·요약 |
| --type-amount | clamp(2rem, 9vw, 2.5rem) | 1.1 | 계산 hero amount |

Weight:

- 400: 본문
- 600: label·선택·Button
- 700: amount·hero title의 제한적 강조

Monospace:

- 순번, TJ/KY 번호, 시리얼, 금액 숫자에만 사용한다.
- 한글 라벨 전체를 monospace로 만들지 않는다.
- font-variant-numeric: tabular-nums를 적용한다.
- letter-spacing은 시리얼에만 사용하고 본문·금액에는 과도하게 벌리지 않는다.

### 4-2. Spacing

이 시스템은 8pt가 아니라 4pt base grid로 명명한다.

4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64px

- 화면 gutter는 16~24px.
- ledger row 최소 높이는 64px, compact row는 56px.
- interactive target은 시각 크기와 무관하게 최소 44×44px.
- 연속 곡 행은 margin card가 아니라 내부 padding + rule로 리듬을 만든다.

### 4-3. Radius

| Token | 값 | 사용 |
|---|---:|---|
| --radius-control | 8px | input·small surface |
| --radius-action | 12px | Button·ActionDock 내부 |
| --radius-strip | 12px | Working Strip |
| --radius-ticket | 20px | Issued Ticket |
| --radius-full | 9999px | Chip·원형 icon button |

### 4-4. Elevation

- --shadow-strip: Working Strip 한 곳에만 쓰는 낮은 elevation
- --shadow-ticket: Issued Ticket hero에만 쓰는 높은 elevation
- 다크모드는 shadow보다 --color-border-subtle 1px 경계를 우선한다.
- hover에서 box-shadow를 보간하지 않는다. 필요하면 opacity가 낮은 overlay를 전환한다.
- exportTarget과 OG에는 화면용 shadow를 그대로 복제하지 않고 출력 canvas에 맞춘 고정 shadow를 사용한다.

---

## 5. 반응형 레이아웃

### 5-1. Breakpoints

| 범위 | 이름 | 원칙 |
|---|---|---|
| 0~359px | compact phone | 16px gutter, amount 32px 하한, mode label 2행 허용 |
| 360~599px | phone | 단일 컬럼, bottom navigation·ActionDock |
| 600~899px | large phone/tablet | 단일 컬럼, content max 560px, gutter 24px |
| 900px 이상 | wide | content max 1000px, 핵심 화면별 2열 허용 |

### 5-2. 공통 폭

- --layout-narrow: 560px
- --layout-search: 720px
- --layout-wide: 1000px
- --layout-gutter: clamp(16px, 4vw, 24px)

448px 고정 폰 프레임을 전 화면에 강제하지 않는다. 설치형 모바일 화면은 단일 컬럼을 유지하되, 공개 공유 페이지와 티켓 미리보기는 wide viewport를 활용한다.

### 5-3. Navigation

- 900px 미만: `/`와 `/search`에서만 하단 PrimaryNav 2항목(플랜·검색).
- 900px 이상: 같은 nav DOM을 header 영역에 배치한다. 모바일/데스크톱 nav를 중복 렌더하지 않는다.
- route 이동 후 main heading 또는 main landmark로 포커스를 옮기고 변경된 화면 제목을 한 번만 알린다.
- `/ticket`, `/s/[slug]`, `/import`, `/offline`, not-found에는 PrimaryNav가 없다.

### 5-4. Reflow·zoom

- 400% zoom에서 좌우 스크롤 없이 핵심 기능을 쓸 수 있어야 한다.
- 320px 폭에서 2-option `CalculationModeGroup`(radiogroup) 라벨은 줄바꿈 가능해야 하며 ellipsis로 의미를 숨기지 않는다.
- 100곡, 30명, 1,000,000원, 2행 한글 제목을 기준으로 overflow를 검증한다.
- grid visual order와 DOM order를 동일하게 유지한다.
- line clamp로 숨긴 제목에는 전체 값을 얻을 수 있는 접근 가능한 상세 진입점이 있어야 한다.

### 5-5. Safe area·soft keyboard

- bottom stack이 있는 화면은 content에 dock+nav+safe-area만큼 실제 bottom padding을 둔다.
- safe-area padding은 nav와 dock 양쪽에 중복 적용하지 않는다. 최하단 컨테이너 한 곳이 소유한다.
- visualViewport 높이가 초기 높이의 약 75% 미만이거나 input이 focus된 상태에서는 fixed ActionDock을 in-flow/sticky 해제 상태로 전환한다.
- 키보드가 올라온 동안 CTA가 input·error message를 덮지 않는다.
- 100dvh를 쓰되 100vh만을 단독 fallback으로 신뢰하지 않는다.

---

## 6. 핵심 화면 composition

## 6-1. 홈 — Working Session Strip

### 모바일

1. **AppHeader**
   - 좌측 wordmark
   - 우측 overflow 안에 `새 플랜 시작`, 저장소 상태 도움말, `내 공유 관리`
   - P0에는 플랜 선택기·멀티리스트 UI가 없다
2. **Working Strip — Queue**
   - 제목과 곡수
   - numbered SongRow ledger
   - 곡 추가 secondary action
3. **Perforation divider**
4. **Working Strip — Calculator**
   - mode radiogroup
   - mode-specific form
   - 결과 summary
   - reverse calculator disclosure
5. **ActionDock**
   - valid items+요금+인원: “N곡 티켓 만들기”
   - invalid/missing: “요금과 인원 입력하기”; calculator를 열고 첫 invalid field로 focus
6. **PrimaryNav**

### 계산 폼의 시각 계약

| 방식 | 기본 필드 | optional disclosure |
|---|---|---|
| song | 곡당 가격 | 묶음 가격 X원 / Y곡 |
| time | 시간 block 길이 / block 가격, 코인부스·룸 context label | 로컬 최근 입력 선택 |

- mode 전환 시 label과 field가 먼저 바뀌고 결과가 즉시 갱신된다.
- mode별 영역 높이를 억지로 고정하지 않는다. layout jump가 커지지 않도록 field group 단위로 교체한다.
- 결과는 “약 A~B분”, “총 C~D원”, “1인당 약 E~F원”을 명확한 label-value 쌍으로 표시한다.
- 금액 하나만 크게 보여 무엇의 금액인지 추측하게 만들지 않는다.
- 추정 근거 안내를 결과 가까이에 둔다.
- slider drag·PriceInput typing 중에는 숫자 motion을 실행하지 않는다.

### Wide

- 2열: 왼쪽 queue, 오른쪽 sticky calculator/ActionDock.
- DOM 순서는 queue → calculator → action이며 CSS grid로만 배치한다.
- 오른쪽 calculator는 viewport top에서 header 아래에 sticky되지만 viewport보다 높으면 sticky를 해제한다.

## 6-2. 검색 — Search Ledger

### 모바일

1. AppHeader/back
2. sticky SearchInput
3. debounced live status: 검색 중, 결과 N곡, 오류
4. 연속 Search Ledger rows
5. 현재 곡 수·시간 범위·예상 비용과 `플랜 보기`를 가진 Plan Rail
6. PrimaryNav

Row:

- P0 검색 결과에도 앨범아트를 사용하지 않는다. 제목·가수·TJ/KY 번호·담김 상태의 정보 위계를 강화한다.
- 미디어 placeholder나 마이크 그림을 반복하지 않는다. 필요하면 잉크색 queue index를 쓴다.
- 제목 영역과 trailing add/remove Button은 형제 요소다.
- added 상태는 비상호작용 check icon + “담김”으로 표현한다. 결과 행에서 toggle/remove처럼 보이게 `aria-pressed`를 주지 않으며 삭제는 활성 플랜 화면에서만 한다.
- 결과 갱신은 input focus와 scroll 위치를 빼앗지 않는다.

상태:

- 입력 전: 짧은 검색 범위 안내. 장식 illustration 없음.
- loading: 150ms 이상 지연될 때만 Skeleton을 표시해 local/fast response flicker를 막는다.
- empty: 다른 표기·번호·초성 재시도 힌트를 우선하고 illustration을 강제하지 않는다.
- offline: 검색 불가 사유와 “홈에서 계산 계속하기” action을 함께 제공한다.
- retry: 이전 성공 결과가 있다면 지우지 않고 stale 상태로 유지한다.

### Wide

- content max 720px 단일 컬럼.
- 검색은 scan task이므로 불필요한 2열 결과를 만들지 않는다.

## 6-3. 활성 플랜 순서 편집 — Editable Ledger

- whole-row interactive 금지.
- 제목/detail trigger와 destructive action을 분리한다.
- P0 정식 경로는 각 행의 `위로`/`아래로` 버튼이다. 터치 drag를 넣더라도 이 경로를 제거하지 않는다.
- P1에서 drag를 추가하면 Space: 집기/놓기, Arrow: 이동, Escape: 취소를 제공한다.
- “2번에서 1번으로 이동” 같은 결과를 polite live region에 알린다.
- row 삭제 후 다음 행의 대응 action으로 포커스를 이동한다.
- P0에는 키·태그·메모 편집이 없다.

## 6-4. 티켓 — Issue & Share

### 모바일

1. back header
2. Ticket stage
3. Issued TicketCard
4. 공개 범위 고지
5. share ActionDock

공유 action hierarchy:

- preflight: 링크 소유자 공개성·포함 필드·30일 만료·철회를 먼저 확인
- primary: frozen server snapshot URL의 OS 공유(Web Share; 공유 시트에서 Kakao 선택 가능)
- secondary: 같은 frozen URL 링크 복사
- tertiary: private ticket 이미지 로컬 저장 — 서버 공유/전송 성공과 별개

서버 snapshot이 준비되기 전에는 OS 공유 action을 활성화하지 않는다. 준비 뒤 별도 `공유 시트 열기` 탭에서 선행 `await` 없이 `navigator.share({title,text,url})`를 즉시 호출해 user activation을 보존한다. Promise resolve는 공유 시트 완료일 뿐 실제 전송 성공으로 표기하지 않는다. `AbortError`는 조용한 취소다.

네트워크 불가:

- 이미지 저장은 유지
- 링크/OS 공유는 aria-disabled + reason text
- disabled button만 남겨 키보드 사용자가 이유를 못 찾게 하지 않는다

### Wide

- 2열: 왼쪽 sticky TicketCard preview, 오른쪽 고지와 share actions.
- TicketCard의 최대 표시폭은 420px.
- 오른쪽 action 영역은 360~440px 범위.

## 6-5. 공유 뷰 — Received Ticket

### 모바일

1. compact brand header
2. TicketCard article
3. 곡 목록 ledger
4. 공개 상태·로컬 저장 설명
5. context-aware import/handoff ActionDock
6. 신고·삭제 요청 footer

### Wide

- 2열: 왼쪽 sticky TicketCard, 오른쪽 song ledger + import/handoff.
- TicketCard와 곡 목록의 첫 heading baseline을 맞춘다.
- 전달받은 사용자가 처음 접하는 페이지이므로 448px 폰 프레임을 데스크톱 중앙에 그대로 두지 않는다.

### Semantic structure

- TicketCard는 role=img가 아니라 article이다.
- title은 heading, 곡수·시간·금액은 description list.
- barcode, punch, decorative serial bars는 aria-hidden.
- QR이 있으면 같은 URL의 text link도 제공한다.

---

## 7. ActionDock

ActionDock은 “모든 CTA를 fixed로 만든다”는 뜻이 아니다. 현재 task의 다음 결정 하나만 엄지 도달권에 유지하는 반응형 pattern이다.

### 7-1. Variants

| Variant | 화면 | 구성 |
|---|---|---|
| single | 홈 | full-width primary 1개 |
| import-empty | 공유·빈 활성 플랜 | 설명 + `내 플랜으로 가져오기` |
| import-replace | 공유·비어 있지 않은 활성 플랜 | 설명 + `현재 플랜 바꾸기`; 확인 dialog에서 취소 가능 |
| handoff | 인앱 공유 | `외부 브라우저에서 저장` + 확실한 `링크 복사`; 저장 완료를 미리 약속하지 않음 |
| share | 티켓 | primary 1개 + secondary 1개 + tertiary text action |

### 7-2. 배치

- mobile: PrimaryNav가 있으면 그 위, 없으면 viewport bottom.
- wide: related panel 안의 in-flow 또는 sticky block. 화면 하단 전체폭 dock 금지.
- 콘텐츠 DOM 뒤, PrimaryNav 앞에 위치한다.
- open BottomSheet·ConfirmDialog가 있으면 ActionDock은 inert/aria-hidden 처리하고 시각적으로 가린다.

### 7-3. 크기

- 최소 Button 높이 52px.
- dock horizontal padding은 화면 gutter와 동일.
- top padding 12px, bottom padding은 최하단 owner일 때만 safe area 포함.
- 1px top rule 또는 paper surface로 본문과 구분. blur/glass 금지.

### 7-4. 상태

- loading 중 label이 완전히 사라지지 않도록 spinner + 기존 action의 현재형 label을 유지한다.
- offline/invalid 상태는 CTA를 숨기지 않고 사유를 연결한다.
- action success 후 route가 바뀌면 Toast와 route announcement를 동시에 중복 발화하지 않는다.
- soft keyboard 상태에서는 fixed를 해제한다.

### 7-5. BottomSlot 단일 소유권

- 하단 고정 영역은 app shell의 `BottomSlot` 한 곳만 소유한다. child route/component가 별도 `position: fixed` bottom UI를 만들지 않는다.
- home: ActionDock + 2-tab PrimaryNav.
- search: PlanRail + 2-tab PrimaryNav.
- ticket/share: 해당 share/import dock만 있고 PrimaryNav는 없다.
- 전체 높이는 일반 viewport에서 25dvh 이하를 목표로 하고, 콘텐츠가 절대 가리지 않도록 실제 측정 높이만큼 padding을 둔다.
- soft keyboard가 열리거나 dock이 25dvh를 넘으면 in-flow로 전환한다. safe-area padding은 가장 아래 owner 한 곳만 적용한다.

---

## 8. Motion grammar

### 8-1. 원칙

- 싱송의 모션은 “기계적으로 반응하고, 종이처럼 정착한다.”
- direct manipulation은 손가락을 즉시 따라가며 duration/easing을 적용하지 않는다.
- 의미가 없는 bounce·shake·floating loop는 없다.
- 한 진입에서 signature motion은 하나만 주인공이 된다.
- 정보 값은 애니메이션보다 먼저 정확해야 한다.

### 8-2. Duration·easing

| Token | 값 | 사용 |
|---|---:|---|
| --motion-instant | 0ms | direct state, reduced |
| --motion-press-in | 80ms | press down |
| --motion-fast | 120ms | hover·focus·icon fade |
| --motion-state | 160ms | selected·expanded |
| --motion-route | 180ms | page transition |
| --motion-sheet-in | 260ms | BottomSheet open |
| --motion-sheet-out | 180ms | BottomSheet close |
| --motion-ticket | 360ms | ticket issue |
| --ease-standard | cubic-bezier(0.22, 1, 0.36, 1) | enter·settle |
| --ease-in | cubic-bezier(0.64, 0, 0.78, 0) | exit |

Motion (`motion/react`) spring:

- add: stiffness 520 / damping 38 / mass 0.7
- ticket: stiffness 280 / damping 30 / mass 0.9
- spring 대상은 작은 icon wrapper 또는 TicketCard wrapper 하나다.

### 8-3. 상태별 문법

| 상태 | 일반 동작 | reduced-motion |
|---|---|---|
| hover/focus | color/opacity 120ms | 즉시 |
| press | scale 0.985, 80ms | scale 없이 색만 |
| select | indicator 160ms | 즉시 교체 |
| expand | opacity + translateY 4px, 160ms | 즉시 또는 opacity 120ms |
| Sheet open | translateY 100%→0, backdrop fade | slide 제거, fade 120ms |
| Sheet close | translateY 0→100%, 180ms | 즉시 |
| Toast | translateY 8px + fade 180ms | fade 120ms |
| Skeleton | 1.2s opacity pulse loop | 정적 surface |
| Error | border/icon/message | 동일, shake 없음 |

### 8-4. Signature motion 4개

#### A. 곡 담기

- 눌린 add icon만 0.92까지 press.
- plus는 check로 120ms crossfade.
- queue count가 180~220ms spring으로 한 번 settle.
- SongRow 전체를 확대하거나 화면에 confetti를 뿌리지 않는다.
- 연속 담기 시 이전 애니메이션을 취소하고 최신 상태에 settle한다.

#### B. 계산 값 변경

- 저장된 실제 값과 accessible text는 즉시 새 값으로 변경한다.
- 시각 layer만 outgoing -4px/fade, incoming +4px→0으로 180ms settle한다.
- 숫자 0부터 목표값까지 중간 값을 빠르게 세는 count-up은 쓰지 않는다. 중간 금액이 실제 계산값처럼 보일 수 있기 때문이다.
- PriceInput typing·RangeSlider drag 동안 motion 없음.
- discrete Stepper·mode·최근 입력 선택 변화에만 settle motion 허용.
- live region은 마지막 입력 300ms 후 한 번만 알린다.

#### C. 티켓 발권

- route page transition은 생략하고 TicketCard만 발권한다.
- 6프레임 모두 같은 폭·높이·위치의 고정 slot을 사용하고, overflow-hidden stage 안에서 **TicketCard만 아래/뒤의 translateY 24px→0으로 위로 상승**하며 opacity 0→1이다.
- 회전은 최대 -0.6deg→0deg.
- slot width/height/position, TicketCard size/layout, side punch geometry는 animate/morph하지 않는다. 타공은 같은 TicketCard의 정적 geometry이며 처음에는 slot에 가려질 수 있을 뿐 생성되는 모션이 아니다. 타공 흔들림·종이 파편·반복 진동 없음.
- 최초 ticket 진입 또는 새 activePlan revision마다 Dexie snapshot의 `issueMotionClaimedAt` CAS를 통과한 한 browsing context에서만 정확히 한 번 실행한다. 같은 revision의 다른 탭·rerender·reload·PNG retry·share retry·back/forward restore는 0회다.
- reduced motion에서는 translate·rotation 없이 final state와 짧은 opacity fade만 쓴다.

#### D. 페이지 전환

- opacity + 4px 이내 shared-axis.
- forward/back 방향을 확실히 알 때만 x축 방향을 사용한다.
- 검색 결과 갱신은 page transition이 아니다.
- exit DOM과 enter DOM이 동시에 focusable하지 않게 한다.
- route 완료 후 main heading focus를 복구한다.

### 8-5. Reduced motion 구현

- `motion/react`의 `MotionConfig reducedMotion="user"`를 루트에 적용한다.
- useReducedMotion 분기에서 각 signature motion을 표의 대체 상태로 바꾼다.
- CSS media query는 최후 안전망이며 특정 motion class만 대상으로 한다.
- 전역 모든 transition을 0.01ms로 덮는 방식에만 의존하지 않는다.
- auto-play·infinite animation은 Skeleton pulse 외에 존재하지 않으며, reduced에서는 Skeleton도 멈춘다.

### 8-6. 성능

- transform·opacity 외 layout property animation 금지.
- filter·backdrop-filter·box-shadow animation 금지.
- will-change는 animation 직전 설정하고 완료 후 제거.
- shadow가 큰 TicketCard 전체 대신 내부 motion wrapper를 합성 layer로 만든다.
- RangeSlider input event마다 새 animation·Promise를 생성하지 않는다.
- requestAnimationFrame 작업은 route change/unmount에서 취소한다.
- 4× CPU slowdown에서 animation 중 long task 50ms 이상 0개를 목표로 한다.

---

## 9. Ticket artifact·PNG·OG

### 9-1. Renderer 구조

공통 데이터 모델만 공유한다.

**TicketArtworkModel**

```ts
type TicketArtworkModel = {
  artworkSeed: string;
  fixedTitleKey: "ticket.defaultTitle";
  songCount: number;
  durationLowSec: number;
  durationHighSec: number;
  coverageBps: number;
  totalLowWon: number;
  totalHighWon: number;
  perPersonLowWon: number;
  perPersonHighWon: number;
  people: number;
  pricingMode: "song" | "time";
  assumptionLabel: string;
  issuedAtLabel: string;
  serial: string;
  publicUrl?: string;
};
```

P0는 자유 ticket title을 받지 않는다. 시간과 비용은 단일 확정값으로 축약하지 않고 범위와 가정을 보존한다.
TicketCard/PNG/OG는 summary artifact이며 100곡 전체를 축소해 넣지 않는다. full song ledger는 공유 HTML의 TicketCard 다음에 semantic list로 제공한다. private PNG는 전체 목록 전달 수단이라고 부르지 않는다.

별도 renderer:

1. interactive DOM TicketCard
2. fixed-size PNG export renderer
3. Satori-compatible OG renderer

일반 DOM TicketCard를 next/og에서 그대로 재사용하지 않는다.

### 9-2. Canonical theme

- 인앱 TicketCard는 사용자 light/dark를 따른다.
- PNG·OG는 항상 canonical light paper theme로 출력한다.
- export root에 독립 token scope를 부여해 현재 document data-theme의 영향을 받지 않게 한다.
- --ticket-canvas를 타공 pseudo-element가 상속하도록 해 배경색 수동 일치 문제를 제거한다.

### 9-3. PNG

| 항목 | 규격 |
|---|---|
| 출력 | 1080×1350px, 4:5 |
| 렌더 root | 540×675 CSS px + pixelRatio 2 권장 |
| outer safe area | 출력 기준 최소 64px |
| title | 최대 2행, 초과 시 clamp |
| 필수 정보 | 제목·곡수·약 시간·총액·1인당·serial |
| 파일명 | singsong-ticket-YYYYMMDD.png |
| 색 | canonical light |
| 외부 이미지 | 0개 |

- document.fonts.ready 후 캡처한다.
- document.fonts.check로 Pretendard와 mono 숫자 폰트를 재확인한다.
- Ticket export DOM은 aria-hidden이고 화면용 semantic TicketCard를 중복 읽지 않는다.
- P0 export에는 album art나 다른 remote image가 존재하지 않는다.
- PNG 생성 중·성공·실패 상태를 Button과 live region으로 알린다.

### 9-4. QR 정책

- publicUrl이 있을 때만 실제 QR을 넣는다.
- 공개 slug 생성 없이 QR을 만들거나, 이미지 저장을 위해 조용히 공유를 생성하지 않는다.
- private/offline 이미지에는 QR이 없고 decorative serial bars만 있다.
- QR 최소 출력 크기 192×192px, 4-module quiet zone, 잉크 on white, gradient/rose recolor 금지.
- QR 아래에 “카메라로 열기” 성격의 실제 MICROCOPY key가 필요하다.
- iOS/Android 기본 카메라로 인쇄된 전체 이미지를 다른 화면에서 스캔하는 실기기 검증이 통과해야 한다.

### 9-5. OG

| 항목 | 규격 |
|---|---|
| 출력 | 1200×630px |
| layout | Satori 지원 flex subset |
| safe area | 사방 48px 이상 |
| 텍스트 | 제목 2행, 곡수·약 시간·1인당 |
| QR | 없음 — preview card 자체가 링크 |
| cache | `Cache-Control: no-store`; 매 요청 expiry/revoked exact lookup |
| 외부 이미지 | 0개 |

- 복잡한 mask, clip-path, grid, 브라우저 전용 shadow에 의존하지 않는다.
- UI TicketCard와 pixel-identical할 필요는 없지만 shape grammar, 색 의미, 정보 위계는 동일해야 한다.
- 카카오 미리보기에서 작은 thumbnail로 축소됐을 때도 제목과 핵심 숫자가 읽혀야 한다.
- missing/expired/revoked는 같은 generic unavailable OG image를 200/no-store로 반환한다. origin은 revoke 즉시 바뀌지만 이미 저장된 제3자 preview cache는 즉시 제거를 약속하지 않는다.

### 9-6. Story

1080×1920 story variant는 P2다. MVP에서 4:5 PNG를 먼저 완성하고, 실제 공유 지표가 확인된 뒤 추가한다.

---

## 10. 에셋 전략

### 10-1. 원칙

- 로고·UI icon·타공·barcode·QR·empty illustration 최종본은 inline/code-generated SVG 또는 직접 정리한 vector asset이다.
- 생성형 이미지는 아이디어·구도·모션 storyboard의 **reference-only**다.
- 생성 결과를 로고, PWA icon, 접근성 핵심 아이콘으로 그대로 납품하지 않는다.
- 생성 이미지 속 글자·가짜 UI를 제품에 사용하지 않는다.
- 외부 배경 이미지·실사 hero·3D render를 앱 shell에 넣지 않는다.

### 10-2. 예정 reference

- [Session Strip concept board — reference-only](./assets/session-strip-concept-board.png)
- [Ticket issue motion storyboard — reference-only](./assets/ticket-issue-storyboard.png)

위 두 PNG는 구현자가 **색·종이 물성·ledger 밀도·strip→ticket 관계**를 이해하기 위한 reference다. production bundle에 포함하지 않는다. 이미지 속 route/tab 수, 별도 계산 화면, 숫자·가격·시간, copy/CTA, punch 위치·개수, 재생 삼각형, share 버튼은 정본이 아니며 절대 복사하지 않는다. 이 문서의 2-tab/홈 내 계산/range/import 계약이 항상 우선한다.

### 10-3. Production asset 목록

| 경로 후보 | 형식 | 비고 |
|---|---|---|
| assets/brand/session-strip-mark.svg | SVG | 단색 mark |
| assets/brand/wordmark-ko.svg | SVG | wordmark |
| assets/icons/*.svg | inline SVG source | 24px, stroke 1.75px |
| assets/illustrations/empty-first-plan.svg | SVG | 첫 방문 한 곳 |
| assets/illustrations/link-gone.svg | SVG | 404/shared missing |
| public/icons/icon-192.png | PNG | PWA |
| public/icons/icon-512.png | PNG | PWA |
| public/icons/maskable-512.png | PNG | 중앙 safe zone |
| public/apple-touch-icon.png | PNG 180×180 | iOS |
| public/favicon.svg | SVG | browser |

### 10-4. Illustration 사용

- 첫 방문 empty: blank strip이 terminal에서 나오기 시작하는 장면
- shared link missing/404: 절취선에서 짝이 사라진 ticket half
- 검색 결과 없음: illustration 없음, 재검색 힌트 우선
- offline: 별도 그림을 늘리지 않고 inline status icon + 가능한 action
- illustration은 aria-hidden이며 의미는 heading/body/action이 전달한다.

### 10-5. Album art

- P0의 홈·검색·티켓·PNG·OG·공유 뷰 어디에도 album art를 사용하지 않는다.
- 제목·가수·TJ/KY 번호·순서·담김 상태의 typography와 ledger rule만으로 정보 위계를 만든다. image placeholder도 만들지 않는다.
- P1에서 다시 검토하려면 데이터/이미지 권리, 개인정보·referrer, CORS, 성능 budget, failure UI 증거와 `FINAL_BLUEPRINT` 변경 승인이 먼저다.

### 10-6. Reference 생성 프롬프트

Concept board:

> High-fidelity reference board for a Korean karaoke session planner, concept “Session Strip”. Show four **sequential states, not four app tabs**: (1) Search Ledger with a noninteractive checked “added” row and only PLAN/SEARCH bottom navigation, (2) the same strip on Plan with queue above and calculator embedded below one perforation, two modes Song/Time and estimated ranges, (3) a ticket issue state with no bottom navigation, (4) an unlisted received ticket with context-aware import action. One continuous paper strip progressively becomes one issued ticket. Off-white canvas, white paper, deep aubergine ink, rose action accent, restrained ochre money accent, monospaced range readouts, left-aligned editorial ledger, accessible contrast, minimal shadow. Punch holes only on the final issued ticket. No separate CALC route/tab, no fourth navigation item, no numeric keypad, no play triangle, no public toggle, no album art, no audio/music icons, no gradients/glass/neon/3D.

Motion storyboard:

> Six-frame motion storyboard for issuing a digital session ticket. The slot keeps exactly the same width, height, shape, and position in all six frames. The **same TicketCard only** rises upward from below/behind that fixed slot by 24→18→12→6→2→0 pixels; opacity settles 0→.25→.5→.72→.9→1, rotation -0.6→-0.45→-0.3→-0.18→-0.06→0 degree. Ticket size/layout and side punch geometry are static and may initially be occluded by the slot; nothing morphs. Frame numbers and plain arrows stay outside the art. No play triangle, no audio symbol, no share buttons, no tearing particles, no confetti, no bounce, no repeated punch animation, no camera motion. Reduced-motion inset shows final state with opacity only and zero translation/rotation. Add “REFERENCE ONLY — canonical motion: §8-4 C”.

---

## 11. 접근성 구현 계약

### 11-1. 구조

- 문서 최상위 lang=ko.
- 화면마다 main landmark와 하나의 명확한 h1.
- PrimaryNav는 nav + aria-current.
- 계산 mode는 tablist가 아니라 radiogroup.
- TicketCard는 article + heading + dl.
- BottomSheet는 Base UI dialog semantics와 제공되는 focus scope/inert/trigger-focus-return을 사용한다. 수제 focus trap은 만들지 않는다.
- ConfirmDialog 기본 focus는 취소 action.

### 11-2. 동적 상태

- 검색 결과 수, 계산 settle 결과, reorder 결과, export 상태는 용도별 live region을 분리한다.
- 매 animation frame이나 slider input마다 announce하지 않는다.
- route announcement와 Toast가 같은 문장을 중복 발화하지 않는다.
- loading spinner는 aria-hidden이고 Button에 aria-busy와 의미 label을 유지한다.

### 11-3. 입력·오류

- placeholder는 label이 아니다.
- 오류는 --color-danger border + icon + text로 표현한다.
- aria-invalid와 aria-describedby를 연결한다.
- keypress를 차단하는 방식보다 input value sanitize와 명확한 error를 우선한다.
- disabled 사유가 중요하면 focus 불가능한 disabled 하나로 끝내지 않는다.

### 11-4. Reorder

- pointer/touch drag만 제공하는 구현은 출시 불가.
- keyboard 조작, live 결과, cancel, focus retention을 갖춘다.
- 접근 가능한 DnD를 구현할 승인 의존성이 없으면 MVP에서는 명시적 위/아래 Button으로 대체한다.

### 11-5. Toast

- 정보 기본 4초, 오류 6초 이상.
- hover/focus 동안 auto-dismiss 일시정지.
- 오류와 사용자가 다시 확인할 필요가 있는 상태에는 close Button.
- 여러 Toast를 화면에 쌓지 않되, 새 메시지가 이전의 중요한 오류를 조용히 덮지 않게 severity policy를 둔다.

---

## 12. Acceptance gates

아래를 모두 통과하기 전 “디자인 완료”로 보고하지 않는다.

### 12-1. Screenshot matrix

필수 viewport:

- 320×568
- 390×844
- 768×1024
- 1440×900

필수 theme/환경:

- light
- dark
- prefers-reduced-motion
- forced-colors
- 200% text-only resize: 390px viewport에서 OS/browser text scaling만 적용
- 400% browser zoom reflow: 1280 CSS px viewport를 400%로 확대해 유효 320px reflow를 검증하고 text-only scaling은 reset

두 확대 모드를 무조건 곱한 Cartesian matrix로 실행하지 않는다. 특정 결함 재현이 있을 때만 조합한다.

필수 화면 상태:

| 화면 | 상태 |
|---|---|
| 홈 | 첫 방문 empty, 1곡, 24곡, 100곡, 긴 제목, song/time mode, reverse guaranteed/possible, offline |
| 발권 gate | 요금 없음, 인원 없음, invalid safe-integer/상한, valid→issue, direct `/ticket` recovery |
| 활성 플랜 | 위/아래 reorder 첫·마지막 disabled reason, delete+undo, 새 플랜 confirm/cancel |
| 검색 | 입력 전, loading, 결과, added, empty, network error, offline |
| 티켓 | issue 전/완료, share preflight/loading/resolved/cancel/error, image save, offline, dark UI/canonical export |
| 공유 | valid, 긴 제목, 100곡, empty 공유 가져오기, replace confirm/cancel, in-app handoff, import success, invalid/expired/revoked generic |
| 공통 | BottomSheet open, Toast, keyboard focus ring |

Screenshot 승인 질문:

1. 화면의 주인공이 한 개뿐인가?
2. Session Strip이 검색→홈→티켓에서 같은 세계관으로 읽히는가?
3. 로즈는 행동, 골드는 돈으로만 읽히는가?
4. 카드·pill·그림자가 필요 이상으로 반복되지 않는가?
5. 320px와 400% zoom에서 action과 label이 잘리지 않는가?

### 12-2. Contrast·automated a11y

- semantic token 대비 unit test
- axe-core: Critical/Serious 0
- Lighthouse accessibility 95+를 목표, 90 미만은 출시 차단
- interactive boundary 3:1
- normal text 4.5:1
- focus-visible 전 요소 수동 확인
- heading·landmark·accessible name snapshot 검증

### 12-3. Keyboard·screen reader

키보드만으로:

1. 홈 → 검색
2. 검색 → 담기
3. 현재 플랜 복귀
4. 계산 mode/Stepper/PriceInput/Slider 조작
5. reorder
6. 티켓 생성
7. BottomSheet·ConfirmDialog open/close
8. 공유 action

수동 AT:

- Windows NVDA + Chrome
- iOS VoiceOver + Safari
- Android TalkBack + Chrome

확인:

- modal focus containment와 trigger return(Base UI 제공 동작)
- route heading focus
- 계산 값 announce debounce
- reorder announce
- QR와 동일한 text link
- TicketCard 정보가 한 덩어리 이미지 설명으로 축약되지 않음

### 12-4. Motion

- 일반 motion 녹화와 reduced-motion 녹화를 나란히 남긴다.
- ticket route에서 page transition과 issue motion이 중첩되지 않는다.
- 같은 revision의 최초 진입 1회, rerender/PNG retry/share retry/back restore 0회; 새 revision 1회.
- slider drag와 typing 중 count animation 0회.
- error shake 0회.
- transform/opacity 외 animation 0건.
- 4× CPU slowdown에서 frame drop과 50ms 이상 long task를 기록한다.
- animation 종료 뒤 will-change가 남지 않는다.

### 12-5. PNG·OG

PNG:

- 정확히 1080×1350
- Pretendard·mono 숫자 정상
- 외부 이미지 누락/CORS 오류 없음
- dark UI에서도 canonical light
- 긴 제목 2행, 큰 금액 overflow 없음
- public QR은 iOS/Android 기본 카메라 양쪽에서 scan
- private/offline export가 서버 share를 만들지 않음

OG:

- 정확히 1200×630
- 실제 slug에서 200
- Kakao preview debugger와 실제 채팅 preview 확인
- 320px 폭 thumbnail에서도 제목·핵심 숫자 식별
- payload 특수문자가 text로만 렌더

### 12-6. 실기기·플랫폼

필수:

- 최신 iOS Safari
- 지원 하한 iOS Safari
- iOS Home Screen Web App standalone
- Android Chrome + Gboard
- Samsung Internet
- KakaoTalk in-app browser iOS/Android

시나리오:

1. 한글 조합 Enter가 submit을 오발하지 않음
2. soft keyboard가 ActionDock·error를 덮지 않음
3. iOS manual install guide가 현재 OS UI와 일치
4. 카카오 인앱에서 link share, clipboard, PNG failure fallback
5. standalone에서 safe area와 theme-color 정상
6. Safari에서 만든 IndexedDB 데이터가 설치 앱으로 자동 복사되지 않는 현실을 확인

**출시 차단 조건**: iOS 설치 전 데이터의 이전 프로토콜이 없다면 “설치하면 현재 플랜이 더 안전하게 남는다”는 카피와 설치 후 자동 보존 약속을 노출하지 않는다.

### 12-7. Visual regression

- 위 screenshot matrix를 Playwright baseline으로 관리한다.
- 동적 serial/date는 고정 fixture를 사용한다.
- font load 완료 후 캡처한다.
- 0.1% 이하의 pixel 차이 같은 기계적 기준만으로 승인하지 않고, diff + 사람이 형태 위계·overflow를 함께 검토한다.

---

## 13. 채택 후 레거시 동기화 체크리스트

이 문서는 `README.md` v3에서 정본으로 채택되었다. 다음은 기존 문서에 남은 표현을 후속 정리할 documentation debt다. 정리가 끝나기 전에도 구현은 `FINAL_BLUEPRINT`와 이 문서를 우선한다.

- DESIGN_SYSTEM: accent-text, border-control, semantic alias, radius, layout, motion token
- COMPONENTS: ghost text, PriceInput danger, TicketCard semantics, CalculationModeGroup radiogroup, ActionDock 추가
- SCREENS: responsive wide composition, mode-specific calc form, public notice, canonical export
- UX_FLOWS: 단일 활성 플랜, noindex/public wording, install data handoff
- MICROCOPY: 추정 시간, QR label, disabled reason, install transfer, revoke/takedown
- PLATFORM_NOTES: Safari Storage API 최신 상태, Home Screen Web App의 isolated local storage
- ONESHOT_MASTER: v3에서 반영 완료 — visual contract gate, QR/axe 의존성, screenshot matrix

레거시 동기화가 덜 됐다는 이유로 새 구현이 오래된 3모드·멀티리스트·앨범아트·카톡 SDK 우선순위를 복구해서는 안 된다.

---

## 14. 최종 판정 기준

Session Strip 방향이 성공한 결과는 다음 문장으로 설명할 수 있어야 한다.

> “노래를 담을 때부터 이미 티켓을 만들고 있었고, 계산을 끝내자 그 계획이 실제로 발권됐다.”

결과물이 단지 “핑크색으로 잘 정리된 음악 앱”이라면 이 문서의 목표를 달성하지 못한 것이다.
