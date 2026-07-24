# 싱송 docs — v3 문서 지도

> **현재 상태**: local fixture 앱 구현·검증 완료, production 출시는 외부 gate로 차단. 실행 상태는 [`../RUN_STATE.md`](../RUN_STATE.md), 검증은 [`../VERIFICATION_REPORT.md`](../VERIFICATION_REPORT.md)를 따른다.
> **최종 설계 버전**: v3.2 · 2026-07-21
> **현재 운영 시작점**: [`../README.md`](../README.md)와 [`../HANDOFF.md`](../HANDOFF.md). [`prompts/ONESHOT_MASTER.md`](./prompts/ONESHOT_MASTER.md)는 구현 계약 기록이다.

---

## 1. 먼저 읽을 다섯 문서

### 구현자

1. [`FINAL_BLUEPRINT.md`](./FINAL_BLUEPRINT.md) — 제품·계산·보안·PWA·출시의 최상위 계약
2. [`UNKNOWN_REGISTER.md`](./UNKNOWN_REGISTER.md) — 구현 전에 잠글 것과 실제 실험으로 남길 것
3. [`design/VISUAL_MOTION_DIRECTION.md`](./design/VISUAL_MOTION_DIRECTION.md) — Session Strip 시각·모션 정본
4. [`CODEX_FINAL_REVIEW.md`](./CODEX_FINAL_REVIEW.md) — 기존 Fable/Opus 안을 변경한 이유와 논쟁 기록
5. [`prompts/ONESHOT_MASTER.md`](./prompts/ONESHOT_MASTER.md) — 원샷 v3.2 실행 지시

### 사람 리뷰어

`CODEX_FINAL_REVIEW` → `FINAL_BLUEPRINT` → `UNKNOWN_REGISTER` → `VISUAL_MOTION_DIRECTION` → 원샷 v3 순으로 읽으면 결정 이유부터 실행안까지 자연스럽게 이어진다.

---

## 2. 정본 우선순위

```text
FINAL_BLUEPRINT
  > ONESHOT_MASTER v3.2
  > VISUAL_MOTION_DIRECTION
  > 도메인별 기존 정본
  > 나머지 레거시 요약·이력
```

기존 문서가 더 상세해도 v3와 충돌하면 v3가 이긴다. 특히 다음 레거시 조항은 폐기됐다.

- `songs`/`shared_lists` public table `using(true)`와 browser direct CRUD.
- indexable `/s/[slug]`, 영구 공유, revoke 없음.
- memo/myKey/tags/device UUID 공유와 `fork_count`.
- 평균 묶음 단가 역계산, 표시용 반올림 뒤 block billing.
- iTunes album art/duration.
- Kakao WebView/Safari/설치 PWA IndexedDB 자동 연속성 가정.
- Node 20, Next 15 고정, `framer-motion` import, Lighthouse PWA badge.
- 멀티리스트·히스토리·**스트리밍 플레이리스트 import**를 P0로 취급하는 범위. P0의 `/import`는 별개인 **공유 스냅샷 가져오기/handoff**다.

---

## 3. 문서 트리

```text
docs/
  README.md
  FINAL_BLUEPRINT.md          ← 최상위 구현 정본
  CODEX_FINAL_REVIEW.md       ← 독립 심사·논쟁·결정 이유
  UNKNOWN_REGISTER.md         ← 숨은 unknown과 검증 큐
  PRODUCT_SPEC.md             ← 레거시 제품 정본/시장·장기 로드맵 참고
  BUILD_PLAN.md               ← 레거시 M0~M6/계산 이력; v3 충돌 조항 구현 금지
  design/
    VISUAL_MOTION_DIRECTION.md ← Session Strip 최종 방향
    logo-imagegen-50/
      README.md                ← 최종 후보 8안과 현재 적용한 Folded Session S
    DESIGN_SYSTEM.md           레거시 토큰·대비 근거
    COMPONENTS.md              레거시 컴포넌트 계약
    SCREENS.md                 레거시 6화면 상세
    UX_FLOWS.md                레거시 여정·복구
    MICROCOPY.md               톤·표기 참고
    assets/
      README.md                          reference-only 사용·hash·금지요소
      session-strip-concept-board.png  reference-only
      ticket-issue-storyboard.png      reference-only
  engineering/
    ARCHITECTURE.md
    API_CONTRACT.md
    SECURITY.md
    ANALYTICS.md
    PLATFORM_NOTES.md
  verification/
    QA_MATRIX.md
    TEST_PLAN.md
  prompts/
    ONESHOT_MASTER.md          ← v3 원샷 실행 지시
```

기존 engineering/design/verification 문서는 상세 엣지와 테스트 아이디어를 보존한다. 그러나 public RLS, payload, 계산, PWA 저장소, 런타임, MVP 범위는 `FINAL_BLUEPRINT`가 교정한 상태다.

---

## 4. 사실별 소유권

