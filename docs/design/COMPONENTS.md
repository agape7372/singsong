# COMPONENTS.md — 공통 컴포넌트 정본

> **정본 범위**: 16개 공통 컴포넌트의 목록·props·상태·변형(README §3). 색·타이포·스페이싱·모션의 **값**은 여기 안 씀 — 전부 [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) 토큰 이름만 참조.
> **버전**: v1.0 · 2026-07-21 · 짝 문서: [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)

---

## 0. 공통 규칙

- **목록은 16개로 고정**(BUILD_PLAN 확정 결정). 새 공통 컴포넌트가 필요하면 이 문서를 먼저 고친다 — 화면 코드에서 즉석으로 새 공통 컴포넌트를 만들지 않는다(화면 전용 1회성 UI는 예외, 공통화 대상 아님).
- 모든 상호작용 요소의 히트 영역은 DESIGN_SYSTEM §7 기준 **최소 44×44px**.
- 모든 hex는 여기 없음 — `--point`처럼 토큰명으로만 기술한다.
- 사용자 노출 문구는 전부 `〔문구: MICROCOPY §X〕` 플레이스홀더로 표기하고 실제 원문은 넣지 않는다(README §3, MICROCOPY.md가 정본).
- "사용 화면"란은 SCREENS.md의 화면명을 가리키는 **포인터**이며 그 화면의 레이아웃 자체는 SCREENS.md 소관.
- 상태표의 5(+2)단계 표기: **default / hover / focus-visible / active / disabled** 는 전 컴포넌트 공통 필수, **loading·selected**는 해당 컴포넌트에만.

---

## 1. Button

**용도**: 모든 화면의 1차/2차 액션(담기, 계산 확인, 티켓 만들기, 공유하기 등). **사용 화면**: 전 화면(SCREENS.md 각 화면 CTA 절).

```ts
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg"; // sm=36px, md=44px, lg=52px 높이

interface ButtonProps {
  variant?: ButtonVariant;      // default: "primary"
  size?: ButtonSize;            // default: "md"
  disabled?: boolean;
  loading?: boolean;            // true면 라벨 대신 스피너, disabled 겸함
  icon?: React.ReactNode;       // 인라인 SVG(§DESIGN_SYSTEM §8 규칙), leading만 지원
  fullWidth?: boolean;
  onClick?: () => void;
  children: React.ReactNode;    // 라벨 — MICROCOPY 원문, 즉석 작문 금지
  type?: "button" | "submit";
}
```

**variants**:
- `primary`: 배경 `--point`, 텍스트/아이콘 `--on-point`(잉크 — DESIGN_SYSTEM §2 규칙 1, 흰 글자 금지).
- `secondary`: 배경 `--surface`, 테두리 `--line`, 텍스트 `--ink`.
- `ghost`: 배경 투명, 텍스트 `--point`, 밑줄/배경 없음 — 대비상 16px 이하 단독 텍스트로 쓰지 않음(DESIGN_SYSTEM §2 규칙 4), 아이콘 동반 또는 20px+ 크기로만.
- `danger`: 계정/데이터 삭제 등 파괴적 액션 전용. 배경 `--surface`, 텍스트·보더 `--danger`(DESIGN_SYSTEM §1·§2 규칙 5 — 채움 배경 아님, 텍스트/아웃라인형). 로즈 겸용 금지.

**상태표**

| 상태 | 시각 변화 |
|---|---|
| default | variant 기본값 |
| hover | 배경 8% 어둡게(mix-blend 또는 `color-mix`), `--shadow-sm` 추가(primary/secondary만) |
| focus-visible | `outline: 2px solid var(--point); outline-offset: 2px` — 마우스 클릭 시엔 미표시(`:focus-visible`만) |
| active | 배경 12% 어둡게, `transform: scale(0.98)` |
| disabled | opacity 0.4, 클릭 불가, `cursor: not-allowed`, 그림자 제거 |
| loading | 라벨 자리에 스피너(아이콘 애니메이션은 `transform: rotate`), 클릭 무시하되 시각적으로 disabled와 구분(opacity는 유지) |

**a11y**: `<button>` 네이티브 요소 사용(role 명시 불필요). `aria-busy="true"` when loading. `aria-disabled`는 disabled와 loading 모두. 아이콘 전용 Button은 `aria-label` 필수(라벨 텍스트 없을 때).

**모션**: `--duration-fast` + hover/active 배경 전환. active의 `scale(0.98)`은 transform이라 reduced-motion에서도 유지 가능(즉시 적용, transition만 제거) — 순간 스냅으로 대체.

**금지 사례**: primary Button에 흰색(`#fff`) 텍스트를 하드코딩하는 것 — DESIGN_SYSTEM §2 실측(3.56:1)상 AA 미달.

---

## 2. Chip

**용도**: 태그(발라드 등), 필터, 선택형 옵션. **사용 화면**: 검색 결과 필터, 리스트 상세 태그, 티켓 장르 배지.

```ts
interface ChipProps {
  label: string;                 // MICROCOPY 또는 사용자 입력(태그명) — 사용자 입력은 §5 참조(신뢰 불가 입력)
  selected?: boolean;
  onToggle?: () => void;         // 있으면 클릭 가능한 필터 칩, 없으면 읽기 전용 배지
  removable?: boolean;           // true면 우측 x 아이콘(태그 삭제)
  onRemove?: () => void;
  icon?: React.ReactNode;
}
```

**variants**: `filter`(onToggle 있음, `selected` 토글) / `badge`(읽기 전용, onToggle 없음) / `removable`(removable=true).

**상태표**

| 상태 | 시각 |
|---|---|
| default | 배경 `--point-soft`, 텍스트 `--ink`(DESIGN_SYSTEM §2: 15.20:1) |
| hover | (filter만) 배경 살짝 진하게, 클릭 가능함을 커서로 표시 |
| focus-visible | `--point` 아웃라인 2px |
| active | `transform: scale(0.96)` |
| disabled | opacity 0.4 |
| selected | 배경 `--point`, 텍스트 `--on-point`(잉크) — 선택 시 반전 |

