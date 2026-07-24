# SingSong logo directions v2

SingSong의 현재 제품 문법과 production 팔레트를 기준으로 직접 설계한 벡터 로고 10안이다. 모든 SVG는 외부 자산과 폰트 의존성이 없으며 Figma 캔버스에 그대로 드래그해 편집할 수 있다.

## 보기

- `index.html`: 10개 시안, 32px/20px 축소 확인, 설명을 한 화면에서 비교하는 보드
- `logo-contact-sheet.png`: `index.html`을 Chromium으로 렌더링한 정적 컨택트시트
- `01-*.svg` ~ `10-*.svg`: 512×512 개별 앱 아이콘 원본

## 공통 기준

- production palette: cream `#FAF7F0`, ink `#15131A`, action rose `#FF3D6E`, restrained ochre `#B76E00`
- 핵심 실루엣은 PWA maskable 중앙 66% 안전영역 안에 배치
- 24px에서도 읽히는 굵은 형태와 제한된 내부 디테일
- 단색에서도 의미가 유지되는 구조
- 마이크, 음표, 헤드폰, 재생 삼각형, 네온, 그라디언트, 글로우, 3D 금지
- 티켓은 제품 전체가 아니라 `계획 → 확정`을 설명하는 보조 문법으로 사용

## 우선 검토

1. `01-folded-route-s.svg`: 하나의 실루엣으로 S, 경로, 한 번의 접힘을 가장 안정적으로 전달한다.
2. `08-queue-stack.svg`: Station과 ledger 문맥이 가장 직접적이다.
3. `03-queue-merge-s.svg`: 여러 곡과 사람이 한 플랜으로 합류한다는 의미가 분명하다.

01안의 초기 fold 뒤편에 있던 작은 삼각형은 재생 아이콘으로 오해될 가능성이 있어 최종 탐색본에서 제거했다.

## Figma로 가져오기

1. 원하는 `.svg` 파일을 Figma 캔버스에 드래그한다.
2. 필요하면 `Ungroup`하여 path와 primitive를 편집한다.
3. 최종안은 투명 mark, 한글 기본 lockup, 영문 보조 lockup, maskable icon으로 파생한다.

이 파일들은 탐색 시안이다. 상표·앱스토어 유사성 검토와 최종 브랜드명 승인은 별도 게이트다.
