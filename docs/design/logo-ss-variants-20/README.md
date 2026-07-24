# SingSong `ㅅ × S` logo study

사용자 참고 스케치와 기존 `06-korean-ss-tabs.svg`를 바탕으로, 한글 `ㅅ`의 인지성을 유지하면서 두 자소의 배치가 전체 대문자 `S` 흐름을 만드는 전용 탐색 20안이다.

## 파일

- `index.html`: 20개 SVG, 축소판, 단색 근사판을 한 화면에서 보는 반응형 보드
- `siot-s-contact-sheet.png`: HTML을 1920px 너비로 렌더링한 정적 비교 이미지
- `01-*.svg` ~ `20-*.svg`: 512×512 Figma-importable 원본

## 설계 기준

- 최소 하나의 `ㅅ`은 꼭짓점이 위인 정자세 실루엣으로 유지
- 개별 자소의 회전은 약 25° 이하
- 두 자소의 위치·색·연결이 전체적으로 S의 상단과 하단 곡선을 형성
- 24px에서 핵심 획과 음각이 뭉개지지 않도록 굵은 geometry 사용
- production palette: `#FAF7F0`, `#15131A`, `#FF3D6E`, optional `#B76E00`
- 마이크, 음표, 헤드폰, 재생 삼각형, 그라디언트, 글로우, 3D 배제

모든 SVG는 Figma 캔버스에 직접 드래그해 편집할 수 있다.
