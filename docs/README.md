# 싱송 docs — 문서 지도 (Index)

> **이 저장소에는 아직 앱 코드가 없다.** 설계·계획·프롬프트만 있다.
> 구현 시작점은 [`prompts/ONESHOT_MASTER.md`](./prompts/ONESHOT_MASTER.md) (원샷) 또는 [`BUILD_PLAN.md`](./BUILD_PLAN.md) §11 (마일스톤 단위).
> **버전**: v1.0 · 2026-07-21

---

## 1. 문서 트리

```
docs/
  README.md            ← 이 문서. 읽기 순서·정본 경계·매핑표
  PRODUCT_SPEC.md      제품 정본: 컨셉·시장·경쟁·기능·법무·수익·로드맵
  BUILD_PLAN.md        실행 정본: 스택·마일스톤(M0~M6)·계산 엔진 스펙(§6)·마일스톤 프롬프트(§11)
  design/
    DESIGN_SYSTEM.md   디자인 토큰 정본: 색·타이포·스페이싱·모션 토큰·브레이크포인트·아이콘
    COMPONENTS.md      공통 컴포넌트 정본: 목록·props·상태·a11y·모션·반응형 변형
    SCREENS.md         화면 정본: 6화면 레이아웃·상태 매트릭스·인터랙션·계측·SEO
    UX_FLOWS.md        여정 정본: 핵심 5여정·마찰/복구·뒤로가기/딥링크·오프라인·신뢰 UX
    MICROCOPY.md       문구 정본: 전 화면 문구 사전·친구톤 규칙·표기 규칙(원화·시간·조사)
  engineering/
    ARCHITECTURE.md    구조 정본: 데이터 흐름·상태 소유권·폴더 구조·에러 전략·Dexie 마이그레이션·성능 예산
    API_CONTRACT.md    서버 계약 정본: DDL·RPC·RLS·Zod 스키마·에러 계약
    SECURITY.md        보안 정본: 위협모델·XSS·어뷰징 대응·CSP·env 규칙
    ANALYTICS.md       계측 정본: 이벤트 스키마·의사결정 게이트 지표 연결
    PLATFORM_NOTES.md  플랫폼 정본: IME·초성 엣지·iOS Safari 저장소 축출·카카오 인앱·PWA 설치
  verification/
    QA_MATRIX.md       품질 매트릭스: 검증 카테고리×화면·우선순위 등급·자가감사 채점표
    TEST_PLAN.md       테스트 정본: 단위·e2e(정상+비정상)·시각·a11y·실패 프로토콜
  prompts/
    ONESHOT_MASTER.md  원샷 마스터 프롬프트 v2 (빌더 에이전트에게 통째로 주는 실행 지시)
```

---

## 2. 읽기 순서

**사람(기획·리뷰)**: `PRODUCT_SPEC.md` → `BUILD_PLAN.md` → 이 문서 → 관심 도메인 문서.

**빌더 에이전트(코덱스/오푸스 등)**: `prompts/ONESHOT_MASTER.md`가 Phase별로 읽을 문서를 지정한다. **16개 문서를 한 번에 다 읽지 마라** — 각 Phase의 화이트리스트만 읽는다.

---

## 3. 정본 소유권 표 (Source of Truth)

**원칙: 사실 1개가 바뀌면 고칠 파일은 정확히 1개다.** 같은 사실이 다른 문서에 보이면 그것은 요약·포인터이며, 충돌 시 아래 정본이 이긴다. 충돌을 발견한 에이전트는 정본을 따르고 `DECISIONS_LOG.md`에 기록한다.