**a11y**: filter 칩은 `role="button" aria-pressed={selected}` 또는 체크박스형이면 `role="checkbox"`. removable 칩의 x 버튼은 별도 44px 히트 영역을 갖는 독립 `<button aria-label="{MICROCOPY 삭제 라벨}">`로 분리(칩 전체 클릭과 삭제 클릭이 겹치지 않게).

**모션**: 선택 토글 시 `--duration-fast`, 배경색 전환.

**금지 사례**: selected 칩에 골드를 쓰는 것 — 골드는 금액 의미 전용(DESIGN_SYSTEM §9), 선택 상태는 `--point`로 통일.

---

## 3. Stepper

**용도**: 인원수 증감(계산 카드), 곡 순서 내 미세 조정 등 정수 입력. **사용 화면**: 홈 계산 카드(인원).

```ts
interface StepperProps {
  value: number;
  min?: number;      // default 1
  max?: number;      // default 20
  step?: number;      // default 1
  onChange: (next: number) => void;
  label?: string;     // 스크린리더용, 시각적으로는 SCREENS.md가 배치 결정
}
```

**variants**: 없음(단일 형태). 크기만 `sm`/`md`(대부분 `md`).

**상태표**

| 상태 | 시각 |
|---|---|
| default | `-`/`+` 버튼 `--surface` 배경 + `--line` 보더, 값 텍스트 `--ink` 모노 tabular-nums |
| hover | 버튼 배경 `--muted` |
| focus-visible | 해당 버튼에 `--point` 아웃라인 |
| active | 버튼 `transform: scale(0.94)` |
| disabled | `min` 도달 시 `-` 버튼 disabled, `max` 도달 시 `+` 버튼 disabled(opacity 0.4, 각각 독립) |

**a11y**: 전체를 `role="group" aria-label="{label}"`으로 감싸고, 값은 `aria-live="polite"`인 텍스트 노드로 변경을 알림. 버튼은 각각 `aria-label="{MICROCOPY 감소/증가 라벨}"`.

**모션**: 값 변경 시 숫자 텍스트 `--duration-fast` 페이드+미세 스케일(카운트업까진 아님, Stepper는 정수 1스텝이라 즉시 갱신 + 짧은 pop).

**금지 사례**: `-`/`+` 버튼과 값 텍스트를 하나의 클릭 영역으로 합쳐 실수 입력을 유발하는 것 — 반드시 3분할(버튼/값/버튼) 독립 히트 영역.

---

## 4. SegmentedControl

**용도**: **3모드 전환** — 코인 곡당제 / 코인 시간제 / 룸 시간제. **사용 화면**: 홈 계산 카드 최상단(SCREENS.md § 계산 카드).

```ts
type CalcMode = "coin_per_song" | "coin_per_time" | "room_per_time"; // BUILD_PLAN §6 타입과 동일 값 사용 — 이름 임의 변경 금지

interface SegmentedControlProps {
  value: CalcMode;
  onChange: (mode: CalcMode) => void;
  options: { value: CalcMode; label: string }[]; // label은 MICROCOPY 원문
}
```

**variants**: 없음(3항목 고정 폭 균등 분할, 항목 수 가변화 금지 — 값이 딱 3모드이므로 UI도 3분할 전제로 설계).

**상태표**

| 상태 | 시각 |
|---|---|
| default(비선택 항목) | 배경 투명, 텍스트 `--ink-muted` |
| hover(비선택) | 텍스트 `--ink` |
| focus-visible | 해당 세그먼트에 `--point` 아웃라인 |
| active | 눌림 `transform: scale(0.97)` |
| disabled | 전체 opacity 0.4(특정 모드 프리셋 미비 등 예외 상황에만, 기본은 3모드 항상 활성) |
| selected | 흰(=`--surface`) 필 배경이 해당 세그먼트 아래로 슬라이드, 텍스트 `--ink` 볼드 — 트랙 배경은 `--muted` |

선택 표시는 배경색 반전이 아니라 **"움직이는 필(pill)"**: 트랙(`--muted`, `--radius-full`) 위에 `--surface` 배경의 슬라이더가 선택 항목 아래로 이동. 로즈를 selected 배경에 쓰지 않는 이유: 3개 중 하나가 상시 로즈로 채워지면 화면당 위계 규칙(로즈=액션 강조)이 흐려짐 — 선택 표시는 중립톤 대비로, 로즈는 이 아래 위치한 실제 CTA(Button)에 남겨둔다.

**a11y**: `role="tablist"`, 각 세그먼트 `role="tab" aria-selected` + `tabIndex`(선택 항목만 0, 나머지 -1) — 좌우 화살표 키로 항목 이동, Home/End로 처음/끝.

**모션**: 필 이동 `--duration-fast`, `--ease-standard`, `transform: translateX`(width 애니메이션 금지 — 고정폭 3분할이라 translateX만으로 가능).

**금지 사례**: 선택 필 배경에 `--point`를 채워 매 순간 로즈 블록이 상시 노출되는 것(액션색 남발).

---

## 5. PriceInput

**용도**: 코인 단가·룸 요금 입력(숫자 전용). **사용 화면**: 홈 계산 카드(단가/시간당 요금).

```ts
interface PriceInputProps {
  value: number | null;      // null=미입력
  onChange: (won: number | null) => void;
  min?: number;               // default 0
  max?: number;               // default 1_000_000
  placeholder?: string;       // MICROCOPY 원문
  presets?: number[];         // 자주 쓰는 값 칩(예: 지역 프리셋 — 실제 기본값은 BUILD_PLAN §6 소관, 여기서는 UI만)
}
```

**variants**: `withPresets`(하단에 Chip 프리셋 행 표시) / 기본(입력만).