| 사실 | 현재 정본 | 레거시 참고 |
|---|---|---|
| P0 사용자·JTBD·범위·route | `FINAL_BLUEPRINT` §1~§3 | `PRODUCT_SPEC`, `SCREENS`, `UX_FLOWS` |
| 계산 함수·범위·역계산·테스트 불변식 | `FINAL_BLUEPRINT` §4 | `BUILD_PLAN` §6은 negative reference |
| 검색 normalization·catalog gate | `FINAL_BLUEPRINT` §5 | `API_CONTRACT`, `PLATFORM_NOTES` |
| 공유 공개성·payload·API·rate limit·revoke | `FINAL_BLUEPRINT` §6 | `SECURITY`, `API_CONTRACT` |
| 기술 스택·상태 소유권·PWA | `FINAL_BLUEPRINT` §7 | `ARCHITECTURE`, `PLATFORM_NOTES` |
| 디자인·토큰·화면 composition·모션 | `VISUAL_MOTION_DIRECTION` | 기존 design 문서 |
| 앱 로고 현재 적용안·파생 asset | `design/logo-imagegen-50/README` | 이전 logo 탐색 폴더 |
| 분석 의미·제품 검증 | `FINAL_BLUEPRINT` §9 + `UNKNOWN_REGISTER` | `ANALYTICS` |
| 출시 상태·자동/실기기 gate | `FINAL_BLUEPRINT` §10 | `QA_MATRIX`, `TEST_PLAN` |
| 구현 순서·증거·handoff | `ONESHOT_MASTER` v3 | `BUILD_PLAN` §11, 원샷 v2 폐기 |
| 미해결 가설·실험 통과기준 | `UNKNOWN_REGISTER` | 기존 문서의 열린 질문 |

---

## 5. 원샷 v3 Stage와 레거시 매핑

| v3 Stage | 사용자 가치 | 레거시 대응 |
|---|---|---|
| 0 | 안전한 preflight·계약 동결 | 구 Phase 0 이전에 신설 |
| 1 | 기반·토큰·accessible primitive | 구 Phase 0~1 일부 |
| 2 | 로컬 플랜·직접 추가·Session Strip | 구 Phase 3 일부 |
| 3 | 검색·IME·담기 | 구 Phase 2~3 |
| 4 | 정확 계산·불확실성 | 구 Phase 4 교정 |
| 5 | semantic ticket·PNG·모션 | 구 Phase 5~7 일부 |
| 6 | 안전한 공유·철회 | 구 Phase 2+5 전면 교정 |
| 7 | 가져오기·브라우저 handoff | 구 Phase 5 + 누락 영역 |
| 8 | PWA·오프라인·업데이트 | 구 Phase 9 교정 |
| 9 | 분석·운영·통합·독립 감사 | 구 Phase 8~8.5 확장 |
| 10 | 정직한 readiness·handoff | 구 Phase 10 확장 |

v3는 컴포넌트/백엔드/모션/a11y를 수평으로 끝낸 뒤 조립하지 않는다. 각 사용자 여정을 vertical slice로 만들면서 접근성·모션·오류·테스트를 함께 완료한다.

---

## 6. 생성 이미지 취급

`design/assets`의 PNG 두 장은 Codex 이미지 생성으로 만든 내부 레퍼런스다.

- 방향·구도·물성·모션 토론에 사용한다.
- 실제 UI, 로고, 아이콘, 글자, 숫자판을 이미지에서 잘라 출하하지 않는다.
- 이미지 속 영문·탭 수·컴포넌트는 정본이 아니다. 오직 색·종이 물성·ledger 밀도·strip→ticket 관계만 참고한다. route/tab, 별도 계산 화면, 숫자·가격·시간, copy/CTA, punch, 재생 삼각형, share 버튼은 복사하지 않는다.
- 프로덕션은 `VISUAL_MOTION_DIRECTION`을 따라 semantic HTML, CSS, 직접 검수한 SVG로 재구성한다.

로고 탐색 PNG 50개도 같은 reference-only 원칙을 따른다. 현재 적용안 Folded Session S는 생성 PNG를 그대로 쓰지 않고 `public/icons/icon.svg`의 제어된 기하와 versioned raster로 재작도했으며, 결정·후보·archive 위치는 [`design/logo-imagegen-50/README.md`](./design/logo-imagegen-50/README.md)가 소유한다.

---

## 7. 구현 중 문서 규칙

1. 새 구현 결정을 `DECISIONS_LOG.md`에 남기되 보안·공개범위·금액·법무·외부 비용은 보수적 추측으로 넘기지 않는다.
2. 요구에는 `REQ-*` ID를 주고 코드·테스트·증거를 `REQUIREMENTS_TRACE.md`로 연결한다.
3. 실행하지 않은 검증은 `PASS`가 아니다. `testResult`, `evidenceLevel`, `blockerKind`, `featureDisposition`을 분리한다.
4. fixture와 release profile을 분리한다. 실제 데이터 권리가 없으면 `buildCapability=LOCAL_DEMO_READY`, `productionGate=BLOCKED`까지만 선언한다.
5. 기존 문서와 v3 충돌은 `CONFLICT_REGISTER.md`에 남긴다. 레거시를 조용히 복구하지 않는다.
6. 문서 정정이 필요하면 최상위 소유 파일 한 곳을 먼저 고치고 링크만 갱신한다.

---

## 8. 현재 가장 중요한 네 질문

1. 합법적이고 품질이 검증된 TJ/KY 카탈로그를 어디서 확보하는가?
2. 실제 iOS/Kakao/설치 PWA에서 링크를 어느 저장소로 어떻게 가져오는가?
3. 사용자는 실제 모임 전에 가격을 입력하고 시간 범위를 신뢰하는가?
4. 읽기 전용 티켓+fork가 충분한가, 친구의 곡 제안이 필요한가?

답을 사실처럼 채우지 말고 [`UNKNOWN_REGISTER.md`](./UNKNOWN_REGISTER.md)의 검증 큐로 관리한다.
