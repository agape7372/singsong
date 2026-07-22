# Generated design references

> **용도**: 내부 디자인 토론·형태/모션 전달용. 프로덕션 bundle·로고·UI asset·접근성 아이콘으로 출하하지 않는다.  
> **정본**: [`../VISUAL_MOTION_DIRECTION.md`](../VISUAL_MOTION_DIRECTION.md). PNG 안의 글자·숫자·구조보다 정본 문서가 항상 우선한다.

## 파일

| 파일 | 크기 | SHA-256 | 참고할 것 |
|---|---:|---|---|
| `session-strip-concept-board.png` | 1672×941 | `1BF6322F4FE5D670FB0B5F0D23F155676C3FA97584B8F5FBC9708DEB314F5290` | paper/ink/accent, SearchInput+Plan Rail, editable plan과 frozen issued/received, strip→ticket 관계 |
| `ticket-issue-storyboard.png` | 1672×941 | `2CAB5AEE6D1880619CA83D0DDFE7B7251233FC5D6FAD40BF2B1B3B23C3FAA71D` | 고정 slot 위로 TicketCard만 상승하는 6-frame 관계, 24px 이하, reduced-motion opacity-only 대안 |

## 복사 금지 요소

- 이미지에 생성된 문구·숫자·가격·시간·버튼 문장.
- 콘셉트 보드의 개별 컴포넌트 치수와 punch 개수. 실제 contract는 2-tab, 홈 안 계산, 범위값, final ticket에만 punch다.
- 스토리보드의 slot/cutout 세부 기하. 실제 motion은 총 translateY 24px 이하, rotation 0.6° 이하, 같은 revision에서 정확히 한 번이다.
- raster 조각을 잘라 만든 로고·아이콘·배경.

실제 제품은 semantic HTML, CSS variables, Base UI primitive, `motion/react`, 사람이 검수한 SVG로 재구성한다. 재생성용 prompt와 acceptance gate는 시각 정본 §10·§12에 있다.