**동작 규칙**:
- `inputMode="numeric"`, `type="text"`(브라우저 number 인풋의 스피너·과학표기 문제 회피) + `pattern="[0-9]*"`.
- 표시값은 **천단위 콤마**(`toLocaleString("ko-KR")`)로 포맷, 내부 상태는 숫자(콤마 제거) 유지 — IME/커서 점프 방지를 위해 포맷팅은 blur 시점에 적용하고 typing 중엔 raw 숫자만 허용(비숫자 keypress 무시).
- `min`/`max`/`NaN` 방어: 빈 문자열·비숫자 입력 시 `onChange(null)` 호출(0으로 임의 치환 금지 — 계산 엔진이 null을 "미입력"으로 구분해야 함, BUILD_PLAN §6 소관 규칙과 정합).
- max 초과 입력 시 클램프하지 않고 **에러 상태**로 표시(값은 유지, 사용자가 스스로 고치게) — 조용한 clamp는 사용자가 의도치 않은 값으로 계산되는 걸 막기 위함.
- 모바일 키보드: `inputMode="numeric"`으로 숫자 키패드 노출(iOS/Android 공통).

**상태표**

| 상태 | 시각 |
|---|---|
| default | 배경 `--surface`, 보더 `--line`, 텍스트 `--ink` 모노 tabular-nums |
| hover | 보더 `--ink-muted` |
| focus-visible | 보더 `--point`, `--shadow-sm` 추가 |
| active(타이핑 중) | focus와 동일 |
| disabled | opacity 0.4, 편집 불가 |
| error(NaN/범위 초과) | 보더 로즈 계열 강조(§DESIGN_SYSTEM 대비 규칙 준수 — 텍스트가 아니라 보더/아이콘이라 3:1 UI 기준 적용), 하단에 에러 카피(MICROCOPY) |

**a11y**: `<label>` 연결 필수, `aria-describedby`로 에러 메시지 연결, `aria-invalid={error}`.

**모션**: 값 변경 자체는 정적(카운트업은 계산 "결과" 표시 쪽 책임, PriceInput은 입력값이라 즉시 반영). 에러 진입 시 `--duration-fast` 셰이크(±4px, transform만, reduced-motion 시 셰이크 생략하고 보더색만 전환).

**금지 사례**: `type="number"` 네이티브 인풋을 그대로 써서 스피너 화살표·`e` 문자 입력·과학표기(`1e10`) 버그를 방치하는 것.

---

## 6. RangeSlider

**용도**: 역계산(예산/시간 → 곡수) 슬라이더. **사용 화면**: 홈 계산 카드 역계산 절.

```ts
interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;              // default 1
  onChange: (next: number) => void;
  formatValue?: (v: number) => string; // 트랙 위 말풍선 표시용, 원문 조합은 MICROCOPY 규칙
  ariaLabel: string;
}
```

**variants**: 없음(단일 핸들). 듀얼 핸들(범위 선택)은 v1 범위 밖 — 필요해지면 이 문서 개정.

**상태표**

| 상태 | 시각 |
|---|---|
| default | 트랙 `--line`, 채움 트랙 `--point`, 핸들 `--surface` + `--shadow-sm` |
| hover | 핸들 그림자 `--shadow-md`로 확대 |
| focus-visible | 핸들에 `--point` 아웃라인 |
| active(드래그 중) | 핸들 `transform: scale(1.15)`, 값 말풍선(툴팁) 표시 |
| disabled | 전체 opacity 0.4, 드래그 불가 |

**a11y**: 네이티브 `<input type="range">` 우선 사용(커스텀 스타일만 CSS로). `aria-valuemin/max/now/text`(now는 formatValue 결과) 자동 제공됨. **키보드 스텝**: 화살표 좌/우/상/하 = `step` 단위, `PageUp/PageDown` = `step * 10`, `Home/End` = min/max로 즉시 이동.

**모션**: 드래그 중 값 말풍선은 `--duration-fast` 페이드인, 핸들 확대는 `--spring-snappy`.

**금지 사례**: 커스텀 div 기반 슬라이더를 처음부터 새로 구현해 네이티브 키보드 접근성(화살표 키)을 스스로 재발명하다 놓치는 것 — 반드시 `<input type="range">` 위에 스타일링.

---

## 7. TabBar

**용도**: 화면 하단 1차 내비게이션(코어=세션 플래너가 주 탭, 나머지는 PRODUCT_SPEC IA 원칙에 따름). **사용 화면**: 전 화면 공통 하단 고정.

```ts
interface TabBarItem {
  key: string;
  label: string;        // MICROCOPY 원문
  icon: React.ReactNode; // outline/filled 쌍(§DESIGN_SYSTEM §8)
  href: string;          // 라우트 — README/BUILD_PLAN 확정 라우트만(/,/search,...)
}
interface TabBarProps {
  items: TabBarItem[];
  activeKey: string;
}
```

**variants**: 없음(항목 수·구성은 SCREENS.md/IA 결정 — 이 컴포넌트는 렌더 방식만 정의).

**상태표**

| 상태 | 시각 |
|---|---|
| default(비활성 탭) | 아이콘/텍스트 `--ink-muted` |
| hover | (터치 기기라 hover 약함) 배경 `--muted` 살짝 |
| focus-visible | `--point` 아웃라인 |
| active(탭) | 눌림 `transform: scale(0.95)` |
| selected(현재 라우트) | 아이콘 filled 변형 + 색 `--point`, 텍스트 `--ink` |

**a11y**: `<nav aria-label="{MICROCOPY 하단 내비 라벨}">` + 각 항목 `<a>`(Link) with `aria-current="page"` on selected. 44px+ 히트 영역, 세이프에어리어 하단 패딩(DESIGN_SYSTEM §7).

**모션**: 탭 전환 시 아이콘 outline→filled 크로스페이드 `--duration-fast`. 화면 자체 전환은 Button/페이지 전환 토큰과 공유.

**금지 사례**: 5개 초과 탭을 우겨넣어 각 히트 영역이 44px 미만으로 줄어드는 것.

---

## 8. SongRow

**용도**: 검색 결과·리스트 내 곡 한 줄 표시. **사용 화면**: `/search`, 홈 리스트, BottomSheet 내 곡 상세 진입점.

