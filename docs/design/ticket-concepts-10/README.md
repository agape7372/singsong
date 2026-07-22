# SingSong CUTLINE 티켓 시안 10종

> **상태: REFERENCE ONLY / 비정본 / 구현 금지**  
> 초기 비교 과정의 HTML 보관본입니다. 프로덕션 시안이나 디자인 원칙 준수 증빙으로 사용하지 않습니다.

초기 `CUTLINE` 배치 실험에서 정보의 읽는 순서를 달리했던 10개 시안을 기록으로 보존합니다. 현재 기준 시안은 아닙니다.

## 보기

- `index.html`: 필터·확대 보기가 있는 비교 보드
- `preview.png`: 10개 전체 contact sheet
- `preview-mobile.png`: 500px 협소 화면 비교 보드
- `recommended-ledger-08.png`: 우선 추천안 확대 미리보기
- `exports/ticket-01.png` ~ `ticket-10.png`: 정확히 1080×1350인 개별 export
- `PRINCIPLES_CHECKLIST.md`: 정본 준수 근거와 레거시 충돌 처리

## 공통 fixture

```text
fixedTitleKey: ticket.defaultTitle
비교용 표시: 싱송 SESSION TICKET
artworkSeed: AaBbCcDdEeFfGgHhIiJjKk
곡수: 8곡
예상 시간: 약 20~40분
총액: 약 10,000~20,000원
인원: 4명
1인당: 약 2,500~5,000원
pricingMode: time
요금: 30분당 10,000원
coverageBps: 0
가정: 평균 곡 길이 기준 · 1인당 원 단위 올림
발권일: 2026.07.21
serial: SS-20260721-08
publicUrl: 없음
```

`싱송 SESSION TICKET`은 자유 제목이 아니라 아직 확정되지 않은 `ticket.defaultTitle`을 비교하기 위한 고정 fixture입니다.

## 시안 목록

1. `FARE FIRST` — 1인당 우선
2. `LEDGER 08` — 번호 원장, **우선 추천**
3. `REGISTER RAIL` — 좌측 메타데이터 rail
4. `CROSS CHECK` — 2×2 십자 정산표
5. `INK CAP` — 상단 잉크 실루엣
6. `TYPECASE` — 곡수 타이포 hero
7. `CLAIM STUB` — 하단 소지 스텁
8. `MANIFEST` — 2×3 데이터 원장
9. `QUIET INDEX` — 여백 중심 원장
10. `BALANCE` — 계획/정산 58:42 분할

## 우선 추천

`LEDGER 08`이 Working Strip의 numbered ledger를 가장 직접적으로 이어받아 검색→플랜→티켓의 세계관이 끊기지 않습니다. 실제 선택 전에는 5초 이해도 테스트로 `FARE FIRST`, `LEDGER 08`, `CLAIM STUB` 세 안을 비교하는 것이 좋습니다.

## 기술적 렌더 기록

- 브라우저 self-test는 semantic / decoration / filter / preview / narrow layout의 기계적 동작만 확인했으며 디자인 원칙 준수를 뜻하지 않음
- 개별 export: 10개 모두 1080×1350 확인
- 원본 크기에서 상단 메타 겹침, 금액 우측 잘림, 절취선 충돌을 시각 검수 후 보정
