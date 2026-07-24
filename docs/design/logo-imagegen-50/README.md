# SingSong app-logo decision and shortlist

50개 생성 탐색안 가운데 사용자가 고른 8개를 최종 후보로 분리했다. 나머지 42개는 삭제하지 않고 `html/` 아래에 참고용 아카이브로 보존한다.

## 현재 적용안 — Folded Session S

2026-07-23 현재 앱 헤더와 설치 아이콘에는 **Folded Session S**를 적용한다.

- 탐색 원본: [`final/01-folded-session-s.png`](./final/01-folded-session-s.png)
- production SVG master: [`public/icons/icon.svg`](../../../public/icons/icon.svg)
- PWA/헤더: [`folded-session-s-192.png`](../../../public/icons/folded-session-s-192.png), [`folded-session-s-512.png`](../../../public/icons/folded-session-s-512.png)
- Apple touch: [`folded-session-s-180.png`](../../../public/icons/folded-session-s-180.png)

탐색 PNG를 그대로 출하하지 않고, cream canvas 위의 rose 상·하단 fold, black diagonal middle span, 두 registration hole을 제어된 SVG 기하로 다시 그렸다. manifest·metadata·헤더는 cache-busting 이름의 raster를 사용하고, 기존 `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`는 이미 설치된 클라이언트 호환 alias로 유지한다.

## 선정 당시 최종 후보 8안

요청 순서를 유지한다.

1. `39-matched-tear.png` — Matched Tear
2. `33-bridge-pass.png` — Bridge Pass
3. `17-folded-receipt.png` — Folded Receipt
4. `13-double-gate.png` — Double Gate
5. `10-seal-cut-s.png` — Seal Cut S
6. `08-corner-fold-s.png` — Corner Fold S
7. `04-twin-stub-negative-s.png` — Twin Stub Negative S
8. `01-folded-session-s.png` — Folded Session S

모든 후보 원본은 `final/`에 있다. 01번만 현재 production master로 재작도했으며, 나머지 7개는 대안 후보 기록으로 유지한다. 단색·24px 파생본과 상표 유사성·최종 브랜드 승인은 별도 출시 게이트다.

## 보기

- `index.html`: 최종 후보 8안 비교 보드
- `logo-finalists-sheet.png`: 최종 후보 보드의 정적 캡처
- `final/`: 최종 후보 PNG 8개
- `html/index.html`: 제외된 42안의 참고용 비교 보드
- `html/logo-reference-sheet.png`: 참고용 보드의 정적 캡처
- `html/index-all-50-archive.html`: 분류 전 전체 50안 HTML 아카이브
- `html/logo-contact-sheet-all-50-archive.png`: 분류 전 전체 50안 정적 아카이브
- `PROMPTS.md`: 공통 제작 조건과 50개 콘셉트 modifier
- `rejected/`: 품질 검수 과정에서 교체된 초안

## 공통 기준

- production palette: cream `#FAF7F0`, ink `#15131A`, action rose `#FF3D6E`, restrained ochre `#B76E00`
- 1:1 정사각형, 중앙 66% maskable 안전영역, 24px 축소 가독성
- 한 안에서 하나의 심볼, 최대 세 가지 mark 색
- 마이크, 음표, 헤드폰, 재생 버튼, 파형, 네온, 3D, 워드마크 배제
- 티켓은 앱 전체 의미가 아니라 `계획 → 확정`을 설명하는 보조 문법

## 보드 재생성 및 검증

```powershell
node docs/design/logo-imagegen-50/build-board.mjs
node docs/design/logo-imagegen-50/validate-assets.mjs
```

`build-board.mjs`는 최종 8안과 참고 42안의 위치가 정확한지 먼저 확인한 뒤 두 HTML 보드를 만든다. `validate-assets.mjs`는 폴더별 개수, 선택 번호, PNG 형식, 정사각 해상도와 파일 해시 고유성을 확인한다.