```ts
interface SongRowProps {
  title: string;
  artist: string;
  tjNo?: string | null;
  kyNo?: string | null;
  albumArtUrl?: string | null;  // iTunes 출처만(PRODUCT_SPEC §16 고지 의무 — 이 컴포넌트는 렌더만, 고지 문구는 SCREENS.md/MICROCOPY 소관)
  durationSec?: number | null;   // 항상 초 단위 — duration_min 표기 금지
  added?: boolean;                // 담긴 상태
  onAdd?: () => void;
  onRemove?: () => void;
  onClick?: () => void;           // 행 전체 클릭 = 상세 열람(있을 경우)
  dragHandleProps?: unknown;       // 홈 리스트 순서변경 시 DnD 라이브러리 핸들 prop 전달용
}
```

**variants**: `search`(우측 담기 버튼) / `listItem`(우측 삭제·드래그 핸들, added 항상 true) / `compact`(앨범아트 생략, 티켓 미리보기 등 좁은 폭).

**상태표**

| 상태 | 시각 |
|---|---|
| default | 배경 `--surface`, 하단 `--line` 구분선(리스트 연속 시) |
| hover | 배경 `--muted` |
| focus-visible | 행 전체(또는 클릭 가능 자식) `--point` 아웃라인 |
| active | 배경 한 톤 더 진하게, `transform: scale(0.99)`(리스트 스크롤과 헷갈리지 않게 아주 미세) |
| disabled | (드물게) opacity 0.4 — 예: 곡 DB 일시 검색 불가 |
| selected/added | 우측 아이콘이 `+`→`체크`로 전환, 텍스트 색 유지(added가 색 자체를 바꾸진 않음 — 아이콘만) |

**a11y**: 곡 정보 텍스트는 `<p>`/`<span>` 조합, 담기 버튼은 독립 `<button aria-label="{MICROCOPY 담기 라벨} {title}">`(곡명 포함해 스크린리더 목록에서 구분 가능하게). `durationSec`은 시각적으로 `MM:SS` 포맷(초 단위 원본값을 컴포넌트가 변환, 원본 필드명 자체는 유지).

**모션**: `onAdd` 클릭 시 `--spring-snappy`(아이콘 pop) — DESIGN_SYSTEM §6 "곡 담기" 마이크로인터랙션의 실제 발생 지점.

**금지 사례**: 앨범아트 로딩 실패 시 빈 공간을 그대로 두는 것 — 반드시 Skeleton 또는 SVG 플레이스홀더(마이크 아이콘)로 대체.

---

## 9. TicketCard — "입장권 크래프트"

**용도**: 세션 결과를 실물 티켓처럼 시각화 + PNG 공유의 핵심 오브젝트. **사용 화면**: `/ticket/[id]`, `/s/[slug]`, 홈에서 발권 직후 프리뷰.

```ts
interface TicketCardProps {
  slug: string;                 // 결정적 바코드/시리얼 생성 시드
  title: string;                // 리스트 제목
  songCount: number;             // "좌석 = 곡수"
  totalMinutes: number;          // 세션 시간(분 표시는 UI 텍스트로만, 내부 계산은 BUILD_PLAN §6 duration_sec 합산 기준 — 값 자체는 그쪽 정본)
  perPersonWon?: number | null;  // 1인당 금액(계산 안 했으면 null)
  mode: "coin_per_song" | "coin_per_time" | "room_per_time";
  createdAtLabel: string;        // 표시용 포맷 문자열(포맷 규칙은 MICROCOPY §표기)
  variant?: "hero" | "compact" | "exportTarget"; // exportTarget=PNG 캡처 대상 DOM
}
```

**variants**: `hero`(화면 내 표시, 그림자·인터랙션 포함) / `compact`(리스트 카드 안 축소형, 티켓 모티프만 암시) / `exportTarget`(PNG export용 — 그림자·hover 등 인터랙션 스타일 제거한 순수 정적 마크업, html-to-image가 캡처).

**절취선(dashed) 구현**: 좌석권처럼 상하 두 구역(요약부/좌석부)을 나누는 가로선. `border-top: 1.5px dashed var(--line)` 로 CSS 네이티브 dashed 사용(SVG 불필요, PNG export 시 CSS border는 html-to-image가 그대로 래스터화하므로 안전).

**양쪽 반원 타공**: 절취선 좌우 끝에 배경색으로 파인 반원 두 개. `radial-gradient` mask가 아니라 **배경과 동일한 `--base`색의 원형 pseudo-element**를 절취선 좌우 끝에 절대 위치시키는 방식 채택(이유는 §고찰) — 카드 배경이 `--surface`, 그 카드가 놓이는 배경이 `--base`이므로 pseudo-element는 `--base`색 원(지름 16px)을 카드 테두리에 절반 걸치게 배치:

```css
.ticket__punch { position: absolute; width: 16px; height: 16px; border-radius: 50%; background: var(--base); }
.ticket__punch--left  { left: -8px; }
.ticket__punch--right { right: -8px; }
```

`variant="exportTarget"`일 때는 캡처 배경이 `--base`가 아닐 수 있으므로(예: OG 이미지가 다른 배경 위) export 시엔 타공 pseudo-element의 배경색을 캡처 컨테이너의 실제 배경과 일치시키는 책임을 호출부(export 함수)가 진다 — TicketCard 자체는 `--base` 기준값만 기본 제공.

**바코드 — 결정적 스트라이프(랜덤 금지)**: `slug` 문자열을 해시(예: 문자열 각 char code 누적 xor/mod)해 고정 길이(예: 24개)의 스트라이프 폭 시퀀스를 만든다. **같은 slug는 항상 같은 바코드**가 나와야 함(재방문·재생성 시 시각적 일관성, 그리고 `Math.random()` 사용 시 서버 렌더/클라 렌더 hydration mismatch 위험도 있음). 의사코드:

```ts
function barcodeWidths(slug: string, bars = 24): number[] {
  let seed = 0;
  for (const ch of slug) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const widths: number[] = [];
  for (let i = 0; i < bars; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0; // LCG, 결정적
    widths.push(1 + (seed % 4)); // 1~4px 폭
  }
  return widths;
}
```
렌더는 `<div>` 스트라이프 나열(각 폭 다른 `<span>`, 배경 `--ink`) — SVG든 div든 무방하나 div가 PNG export 안정성이 더 높음(외부 리소스 없음 원칙 준수).

