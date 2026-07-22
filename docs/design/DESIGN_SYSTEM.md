# DESIGN_SYSTEM.md — 디자인 토큰 정본

> **v3 레거시 경고 (2026-07-21)**: 기존 토큰·대비 근거 참고용이다. 새 semantic token·형태·모션은 [`VISUAL_MOTION_DIRECTION.md`](./VISUAL_MOTION_DIRECTION.md)가 우선한다.

> **정본 범위**: 색·타이포·스페이싱·라운드·그림자·모션 토큰·브레이크포인트·아이콘 규칙 (README §3).
> hex 색상값이 존재해도 되는 **유일한 문서**. 다른 문서는 토큰 이름(`--point`, `--gold-text` 등)만 쓴다.
> **버전**: v1.0 · 2026-07-21 · 짝 문서: [`COMPONENTS.md`](./COMPONENTS.md)

---

## 0. 출발점과 이 문서의 역할

PRODUCT_SPEC §14가 제시한 5개 베이스 hex(포인트 로즈·코인 골드·잉크·베이스·로즈 소프트)를 이 문서가 **정본으로 흡수**한다. 이 문서는 그 5개를 그대로 복사하는 데서 그치지 않고 (1) 파생 토큰을 설계하고 (2) 실제 WCAG 대비율을 계산해서 **텍스트로 못 쓰는 색을 명시적으로 걸러낸다**. 아래 §2의 계산 결과, PRODUCT_SPEC이 암묵 전제한 "골드 큰 숫자 = large text 3:1로 OK"는 **실측상 틀렸다** — 골드 원색은 라이트 배경에서 1.90:1로 3:1에도 못 미친다. 이 문서가 그 교정값(`--gold-text`)을 정의한다.

---

## 1. 색 토큰 — 라이트 (기본)

| 토큰 | hex | 용도 |
|---|---|---|
| `--base` | `#FDF6F9` | 앱 배경(살짝 핑크빛 화이트, 순백 회피) — PRODUCT_SPEC §14 |
| `--surface` | `#FFFFFF` | 카드·바텀시트·팝오버 등 배경 위에 뜨는 표면 (base보다 살짝 밝혀 elevation 표현) |
| `--muted` | `#FBEFF3` | 섹션 구분용 옅은 워시(빈 상태 배경, 비활성 영역) |
| `--line` | `#F0DCE4` | 헤어라인 보더·구분선 (텍스트 아님 — 엄격한 AA 대상 아님, 육안 식별 가능한 최소 채도만 확보) |
| `--ink` | `#1C1622` | 본문 텍스트(퍼플 바이어스) — PRODUCT_SPEC §14 |
| `--ink-muted` | `#6B5D6E` | 보조 텍스트·캡션·placeholder |
| `--point` | `#FF2E74` | 액션 강조(버튼·링크·선택 상태) — PRODUCT_SPEC §14 |
| `--point-soft` | `#FFE7F0` | 배지·칩 배경(=로즈 소프트) — PRODUCT_SPEC §14 |
| `--on-point` | `#1C1622` | `--point` 채움 위에 얹는 텍스트/아이콘 색. **흰 글자 아님** — §2 참조 |
| `--gold` | `#F5A623` | 코인 골드 — PRODUCT_SPEC §14. **라이트 모드에서 텍스트 용도 전면 금지**(§2), 장식·아이콘·다크모드 텍스트 전용 |
| `--gold-text` | `#995F00` | 라이트 모드에서 금액 숫자 등 **텍스트로 골드 의미를 표현할 때 쓰는 진한 골드**. `--gold`의 텍스트 안전 대체 |
| `--danger` | `#C43A3A` | 파괴적 액션(삭제 확정 등) 전용 경고색. 로즈(`--point`)와 의미 분리 — 로즈=액션, danger=파괴. 텍스트·보더 용도(채움 배경 아님) |

금지: 위 표에 없는 hex를 컴포넌트·화면 코드에 직접 쓰는 것. 새 색이 필요하면 이 표에 먼저 추가한다.

---

## 2. 대비 검증표 (WCAG 2.1, 실측 계산)

