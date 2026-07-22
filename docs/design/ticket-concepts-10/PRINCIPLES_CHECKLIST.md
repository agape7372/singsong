# 폐기된 티켓 시안 자가체크 기록

> **REFERENCE ONLY — 이 문서는 정본 준수 증빙이 아닙니다.**  
> 티켓 전용 원칙을 잘못 적용한 항목이 확인되어 구현·승인 판단에 사용할 수 없습니다. HTML 비교 과정의 오류 기록으로만 남깁니다.

## 적용 우선순위

1. [`../../FINAL_BLUEPRINT.md`](../../FINAL_BLUEPRINT.md)
2. [`../VISUAL_MOTION_DIRECTION.md`](../VISUAL_MOTION_DIRECTION.md)
3. [`../concepts-10/ADOPTION.md`](../concepts-10/ADOPTION.md)
4. `SCREENS.md`, `COMPONENTS.md`, `DESIGN_SYSTEM.md`에서 상위 정본과 충돌하지 않는 세부

## 레거시 충돌 처리

| 레거시 표현 | 이번 시안의 처리 |
|---|---|
| `/ticket/[id]` | 정본 라우트 `/ticket` 기준 |
| 자유 리스트 제목 | `fixedTitleKey: ticket.defaultTitle`; 비교용 고정 문자열만 사용 |
| 단일 시간·금액 | low/high 범위와 `약` 유지 |
| `role="img"` TicketCard | `<article>` + heading + `<dl>` |
| 카톡 전용 CTA | 티켓 artwork에서 제외; 화면 구현 시 OS 공유 우선 |
| 전체 곡 목록 포함 | 제외; 전체 ledger는 `/s/[slug]` HTML 책임 |
| 다크 export | PNG는 항상 canonical light |
| 랜덤 바코드 | 동일 `artworkSeed` 기반 24개 deterministic bars |

## 공통 artifact 계약

- [x] 540×675 CSS px renderer
- [x] 2× 캡처 시 1080×1350 PNG
- [x] 출력 기준 바깥 safe area 64px
- [x] white paper + CUTLINE cream canvas
- [x] 고정 제목, 곡수, 시간 범위, 총액 범위, 1인당 범위, 인원
- [x] `pricingMode=time`, 30분당 10,000원
- [x] `coverageBps=0`을 `길이 데이터 0%`로 명시
- [x] 계산 가정과 1인당 원 단위 올림 명시
- [x] 발권일과 결정적 serial 표시
- [x] 동일한 `artworkSeed` 사용
- [x] 절취선 1회와 16px 반원 타공 한 쌍
- [x] private PNG 상태라 QR 없음
- [x] 외부 이미지·앨범아트 요청 0개

## 형태·색·접근성

- [x] TicketCard는 하나의 강한 surface
- [x] 제목 좌측 정렬, 수치는 tabular/mono
- [x] 한글 라벨과 제목 전체를 mono로 만들지 않음
- [x] 티켓 radius 20px
- [x] 로즈는 registration mark·큰 표식에만 제한
- [x] 작은 금액 텍스트는 접근성 안전값 `#995F00`
- [x] 바코드·타공은 `aria-hidden`
- [x] 모든 티켓에 heading과 description list 존재
- [x] `prefers-reduced-motion` fallback 포함

## 금지 패턴 검사

- [x] gradient 없음
- [x] glass·blur·glow·neon·3D·종이 texture 없음
- [x] 독립 rounded card 더미 없음
- [x] 음표·마이크·헤드폰·재생 아이콘 없음
- [x] album art·외부 이미지 없음
- [x] 단일 확정 시간·금액 없음
- [x] 공개 URL 없는 QR 없음
- [x] `Math.random()` 없음
- [x] 전체 곡목록 없음

## 시안별 변주 범위

| 번호 | 변주한 요소 | 고정한 요소 |
|---:|---|---|
| 01 | 1인당 금액 위계 | 데이터·색·절취선·serial |
| 02 | numbered ledger | 데이터·색·절취선·serial |
| 03 | 좌측 registration rail | 데이터·색·절취선·serial |
| 04 | 2×2 rule grid | 데이터·색·절취선·serial |
| 05 | 상단 ink cap | 데이터·light paper·절취선·serial |
| 06 | 곡수 typographic hero | 데이터·색·절취선·serial |
| 07 | 하단 stub 비율 | 데이터·색·절취선·serial |
| 08 | 2×3 manifest | 데이터·색·절취선·serial |
| 09 | 여백 밀도 | 데이터·색·절취선·serial |
| 10 | 계획/정산 58:42 | 데이터·색·절취선·serial |

## 구현 전 남은 결정

- `ticket.defaultTitle`의 실제 한국어 문구
- PNG 파일명의 실제 시간대 처리
- 실기기에서 200% text resize와 400% zoom 검증
- public URL 발행 뒤 실제 QR 크기·quiet zone·카메라 스캔 검증