**시리얼**: `--font-mono`, `--text-caption` 또는 `--text-body-sm`, `letter-spacing` 넓게. slug 자체 또는 slug 앞 8자 대문자화해 "발권번호"처럼 표기(정확한 포맷 문자열은 MICROCOPY §표기 소관).

**좌석 배치**: "좌석 = 곡수" 모티프 — `SEAT {songCount}` 류 라벨(원문 MICROCOPY) 옆에 시간(`totalMinutes`)·1인당(`perPersonWon`, 있으면 `--gold-text`로 강조 — 골드 원색 아님, DESIGN_SYSTEM §2 규칙 2) 3열 배치.

**PNG export 시 주의**: html-to-image는 DOM을 그대로 래스터화하므로 (1) 외부 이미지(앨범아트 등)는 TicketCard 자체에 넣지 않는다 — CORS 미설정 이미지가 섞이면 export가 빈 캔버스로 나올 수 있음(iTunes 앨범아트를 티켓에 넣고 싶으면 export 전 별도 프록시/캔버스 사전처리가 필요 — **이 문서 범위 밖, ARCHITECTURE.md 소관**), (2) 웹폰트(Pretendard)는 self-host이므로 로드 완료 후 캡처해야 함(`document.fonts.ready` 대기), (3) `exportTarget` variant는 `box-shadow`처럼 캡처 시 잘릴 수 있는 효과를 export 전용 padding으로 보정.

**상태표**

| 상태 | 시각 |
|---|---|
| default | `hero`: `--shadow-lg`, `--radius-lg`, 배경 `--surface` |
| hover | (인터랙션 가능한 프리뷰일 때만) 그림자 확대 |
| focus-visible | 카드가 클릭 가능한 링크일 때 `--point` 아웃라인 |
| active | 눌림 `transform: scale(0.99)` |
| disabled | 해당 없음(정적 콘텐츠) |
| loading | 발권 애니메이션 진행 중(§모션) — songCount 등 값 미확정 시 Skeleton 조합 |

**a11y**: 전체를 `role="img" aria-label="{요약: 제목·곡수·시간·1인당을 조합한 대체텍스트, MICROCOPY 규칙}"`으로 감싸 스크린리더가 바코드/타공 등 장식 DOM을 개별 순회하지 않게 함(장식 요소는 `aria-hidden="true"`).

**모션**: 발권 시 `--spring-soft` + `--duration-slow`로 아래에서 위로 `translateY` 슬라이드업, 도착 직전 살짝 회전(`rotate(-1deg → 0deg)`)으로 "찍" 발권감. reduced-motion 시 페이드(`opacity`)만 `--duration-fast`.

**금지 사례**: 바코드 스트라이프 폭을 `Math.random()`으로 생성 — 새로고침마다 바코드가 바뀌어 "진짜 티켓" 신뢰감을 해치고 SSR/CSR hydration mismatch도 유발.

---

## 10. BottomSheet

**용도**: 곡 상세, 필터, 확인류 등 화면 하단에서 올라오는 패널. **사용 화면**: 다수(SCREENS.md 각 화면의 시트 절).

```ts
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;               // MICROCOPY 원문
  children: React.ReactNode;
  snapPoints?: ("half" | "full")[]; // 기본 ["half"], 드래그로 확장 가능 여부
  dismissible?: boolean;         // false면 바깥 클릭/스와이프 닫기 비활성(강제 흐름용, 드묾)
}
```

**variants**: `default`(제목+본문+닫기), `noHeader`(제목 생략, children이 자체 헤더 포함).

**상태표**

| 상태 | 시각 |
|---|---|
| default(닫힘) | 렌더 안 됨(또는 `display:none`) |
| open | 배경 스크림(반투명 `--ink` 오버레이) + 시트 `--surface`, `--radius-md`(상단만), `--shadow-lg` |
| hover(닫기 버튼 등 내부 요소) | 해당 요소 규칙 따름 |
| focus-visible | 포커스 트랩 내 첫 포커스 요소부터 순차 |
| active(드래그 중) | 시트가 손가락 따라 `translateY`, 손 뗄 때 임계값 넘으면 닫힘 애니메이션 |
| disabled | 해당 없음 |

**a11y**: `role="dialog" aria-modal="true" aria-labelledby="{title id}"`. **포커스 트랩**: open 시 시트 내부로 포커스 이동(첫 인터랙티브 요소, 없으면 시트 컨테이너 자체에 `tabIndex={-1}`), `Tab`/`Shift+Tab`이 시트 내부에서만 순환, 닫힐 때 트리거 요소로 포커스 복귀. **ESC 키**로 닫기(`dismissible !== false`일 때). 배경 스크림 클릭도 동일 조건에서 닫기. 열림 중 배경 콘텐츠는 `inert` 또는 `aria-hidden="true"`로 스크린리더에서 숨김.

**모션**: 열림 `--duration-base` `--ease-standard`, `transform: translateY(100%→0)` + 스크림 `opacity` 페이드. 닫힘은 역방향 `--duration-fast`(닫힘은 더 빠르게 — 사용자가 이미 의도를 표현했으므로 지체 없이). reduced-motion 시 슬라이드 생략, `opacity`만.

**모바일/데스크톱 반응형**: **448px 프레임 안에서도 BottomSheet는 그대로 유지 — 별도 Dialog(중앙 모달) 변형을 만들지 않는다.** 근거는 §고찰.

**금지 사례**: 시트 열림 중 배경 콘텐츠에 포커스가 남아 스크린리더 사용자가 시트 밖 요소를 탐색하게 두는 것(포커스 트랩 누락).

---

## 11. Toast

**용도**: 짧은 피드백(담김 확인, 링크 복사됨, 오프라인 전환 등). **사용 화면**: 전 화면 공통.

```ts
interface ToastProps {
  message: string;              // MICROCOPY 원문
  variant?: "default" | "success" | "error";
  duration?: number;             // ms, default 2600
  onDismiss?: () => void;
}
```