계산법: sRGB 채널을 선형화(`c ≤ 0.03928` 이면 `c/12.92`, 아니면 `((c+0.055)/1.055)^2.4`) → 상대휘도 `L = 0.2126R + 0.7152G + 0.0722B` → 대비율 `(L₁+0.05)/(L₂+0.05)` (L₁이 밝은 쪽). AA 기준: 일반 텍스트 4.5:1, 큰 텍스트(24px 이상 또는 18.66px 이상 bold) 3:1, UI 컴포넌트 경계 3:1.

| 조합 | 상대휘도(L) | 대비율 | 판정 |
|---|---|---|---|
| `--ink` on `--base` | 0.00901 / 0.93644 | **16.72:1** | AAA — 본문 텍스트 |
| `--ink-muted` on `--base` | 0.12083 / 0.93644 | **5.78:1** | AA — 보조 텍스트 |
| `--ink` on `--point-soft` | 0.00901 / 0.84699 | **15.20:1** | AAA — 칩 라벨 텍스트 |
| `--point` on `--base` (텍스트로 쓸 때) | 0.24475 / 0.93644 | **3.35:1** | 일반 텍스트 AA(4.5) **미달**. 큰 텍스트/UI 3:1은 통과 → 작은 로즈 텍스트 금지, 링크·큰 강조에만 |
| 흰 글자(`#FFFFFF`) on `--point` 채움 | 1.0 / 0.24475 | 3.56:1 | 일반 텍스트 AA **미달** → 로즈 버튼에 흰 글자 금지 |
| `--on-point`(=ink) on `--point` 채움 | 0.00901 / 0.24475 | **5.00:1** | AA 통과 → 로즈 버튼 텍스트는 잉크색 |
| `--gold` on `--base` (텍스트로 쓸 때) | 0.46804 / 0.93644 | **1.90:1** | **큰 텍스트 3:1조차 미달.** 라이트 모드 텍스트 전면 금지, 장식만 |
| `--gold-text` on `--base` | 0.14958 / 0.93644 | **4.94:1** | AA 통과 → 금액 숫자는 라이트 모드에서 이 토큰 사용 |
| `--danger` on `--base` | 0.15060 / 0.93644 | **4.92:1** | AA 통과 → 파괴 액션 텍스트/보더 안전 |

**다크 모드** (색은 §3):

| 조합 | 대비율 | 판정 |
|---|---|---|
| `--ink`(dark) on `--base`(dark) | **16.27:1** | AAA |
| `--ink-muted`(dark) on `--base`(dark) | **8.35:1** | AA |
| `--point`(dark) on `--base`(dark) — 텍스트/링크 | **6.92:1** | AA 통과 — 다크 모드는 로즈를 텍스트로 직접 써도 됨 |
| `--on-point`(=ink light) on `--point`(dark) 채움 | **6.63:1** | AA — 다크 모드 버튼도 잉크색 텍스트 |
| `--gold` on `--base`(dark) | **9.16:1** | AA 통과 — **다크 모드는 골드 원색을 텍스트로 써도 된다**(라이트와 다른 결론이니 주의) |
| `--ink`(dark) on `--point-soft`(dark) 칩 배경 | **12.38:1** | AAA |
| `--danger`(dark `#FF8177`) on `--base`(dark) | **7.6:1** (계산치, 구현 시 재검증) | AA 통과 — 다크 파괴 액션 텍스트 |

**결론 규칙** (컴포넌트 구현 시 강제):
1. 로즈 채움 버튼·칩의 텍스트/아이콘은 항상 `--on-point`(잉크). 흰 글자 금지.
2. 라이트 모드에서 골드는 **텍스트 금지**, 숫자에 골드 의미를 줄 땐 반드시 `--gold-text`. 골드 원색은 아이콘 채움·동전 모티프·얇은 언더라인 등 비텍스트 장식에만.
3. **금액 텍스트는 두 모드 모두 항상 `--gold-text`만 쓴다**(시맨틱 토큰 — 라이트 `#995F00`, 다크에서는 값이 `#F5A623`으로 자동 전환되므로 사용처 코드는 토큰 하나만 알면 된다). `--gold` 원색을 텍스트로 쓰는 것은 **양 모드 모두 금지**(장식·아이콘 전용) — "다크 한정 예외" 같은 조건부 규칙을 두지 않아 하위모델의 오적용을 차단한다.
4. `--point` 원색을 일반 본문 크기 텍스트(16px 이하 regular)로 쓰지 않는다(3.35:1 미달). 링크·강조어는 20px 이상이거나 bold일 때만.
5. 파괴적 액션(삭제 등)의 텍스트/보더는 `--danger`. 로즈를 파괴 의미로 겸용하지 않는다(액션과 파괴가 같은 색이면 ConfirmDialog에서 구분 불가).