| 사실(무엇이 바뀌면) | 정본(여기만 고친다) |
|---|---|
| 제품 컨셉·시장·경쟁·기능 범위·법무·수익모델·제품 로드맵 | `PRODUCT_SPEC.md` |
| 기술 스택·마일스톤·**계산 엔진 규칙/테스트 벡터(§6)**·배포 환경 | `BUILD_PLAN.md` |
| 색·타이포·스페이싱·라운드·그림자·모션 토큰·브레이크포인트·아이콘 규칙 | `design/DESIGN_SYSTEM.md` |
| 공통 컴포넌트 목록·props·상태·변형 | `design/COMPONENTS.md` |
| 화면 구성·라우트·상태 매트릭스·화면별 인터랙션 | `design/SCREENS.md` |
| 사용자 여정·내비게이션/뒤로가기 규칙·신뢰 UX | `design/UX_FLOWS.md` |
| 화면에 보이는 모든 문구·톤·표기 규칙 | `design/MICROCOPY.md` |
| 폴더 구조·상태 소유권·에러 전략·Dexie 스키마/마이그레이션·성능 예산 | `engineering/ARCHITECTURE.md` |
| Postgres DDL·RPC·RLS·공유 payload Zod 스키마·서버 에러 계약 | `engineering/API_CONTRACT.md` |
| 위협모델·CSP·비밀/env 규칙·어뷰징 한도 | `engineering/SECURITY.md` |
| 계측 이벤트 이름·속성·게이트 지표 | `engineering/ANALYTICS.md` |
| IME·브라우저/OS 특이사항·PWA 설치 동작 | `engineering/PLATFORM_NOTES.md` |
| 검증 카테고리·우선순위 등급·자가감사 채점표 | `verification/QA_MATRIX.md` |
| 테스트 종류·시나리오·증거 형식·실패 프로토콜 | `verification/TEST_PLAN.md` |
| 원샷 실행 절차·Phase 화이트리스트·안티패턴 grep 목록 | `prompts/ONESHOT_MASTER.md` |

이력 참고: `PRODUCT_SPEC.md` §12(데이터 모델 초안)·§14(디자인 초안), `BUILD_PLAN.md` 구§4(DDL)·구§15(검증)는 **이력용 초안**으로 강등되었고 정본은 위 표를 따른다.

---

## 4. Phase ↔ 마일스톤(M) 매핑

원샷 프롬프트는 Phase 0~10 체계, `BUILD_PLAN.md` §8·§11은 M0~M6 체계다. 중단된 작업을 다른 체계로 재개할 때 이 표로 환산한다.

| 원샷 Phase | 내용 | 대응 마일스톤 |
|---|---|---|
| Phase 0 | 스캐폴딩·폴더 구조 | M1 일부 |
| Phase 1 | 디자인 시스템·기본 컴포넌트 | M1 |
| Phase 2 | Supabase 스키마·RPC·샘플 시드 | M0(샘플 수준) |
| Phase 3 | 라우팅·검색·담기·홈 플래너 | M2 |
| Phase 4 | 계산 엔진 + 계산 UI | M3 |
| Phase 5 | 티켓·공유·OG·fork | M4 + M5 |
| Phase 6 | 애니메이션 | M6 일부 |
| Phase 7 | 아이콘/에셋(SVG) | M1·M6 일부 |
| Phase 8 | a11y·상태 카피·검증 실행 | M6 |
| Phase 8.5 | **QA_MATRIX 자가감사** (신설) | — |
| Phase 9 | PWA 마감·배포 준비 | M6 |
| Phase 10 | HANDOFF.md (사람 작업 목록) | — |

---

## 5. 문서 갱신 규칙

1. **정본만 고친다.** 요약·포인터가 낡았으면 포인터를 갱신하지 사실을 복사하지 않는다.
2. 정본 문서는 헤더에 버전·날짜를 올리고 변경 요지를 한 줄 남긴다(기존 `PRODUCT_SPEC.md` 관례).
3. 문서 간 참조는 상대 경로 링크로. 섹션 참조는 `문서명 §번호` 표기.
4. 구현 중 문서에 없는 결정이 생기면 코드를 고치지 말고 먼저 `DECISIONS_LOG.md`(구현 시 저장소 루트에 생성)에 기록한다 — 형식은 `prompts/ONESHOT_MASTER.md` 참조.
   구현 산출 문서 2종은 저장소 루트에 생긴다(이 트리 밖): `DECISIONS_LOG.md`(모호 결정 로그) · `HANDOFF.md`(사람 작업 목록, ONESHOT Phase 10 산출물).
5. 확실하지 않은 내용은 사실처럼 쓰지 않는다: `추정`, `기획 확인 필요`, `실측 필요` 표기(코드리뷰 체크리스트 관례를 설계 문서에도 적용).