**variants**: `default`(중립), `success`(담기·저장 성공 등), `error`(실패 — 명확성 우선 톤, MICROCOPY §톤 규칙에 따라 반말이어도 모호하지 않게).

**상태표**

| 상태 | 시각 |
|---|---|
| default(등장 전) | 렌더 안 됨 |
| visible | 하단 고정(탭바 위), 배경 `--ink`(다크 배경 위 밝은 텍스트 — 라이트/다크 모드 무관하게 항상 잉크 계열로 통일해 "시스템 알림" 톤 분리), 텍스트 `--surface`(라이트 잉크 배경 위 흰 계열 텍스트) 또는 다크 모드에선 배경 `--surface`(dark) + 텍스트 `--ink`(dark) — 즉 Toast는 항상 "그 모드의 반전 대비"로 항상 최고 대비 유지 |
| hover | 스와이프 닫기 준비 상태(터치라 hover 미약, 데스크톱 마우스만 커서 변화) |
| focus-visible | 닫기 버튼 있으면 해당 요소만 |
| active | 스와이프 드래그 중 `translateX` |
| disabled | 해당 없음 |

**a11y**: 컨테이너 `role="status" aria-live="polite"`(error도 긴급성 낮게 polite 유지 — 파괴적 오류가 아닌 한 assertive로 화면 흐름을 끊지 않음; 데이터 유실 등 중대 오류는 Toast가 아니라 ConfirmDialog급으로 격상해야 함, MICROCOPY §에러 규칙). 자동 사라짐 `duration` 동안 스크린리더가 읽을 시간을 벌기 위해 최소 2.6초 유지, `prefers-reduced-motion`과 무관하게 유지시간 자체는 변하지 않음(모션만 줄임).

**모션**: 등장 `translateY` + `opacity`, `--duration-fast`. 자동 사라짐 시 동일 역방향. reduced-motion 시 페이드만.

**금지 사례**: 여러 Toast를 동시에 스택으로 쌓아 화면을 덮는 것 — 최신 1개만 표시, 새 Toast 등장 시 이전 Toast는 즉시 교체(큐잉 없음).

---

## 12. Skeleton

**용도**: 로딩 placeholder(검색 결과, 리스트, 티켓 프리뷰 등). **사용 화면**: 전 화면 공통 로딩 상태.

```ts
interface SkeletonProps {
  variant: "text" | "row" | "card" | "circle";
  width?: string | number;
  height?: string | number;
  count?: number;                // 반복 렌더(리스트 로딩 시 3~5개 등)
}
```

**variants**: 위 4종. `row`는 SongRow 자리, `card`는 TicketCard/리스트 카드 자리.

**상태표**: Skeleton은 항상 "loading 표현 그 자체"라 default=hover=disabled 개념이 약함 — `visible`(애니메이션 중) 단일 상태만 존재. focus 대상 아님(`aria-hidden` 처리, 아래 a11y).

**a11y**: 스켈레톤 그룹 전체를 `aria-hidden="true"`로 스크린리더에서 숨기고, 그 부모/형제에 `aria-live="polite"` 텍스트(예: "{MICROCOPY 로딩 중 라벨}")를 시각적으로 숨김 처리(`sr-only`)해 별도로 제공 — 스켈레톤 자체를 스크린리더가 읽지 않게 하는 게 핵심.

**모션**: 배경 `--muted`↔`--line` 사이를 오가는 `opacity` shimmer, `--duration-slow`의 2배 주기로 무한 반복(`background-position` 애니메이션이 아니라 opacity pulse로 구현 — width/background-position류 리페인트 유발 속성 회피, DESIGN_SYSTEM §6 금지 규칙 준수). reduced-motion 시 애니메이션 정지, 정적 `--muted` 배경만.

**금지 사례**: 로딩 상태에서 빈 화면(흰 배경)을 그냥 두는 것 — BUILD_PLAN §14 "빈상태/로딩/에러가 성의있게" 요건 위반.

---

## 13. EmptyState

**용도**: 검색 결과 없음, 리스트 비어있음, 오프라인 등 콘텐츠 부재 상태. **사용 화면**: `/search`(결과 0건), 홈(리스트 비어있음).

```ts
interface EmptyStateProps {
  illustration?: React.ReactNode; // 코드 생성 SVG(§DESIGN_SYSTEM §8 규칙, Phase 7 산출물)
  title: string;                  // MICROCOPY 원문
  description?: string;           // MICROCOPY 원문
  action?: { label: string; onClick: () => void }; // 예: "인기곡 보러가기"
}
```

**variants**: `search-empty` / `list-empty` / `offline` / `error` — variant별 illustration·문구 세트만 다르고 구조는 동일.

**상태표**: 정적 콘텐츠라 default 외 상태 거의 없음. `action`이 있으면 그 Button의 상태표를 따름.

**a11y**: 제목은 `<h2>` 또는 해당 영역의 heading 레벨에 맞게, illustration은 `aria-hidden="true"`(장식), 의미는 title/description 텍스트로만 전달.

**모션**: 등장 시 `--duration-base` 페이드+살짝 `translateY`(8px). 반복 애니메이션 없음(과하면 AI티 — BUILD_PLAN §14 "마이크로인터랙션 핵심 3~4곳만" 원칙, EmptyState는 그 4곳에 없음).

**금지 사례**: "결과 없음"을 텍스트 한 줄로만 처리 — 반드시 일러스트+제목+대안 액션 3요소 성의있게 구성.

---

## 14. ConfirmDialog

**용도**: 파괴적 액션(리스트 삭제, 계정 삭제 등) 확인. **사용 화면**: 홈(리스트 삭제), 설정류 화면(있을 경우).

```ts
interface ConfirmDialogProps {
  open: boolean;
  title: string;                  // MICROCOPY 원문
  description?: string;           // MICROCOPY 원문 — 데이터 유실 경고는 명확성 우선 톤(친구톤 예외)
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;          // true면 confirmLabel 버튼이 danger variant
  onConfirm: () => void;
  onCancel: () => void;
}
```