---

## 3. 색 토큰 — 다크 매핑 (단순 반전 금지)

다크 배경은 순검정이 아니라 **잉크 계열 틴트**를 쓴다. 포인트/골드는 다크 배경에서 그대로 두면 탁하거나(로즈는 어두운 배경에 묻힘) 과채도로 보이므로 명도·채도를 조정한다.

| 라이트 토큰 | 다크 값 | 조정 근거 |
|---|---|---|
| `--base` | `#16111C` | 잉크(`#1C1622`)보다 더 어둡고 채도 낮은 근흑색. 순검정(#000) 대신 퍼플 틴트 유지 |
| `--surface` | `#221B29` | base보다 살짝 밝혀 카드 elevation 표현(라이트의 surface > base 관계를 다크에서도 유지) |
| `--muted` | `#2A2130` | surface보다 한 단 더 밝은 섹션 워시 |
| `--line` | `#372C3F` | 헤어라인, base 대비 육안 식별 가능한 최소 명도차 |
| `--ink` | `#F5EEF3` | 텍스트. 순백 대신 로즈 빛이 살짝 도는 오프화이트 |
| `--ink-muted` | `#B8A9BC` | 보조 텍스트, 8.35:1 확보 |
| `--point` | `#FF6B9B` | 원색 로즈(`#FF2E74`)를 어두운 배경에서 잘 읽히도록 명도↑·채도 소폭↓(HSL L 59%→68% 방향) |
| `--point-soft` | `#3D2333` | 칩 배경. 어두운 배경에서 "옅은 배지"는 밝히는 대신 톤을 낮춘 딥 로즈로 표현(라이트의 '옅음'을 다크에선 '깊음'으로 반전) |
| `--on-point` | `#1C1622` | 라이트 잉크값 그대로 재사용 — `--point`(dark)가 밝은 파스텔이라 어두운 텍스트가 맞음(§2) |
| `--gold` | `#F5A623` | 원색 유지 — 어두운 배경 위에서 이미 9.16:1로 충분히 밝다 |
| `--gold-text` | `#F5A623` | 다크 모드는 원색=텍스트 안전값이라 별도 진한 변형 불필요(라이트만 별도 값 필요) |
| `--danger` | `#FF8177` | 어두운 배경에서 읽히도록 명도 올린 경고 레드(라이트 `#C43A3A`의 다크 대응) |

전환 메커니즘: `prefers-color-scheme: dark` 미디어쿼리를 기본값으로 두고, `:root[data-theme="dark"]` / `:root[data-theme="light"]`가 사용자 토글로 이를 오버라이드(둘 다 반드시 동작 — Phase 1 완료조건).

```css
:root {
  --base: #FDF6F9; --surface: #FFFFFF; --muted: #FBEFF3; --line: #F0DCE4;
  --ink: #1C1622; --ink-muted: #6B5D6E;
  --point: #FF2E74; --point-soft: #FFE7F0; --on-point: #1C1622;
  --gold: #F5A623; --gold-text: #995F00; --danger: #C43A3A;
}
@media (prefers-color-scheme: dark) {
  :root {
    --base: #16111C; --surface: #221B29; --muted: #2A2130; --line: #372C3F;
    --ink: #F5EEF3; --ink-muted: #B8A9BC;
    --point: #FF6B9B; --point-soft: #3D2333; --on-point: #1C1622;
    --gold: #F5A623; --gold-text: #F5A623; --danger: #FF8177;
  }
}
:root[data-theme="light"] { /* 라이트 표 값으로 명시 재선언 — prefers-color-scheme 무시하고 강제 */ }
:root[data-theme="dark"]  { /* 다크 표 값으로 명시 재선언 */ }
```

---

## 4. 타입 스케일

**고정 스케일(px)**: `12 / 14 / 16 / 20 / 28 / 40`. 새 크기 추가 금지 — 필요하면 이 표를 먼저 고친다.

| 토큰 | 크기 | 줄간격 | 용도 |
|---|---|---|---|
| `--text-caption` | 12px | 16px (1.33) | 타임스탬프·메타정보·시리얼 보조 라벨 |
| `--text-body-sm` | 14px | 20px (1.43) | 보조 텍스트, SongRow 아티스트명, 칩 라벨 |
| `--text-body` | 16px | 24px (1.5) | 기본 본문, 인풋, 버튼 라벨 |
| `--text-title` | 20px | 28px (1.4) | 화면/섹션 제목, 카드 헤더 |
| `--text-display` | 28px | 34px (1.21) | 티켓 제목, 큰 라벨(곡수·시간 등 부제 숫자) |
| `--text-huge` | 40px | 44px (1.1) | **계산 결과 큰 숫자**(1인당 금액 등) — 화면당 위계 최상위, 시각적 주인공 |

한 화면의 텍스트 위계는 **3단계 이하**로 제한(예: huge/title/body, 또는 display/body/caption). BUILD_PLAN §14 퀄리티 바 요건.

**폰트 스택**:
- UI(한글/영문): Pretendard — **npm 패키지로 self-host**(`@pretendard/pretendard` 등), 외부 CDN 요청 0. `font-display: swap`.
- 모노(번호·시리얼·금액 전용): 시스템 모노 스택 `ui-monospace, "SF Mono", "Cascadia Code", "Segoe UI Mono", Consolas, monospace` — 웹폰트 다운로드 없음.
- 큰 숫자(계산 결과, 시리얼, TJ/KY 번호)는 항상 모노 + `font-variant-numeric: tabular-nums` — 자릿수 변할 때 흔들림 방지(카운트업 애니메이션 전제조건).

```css
--font-sans: "Pretendard Variable", Pretendard, -apple-system, sans-serif;
--font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Segoe UI Mono", Consolas, monospace;
```

---

## 5. 스페이싱 · 라운드 · 그림자

**스페이싱(8pt 그리드, px)**: `4 / 8 / 12 / 16 / 24 / 32 / 48` → `--space-1`부터 `--space-7`(4,8,12,16,24,32,48). 이 스케일 밖 임의값(예: 10px, 18px) 금지 — 여백 리듬이 BUILD_PLAN §14 필수 요건.

| 토큰 | 값 |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 24px |
| `--space-6` | 32px |
| `--space-7` | 48px |

**라운드**:

| 토큰 | 값 | 용도 |
|---|---|---|
| `--radius-sm` | 8px | Chip, 작은 배지, PriceInput |
| `--radius-md` | 16px | 카드, BottomSheet 상단, SongRow |
| `--radius-lg` | 24px | TicketCard, 큰 모달 |
| `--radius-full` | 9999px | Button(pill), Avatar, 원형 아이콘 버튼 |

라운드 남발 금지 — 리스트 행(SongRow)처럼 촘촘히 반복되는 요소는 `--radius-sm`~`md`로 절제, 히어로급(TicketCard)만 `--radius-lg`.

**그림자(3단)**:

| 토큰 | 값 | 용도 |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(28,22,34,0.06)` | 리스트 행, 인풋 포커스 링 보조 |
| `--shadow-md` | `0 4px 16px rgba(28,22,34,0.10)` | 카드, 떠 있는 CTA |
| `--shadow-lg` | `0 12px 32px rgba(28,22,34,0.16)` | BottomSheet, TicketCard, 팝오버 |

다크 모드는 그림자 알파를 그대로 쓰되(잉크색 기반이라 다크 배경에서도 자연스러움), 필요 시 `--shadow-*-dark`로 알파를 0.4~0.5로 올려 대비 확보(어두운 배경 위 어두운 그림자는 안 보이므로) — 정확한 값은 구현 중 육안 조정, 원칙은 "다크에서 그림자보다 `--line` 보더가 경계 표현의 1차 수단"임을 우선한다.

---

## 6. 모션 토큰

**Duration(3단)**:

| 토큰 | 값 | 용도 |
|---|---|---|
| `--duration-fast` | 120ms | 버튼 프레스, 카운트 뱃지 팝, hover/focus 전환 |
| `--duration-base` | 220ms | 페이지/탭 전환, 숫자 카운트업 스텝, BottomSheet 열림 |
| `--duration-slow` | 360ms | 티켓 발권(슬라이드업+정착) |

**Easing**:

| 토큰 | 값 | 용도 |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.22, 1, 0.36, 1)` | 등장·전환(ease-out 계열, "쭉 나왔다 사뿐히 멈춤") |
| `--ease-standard-in` | `cubic-bezier(0.64, 0, 0.78, 0)` | 퇴장(모달 닫힘 등) |
| `--spring-snappy` | stiffness 500 / damping 30 / mass 1 | 곡 담기(짧고 탄력 있게) |
| `--spring-soft` | stiffness 300 / damping 26 / mass 1 | 티켓 발권(무게감 있게 정착) |

**`prefers-reduced-motion` 전역 규칙**: 사용자가 이를 켜면 —
- 모든 spring/transform 이동 애니메이션 → **즉시 최종 상태로 스냅**(트랜지션 없음).
- fade류(opacity)만 `--duration-fast`로 유지(진행 중임을 최소한으로 알림).
- 자동 반복·자동 재생 모션(있다면) 전부 중단.

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

> 위 CSS는 **최후 안전망**이다(전부 즉시 스냅). "fade만 `--duration-fast`로 유지"하는 세밀한 대체는 JS(Framer Motion)의 `useReducedMotion` 분기에서 구현한다 — CSS 안전망과 충돌하지 않게 JS 모션은 CSS transition이 아닌 라이브러리 제어로 동작.

**마이크로인터랙션 4곳 — 토큰 배정** (트리거 상세는 COMPONENTS.md 각 컴포넌트의 "모션" 필드가 정본):

| 인터랙션 | 토큰 | 애니메이션 속성 |
|---|---|---|
| 곡 담기(Button/SongRow) | `--spring-snappy` + 카운트 뱃지 `--duration-fast` | `transform: scale`, `opacity` |
| 계산 결과 숫자 카운트업 | `--duration-base`, `--ease-standard` | 텍스트 콘텐츠(JS 보간, CSS 애니메이션 아님) |
| 티켓 발권 | `--spring-soft` + `--duration-slow` | `transform: translateY`, `rotate`(절취 흔들림), `opacity` |
| 페이지/탭 전환 | `--duration-base`, `--ease-standard` | `opacity`, `transform: translateX/Y`(8px 이내) |

**금지**: `width`/`height`/`top`/`left` 애니메이션(리플로우 유발) — `transform`/`opacity`만 애니메이션 대상. ONESHOT Phase 6 완료조건의 grep 검사(`animate.*(width|height|top|left)`) 대상.

---

## 7. 브레이크포인트 · 레이아웃

**확정**: 모바일 퍼스트 단일 컬럼. **480px 이상은 중앙 정렬 `max-width: 448px` 앱 프레임.** 데스크톱 전용 레이아웃(사이드바, 멀티컬럼)은 만들지 않는다.

```css
.app-frame {
  max-width: 448px;
  margin-inline: auto;
  min-height: 100dvh;
  background: var(--base);
  box-shadow: var(--shadow-lg); /* 480px+ 에서만 프레임 경계를 드러냄 */
}
@media (min-width: 480px) {
  body { background: var(--muted); } /* 프레임 밖: base보다 한 톤 다른 중립, 그라디언트 금지 */
}
```

- **프레임 밖 배경**(480px+ 뷰포트에서 448px 프레임 좌우 여백): `--muted` 단색. 그라디언트·패턴 이미지 금지(AI 디폴트룩 회피, §8).
- **세이프에어리어**: 상단 노치·하단 홈 인디케이터 대응 `env(safe-area-inset-*)`를 앱 프레임의 최상위 패딩에 적용. TabBar/하단 고정 CTA는 `padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom))`.
- **엄지 도달권**: 1차 CTA(담기 확정, 계산 결과 확인, 공유하기)는 화면 하단 고정 영역에 배치. 상단 앱바에 파괴적/1차 액션을 두지 않는다.
- **터치 타깃**: 모든 인터랙티브 요소 최소 44×44px(패딩 포함, 시각적 크기가 작아도 히트 영역은 44px 확보).

---

## 8. 아이콘 규칙

- **인라인 SVG만.** 아이콘 폰트·외부 아이콘 CDN 금지(외부 웹폰트 요청 0 원칙과 동일 이유).
- **24×24 그리드**(`viewBox="0 0 24 24"`), 실제 획은 그리드 내 2px 여백을 둔 20×20 안전영역에.
- **stroke 폭 1.75px**, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none" stroke="currentColor"` — 색은 부모의 `color`를 상속(토큰으로 제어, 아이콘 자체에 색 하드코딩 금지).
- 상태 표현이 필요한 아이콘(예: 히스토리 마크 별표)만 `fill="currentColor"` 채움 변형을 별도로 둔다(윤곽선 버전과 1:1 쌍).
- **명명 규칙**: `icon-{name}.svg`, kebab-case, 동사보다 명사(예: `icon-search.svg`, `icon-mic.svg`, `icon-ticket.svg`, `icon-share.svg`). PWA 아이콘·로고는 Phase 7(에셋)에서 별도 생성, 이 표는 UI 인라인 아이콘 전용.

---

## 9. 금지사항 (전 화면 공통)

- **AI 디폴트룩**: 보라→파랑 그라디언트, 카드 전부 중앙정렬, rounded-full 남발(버튼 외 과사용), 크림+테라코타 배색, 은은한 블러 배경 남용.
- **hex 하드코딩**: 컴포넌트/화면 코드에 `#`로 시작하는 색상 리터럴 금지. 전부 `var(--token)`.
- **이모지 남발**: 마이크로카피에 이모지는 MICROCOPY.md 규칙을 따르는 극소수 지점만(예: 예시 "90분이면 24곡 딱이야 🎤" 수준) — 아이콘 대체 목적의 이모지 사용 금지.
- **골드의 금액 외 사용**: `--gold`/`--gold-text`는 코인·금액·1인당 정산 숫자 전용 의미색이다. 다른 강조(예: "인기" 배지, 일반 알림)에 골드를 쓰지 않는다 — 로즈(`--point`)가 범용 강조, 골드는 "돈" 의미 고정.
- **로즈 채움 위 흰 글자**(§2에서 3.56:1로 AA 미달 확인됨) — `--on-point` 사용.
- **라이트 모드에서 `--gold` 원색을 텍스트로** — `--gold-text` 사용.

---

## 고찰

1. **`--gold` 라이트 텍스트 금지는 PRODUCT_SPEC의 암묵 전제를 뒤집는 결정이다.** PRODUCT_SPEC §14/BUILD_PLAN §14는 "골드는 대형 금액 숫자(large text 3:1)에 써도 된다"는 뉘앙스였지만, 실측 대비율이 1.90:1로 3:1에도 못 미쳐 그대로 채택하면 실제 기기에서 접근성 실패가 확정적이다. 대안(A. 골드를 아예 안 씀, B. 배경을 어둡게 바꿈, C. 텍스트 전용 진한 골드 파생)을 검토했고, PRODUCT_SPEC이 정의한 베이스 5색과 무드("밝은 미니멀")를 지키면서 문제를 푸는 C를 택했다.
2. **로즈 버튼 텍스트를 흰색 대신 잉크색으로 결정.** 프로덕트 무드보드가 명시하진 않았지만 실측상 흰 글자는 3.56:1로 미달, 잉크 글자는 5.00:1로 통과한다. `--point-strong` 같은 진한 로즈 파생을 새로 만들어 흰 글자를 유지하는 대안도 검토했으나, 토큰 수를 늘리지 않고 라이트·다크 모드 모두에서 동일 규칙(`--on-point`=잉크)으로 통일할 수 있어 이쪽을 택함 — 다크 모드 `--point`(파스텔 로즈)에서도 잉크 텍스트가 6.63:1로 잘 맞아떨어졌다.
3. **다크 배경을 순검정이 아니라 잉크 틴트로.** 순검정(#000)은 로즈·골드의 채도를 인위적으로 과장시켜 보이고(동시대비 착시) 브랜드 톤("퍼플 바이어스 잉크")과 어긋난다. `#16111C`는 `--ink`(#1C1622)보다 더 어둡지만 같은 색 계열이라 라이트/다크가 "같은 세계관"으로 읽힌다.
4. **앱 프레임 밖 배경을 그라디언트가 아닌 단색(`--muted`)으로.** 데스크톱에서 448px 프레임 밖 여백을 화려하게 채우고 싶은 유혹이 있으나, BUILD_PLAN §14가 그라디언트를 명시 금지 사례로 든다. 단색 + 프레임 그림자만으로 "이 앱은 모바일 카드"임을 표현.
5. **타입 스케일에 "본문 굵기(400/600/700)" 축을 이 문서가 아니라 COMPONENTS.md 각 컴포넌트 필드로 넘김.** DESIGN_SYSTEM은 크기·용도까지만 정본으로 두고, 어떤 컴포넌트가 몇 굵기를 쓰는지는 컴포넌트별 판단이라 COMPONENTS.md(§props/상태) 소관으로 분리했다 — 정본 경계를 크기(이 문서)와 적용(COMPONENTS.md)으로 나눈 것.
6. **모션 스프링 파라미터를 Framer Motion 값(stiffness/damping/mass)으로 명시.** ONESHOT_MASTER 스택 요약에 Framer Motion이 있어(BUILD_PLAN §2 표에는 누락되어 있음 — 불일치 가능성, §미결 참조) 그 라이브러리 관례에 맞는 파라미터 형태로 토큰화했다. CSS `cubic-bezier` easing과 병기해 라이브러리 미도입 시에도 근사 대체가 가능하게 함.

## 검증 체크리스트

- [ ] `globals.css`의 CSS 변수 값이 본 문서 §1·§3 표와 **문자열 그대로 일치**(색상 코드 대소문자·자릿수까지)하는지 diff.
- [ ] 라이트/다크 각각 데모 페이지 스크린샷에서 §2 표의 6개 핵심 조합(ink/base, point/base, on-point/point, gold-text/base, dark 대응 3개)을 실제로 대비 측정 도구(예: 브라우저 devtools contrast checker)로 재확인 — 문서 수치와 ±0.1 이내 일치.
- [ ] `grep -rn "#[0-9A-Fa-f]\{3,6\}"` 를 `app/`·`components/` 소스에 실행 — DESIGN_SYSTEM.md·COMPONENTS.md·globals.css(변수 정의부) 외 매치 0건.
- [ ] 타입 스케일 사용처 grep(`text-[0-9]`류 유틸)이 12/14/16/20/28/40 외 값 0건.
- [ ] 8pt 그리드 밖 spacing 유틸(예: `p-[10px]`) 0건.
- [ ] `prefers-reduced-motion: reduce` 켠 상태에서 4개 마이크로인터랙션 모두 즉시 스냅/페이드로 대체되는지 수동 확인(녹화).
- [ ] 448px 프레임이 480px 미만에서는 풀블리드, 이상에서는 중앙 정렬 + `--muted` 배경인지 두 뷰포트 스크린샷으로 확인.

## 미결

- ~~BUILD_PLAN §2 스택 표에 Framer Motion 부재~~ → **해소(v1.0 리뷰)**: BUILD_PLAN v1.3 §2에 Framer Motion이 정식 편입됨. 모션 토큰은 Framer 파라미터+CSS cubic-bezier 병기 유지.
- `--shadow-*-dark`의 정확한 알파값은 **실측 필요**(다크 배경에서 육안 조정 후 확정) — 이 문서는 원칙(`--line` 우선)만 제시.
- Pretendard self-host 패키지의 정확한 npm 패키지명·버전(`@pretendard/pretendard` 등 후보)은 **확인 필요** — Phase 1 구현 시 최신 배포 방식(서브셋 woff2 vs variable font 용량) 확인 후 확정.
- ~~골드 다크 텍스트 정책~~ → **해소(v1.0 리뷰)**: §2 규칙 3으로 확정 — 금액 텍스트는 항상 `--gold-text`(모드별 값), `--gold` 텍스트 사용은 양 모드 금지.
- `--danger` 다크 값(`#FF8177`)의 대비 계산치는 **구현 시 재검증**(§2 표에 계산치로 표기).