**variants**: `default` / `destructive`(confirm 버튼이 Button `danger` variant).

**상태표**: 내부 두 Button(취소/확인)의 상태표를 각각 따름. 컨테이너 자체는 BottomSheet와 동일한 open/닫힘 상태 구조를 공유(작은 화면에서는 BottomSheet 위에 얹히는 형태로 구현 가능 — 구현 세부는 ARCHITECTURE.md).

**a11y**: `role="alertdialog" aria-modal="true" aria-labelledby aria-describedby`. **기본 포커스는 '취소' 버튼**(파괴적 액션의 실수 확정을 막기 위해 확인 버튼에 기본 포커스를 주지 않음). ESC = 취소와 동일 동작. 포커스 트랩은 BottomSheet와 동일 규칙.

**모션**: BottomSheet와 동일 토큰 공유(같은 "패널 등장" 계열이라 별도 신규 토큰 불필요).

**금지 사례**: 기본 포커스를 '확인'/'삭제' 버튼에 두어 Enter 연타 실수로 파괴적 액션이 실행되는 것.

---

## 15. SearchInput

**용도**: 곡 검색 입력(초성/부분일치). **사용 화면**: `/search`(독립 페이지, 모달 아님 — 확정 결정).

```ts
interface SearchInputProps {
  value: string;
  onChange: (query: string) => void;
  onSubmit?: (query: string) => void; // 엔터 시(선택 — 대부분 실시간 디바운스라 옵션)
  placeholder?: string;                // MICROCOPY 원문
  autoFocus?: boolean;
  loading?: boolean;                   // 검색 중 스피너
}
```

**variants**: 없음(단일 형태) — 페이지 상단 고정 배치 여부는 SCREENS.md 소관.

**IME 처리**: 한글 조합 중(`isComposing`) 입력값 변화로 검색을 트리거하지 않는다. 정확한 조합 이벤트 처리·초성 엣지 케이스는 **PLATFORM_NOTES.md 참조**(값 복사 금지) — 이 문서는 "IME 조합 완료 후에만 debounce 카운트 시작"이라는 인터페이스 계약만 명시.

**입력 속성**: `inputMode="search"`, `type="search"`(가능하면 — 모바일 키보드에 검색/이동 키 노출), `enterKeyHint="search"`. **지우기 버튼**: 값이 비어있지 않을 때만 우측에 x 아이콘 버튼 노출, 클릭 시 `onChange("")` + 포커스 유지.

**상태표**

| 상태 | 시각 |
|---|---|
| default | 배경 `--surface`, 보더 `--line`, placeholder `--ink-muted` |
| hover | 보더 `--ink-muted` |
| focus-visible | 보더 `--point`, `--shadow-sm` |
| active(타이핑 중) | focus와 동일 + 지우기 버튼 노출 |
| disabled | opacity 0.4(예: 오프라인 시 서버 검색 불가 안내와 함께) |
| loading | 우측에 지우기 버튼 대신(또는 옆에) 스피너 |

**a11y**: `role="searchbox"` 또는 `<input type="search">`의 암시적 role 활용, `aria-label` 필수(placeholder만으로 라벨 대체 금지). 결과 카운트 변화는 SearchInput이 아니라 결과 리스트 쪽에서 `aria-live` 처리(SCREENS.md 소관).

**모션**: 지우기 버튼 등장/퇴장 `--duration-fast` 페이드.

**금지 사례**: 조합 중(`isComposing === true`)에 매 keystroke마다 검색 API를 호출해 초성 단계에서 이상한 쿼리가 서버로 나가는 것.

---

## 16. AttributionBadge

**용도**: fork(임포트)한 리스트에 **출처(원본 공유물)**를 표기. **사용 화면**: 홈 리스트 카드(포크된 경우), `/list/[id]` 상세 — **`/s/[slug]` 공유 뷰에는 쓰지 않는다**(공유 뷰가 곧 원본이며, 익명 구조상 "만든 사람" 표기가 불가능. 표기 내용은 원본 리스트 **제목** 기반 — 닉네임 없음, MVP 확정).

```ts
interface AttributionBadgeProps {
  originTitle: string;            // 원본 리스트 제목(사용자 입력 — 신뢰 불가, 렌더 시 이스케이프 필수)
  originSlug: string;              // 원본으로 이동 링크
  onClick?: () => void;
}
```

**variants**: 없음(단일 형태) — 표시 문구는 `〔문구: MICROCOPY §AttributionBadge〕` 플레이스홀더(예: "OO님 리스트에서 가져옴" 류, 정확한 원문은 MICROCOPY.md 소관).

**상태표**

| 상태 | 시각 |
|---|---|
| default | 배경 `--muted`, 텍스트 `--ink-muted`, 아이콘(포크 화살표) |
| hover | 텍스트 `--ink`(클릭 가능해 원본으로 이동함을 암시) |
| focus-visible | `--point` 아웃라인 |
| active | `transform: scale(0.98)` |
| disabled | 사용 안 함 — 원본 생존 여부를 라이브 체크하지 않는다(항상 클릭 가능, 원본이 takedown됐으면 `/s/[slug]`의 404 상태가 처리. SCREENS §7-4) |

**a11y**: 클릭 가능하면 `<a>`(Link)로 구현, `aria-label`에 원본 제목 포함.

**모션**: 없음(정적 배지, 별도 마이크로인터랙션 대상 아님).

**금지 사례**: `originTitle`(사용자 입력값)을 `dangerouslySetInnerHTML`로 렌더 — 공유 payload는 신뢰 불가 입력(ONESHOT P5), 반드시 텍스트 노드로만 렌더.

---

## 고찰

1. **BottomSheet를 448px 프레임 안에서도 그대로 유지하고 별도 데스크톱 Dialog(중앙 모달) 변형을 만들지 않았다.** 확정 결정(브레이크포인트 §DESIGN_SYSTEM §7)상 448px는 "데스크톱 레이아웃"이 아니라 확대된 모바일 프레임이다. 프레임 폭 자체가 448px로 좁아 중앙 모달과 바텀시트의 시각적 차이가 실질적으로 거의 없고(둘 다 프레임 폭을 거의 다 채움), 컴포넌트 변형을 늘리면 상태표·a11y 트랩 로직을 두 벌 유지해야 해 버그 표면이 늘어난다. 대안(진짜 데스크톱에서 중앙 모달로 전환)은 "데스크톱 전용 레이아웃 없음" 확정 결정과 정면 충돌해 기각.
2. **TicketCard 타공을 SVG mask 대신 배경색 원(pseudo-element) 방식으로 결정.** `radial-gradient` mask는 CSS 이론상 더 "정확"하지만 html-to-image 같은 DOM-to-canvas 라이브러리가 `mask`/`clip-path` 속성을 브라우저·버전에 따라 불완전 지원하는 사례가 실무에서 흔하다(**실측 필요** — 실제 도입 시 Phase 5에서 재검증). 배경색 원 겹치기는 캡처 신뢰성이 높은 대신 카드가 놓이는 배경색이 바뀌면(예: OG 이미지 배경) 타공 색을 수동으로 맞춰야 하는 트레이드오프가 있다 — export 함수 책임으로 명시해 해결.
3. **바코드를 slug 해시 기반 결정적 생성으로 강제.** `Math.random()`을 썼다면 구현이 더 간단했겠지만, 같은 티켓을 다시 열었을 때(`/s/[slug]` 재방문) 바코드 모양이 달라지면 "진짜 발권된 입장권" 메타포가 깨지고, Next.js SSR(서버에서 OG 이미지·초기 HTML 생성) 환경에서는 hydration mismatch 버그로도 이어질 수 있어 결정적 생성을 필수 규칙으로 못박았다.
4. **Toast를 "그 모드의 반전 대비"로 규정**(라이트에선 어두운 배경+밝은 텍스트, 다크에선 밝은 배경+어두운 텍스트)해 시스템 알림처럼 항상 도드라지게 했다. 대안으로 Toast도 다른 컴포넌트처럼 `--surface`/`--ink` 조합을 그대로 쓰는 안을 검토했으나, 그러면 다크 모드에서 Toast가 배경에 거의 묻혀(둘 다 어두운 톤) 순간적 피드백성이 떨어진다고 판단해 반전 규칙을 택함.
5. **ConfirmDialog 기본 포커스를 '취소'로 강제**한 것은 BUILD_PLAN 지시를 그대로 따른 결정이지만, 근거를 명확히 남긴다: 파괴적 액션 다이얼로그에서 Enter 키 습관(다른 다이얼로그에서 확인=기본 포커스인 UX에 익숙한 사용자)으로 인한 오삭제를 막는 표준 패턴(iOS/Android 공통 관례)이다.
6. **AttributionBadge의 실제 표기 문구를 이 문서에 쓰지 않고 플레이스홀더로만 남겼다.** 정본 경계 규칙(README §3, MICROCOPY.md가 문구 정본) 때문 — 이 문서가 문구까지 확정하면 나중에 MICROCOPY.md와 값이 어긋나는 전형적 실패 패턴(사실 1개, 파일 2개)이 생긴다.

## 검증 체크리스트

- [ ] 컴포넌트 소스 파일 수 = 16(공통 목록과 1:1, 화면 전용 컴포넌트와 혼재되지 않았는지 폴더 구조로 확인 — ARCHITECTURE.md 폴더 규칙과 대조).
- [ ] 각 컴포넌트의 default/hover/focus-visible/active/disabled 5상태가 `/dev/components` 데모 페이지에서 전부 강제 트리거 가능(예: `?state=disabled` 류 프리뷰 스위치)한지 확인.
- [ ] BottomSheet·ConfirmDialog: 키보드만으로 열기→Tab 순환(트랩 확인)→ESC 닫기→포커스 트리거 요소 복귀까지 수동 테스트.
- [ ] ConfirmDialog 오픈 직후 스크린샷에서 포커스 링이 '취소' 버튼에 있는지 확인.
- [ ] TicketCard: 같은 slug로 두 번 렌더(새로고침 포함) 시 바코드 스트라이프 픽셀 단위로 동일한지 스크린샷 diff.
- [ ] TicketCard PNG export: 외부 네트워크 이미지 요청 0건(devtools Network 탭, `variant="exportTarget"` 렌더 시).
- [ ] SearchInput: 한글 자모 입력 중 네트워크 탭에 검색 요청이 조합 완료 전 발생하지 않는지 확인(PLATFORM_NOTES 시나리오와 대조).
- [ ] `grep -rn "dangerouslySetInnerHTML"` — AttributionBadge를 포함한 사용자 입력 렌더 컴포넌트 전체에서 0건.
- [ ] `grep -rn "#[0-9A-Fa-f]\{3,6\}"` 컴포넌트 소스 — 0건(전부 `var(--token)`).

## 미결

- ~~Button `danger` 토큰 미정~~ → **해소(v1.0 리뷰)**: DESIGN_SYSTEM §1에 `--danger`(라이트 `#C43A3A`/다크 대응값) 신설, danger variant는 텍스트·보더형으로 확정.
- TicketCard 타공(pseudo-element 배경색 방식)의 html-to-image 실제 캡처 안정성은 **실측 필요**(Phase 5 구현 시 실제 라이브러리로 검증, mask/clip-path 대안과 스크린샷 비교).
- ConfirmDialog를 BottomSheet 위에 얹는 구현(모바일 vs "작은 화면에서 시트형") 세부는 이 문서가 인터페이스만 정의하고 실제 DOM 합성 방식은 ARCHITECTURE.md/구현 재량 — 완전히 별도 오버레이로 할지 BottomSheet 합성으로 할지 **기획 확인 필요**.
- ~~AttributionBadge 원본 삭제 시 표시 정책~~ → **해소(v1.0 리뷰)**: 라이브 체크 없음·항상 활성 링크·404는 `/s/[slug]`가 처리로 확정. 다단계 fork(fork의 fork)의 원작자 연쇄 표기는 MVP 미지원(직전 1단계만, UX_FLOWS §3-2).
