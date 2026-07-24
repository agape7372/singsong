# 싱송 — 콜렉션·검색·발견 재설계 스펙

> 상태: 설계 기록 (구현 대기) · 2026-07-23
> 트리거: 사용자 피드백 — 곡담기 난잡, 보관함을 스와이프 콜렉션으로, 발견 더미데이터, 더미 카탈로그
> 정본 관계: `docs/design/VISUAL_MOTION_DIRECTION.md`(Session Strip) 준수. 티켓 물성(절취선·펀칭·시리얼)은
> 발권물에만 — **콜렉션은 발권된 티켓을 다루므로 티켓 물성 사용이 정당**하다(계획 단계와 다름).
> **★티켓/표 디자인 작업 전 반드시 `docs/design/ticket-references/추구미.md`(채택/미채택 + 추구미)를 참고할 것.**

## 0. 사용자 요구 원문

1. **곡담기**: 너무 난잡함. 더미데이터 만들 것.
2. **기록(보관함)**: 티켓을 좌우로 부드럽게 넘기는 **콜렉션 창**. **진행중 / 완료** 분류.
   - 진행중 세션 = 공유 링크 관리 가능
   - 완료 = 링크 불필요, **추억 아카이브** 느낌
3. **발견**: 더미데이터 넣기.
4. 디자인 프롬프트 정교하게. 필요시 앱 전반 Higgsfield로 디자인/애니메이션/레이아웃/템플릿 업그레이드 허용.
5. md로 기록.

---

## 1. 데이터 매핑 (⚠ 확인 필요)

현재 로컬 데이터:

- `ticketSnapshots` — 발권된 각 티켓(planId+revision, createdAt, payload=SharedSnapshot, fingerprint).
- `managedShares` — 공유 링크 영수증(fingerprint→slug, expiresAt). 30일 TTL.
- 단일 활성 플랜(편집 중, 아직 미발권)은 별개.

**콜렉션 = 발권된 티켓 목록**(`listTickets`). 진행중/완료 분류 후보:

| 안                           | 진행중                                    | 완료                  | 장점                                                           | 단점                                             |
| ---------------------------- | ----------------------------------------- | --------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| **A (링크 상태 기반, 추천)** | 활성(미만료·미철회) 공유 링크가 있는 티켓 | 링크 없음/만료된 티켓 | 기존 데이터로 즉시 구현, "링크 관리 vs 아카이브"와 정확히 일치 | "진행중"이 이벤트 진행이 아니라 링크 상태를 뜻함 |
| B (명시 상태 플래그)         | 사용자가 "진행중" 표시한 티켓             | "완료" 표시           | 직관적 세션 상태                                               | 새 스키마+토글 UI 필요, 발권 시 기본값 결정      |
| C (시간 기반)                | 최근 N일 이내 발권                        | 그 이전               | 자동                                                           | "세션일"이 없어 발권일≠실제 모임일               |

→ **안 A로 진행 제안**(사용자 문장 "진행중 세션은 공유링크 관리가능"과 문자 그대로 일치). 확인 후 확정.

---

## 2. 곡담기 시트 정리 + 더미 (Slice S)

### 진단 (현재 난잡 원인)

- TEST DATA 안내가 큰 워시 박스로 상단 점유.
- "제목, 가수 또는 노래방 번호" 라벨 + placeholder 중복.
- 빈 상태에서 검색 전 아무것도 없음 → 허전하거나 에러만 노출.
- 직접입력 disclosure가 항상 폼 자리 차지.

### 정리 설계

- TEST DATA = 큰 박스 → **작은 인라인 캡션/칩**(input 아래 1줄, `--ink-muted`).
- 중복 라벨 제거(placeholder만). input을 시트 최상단 sticky로 크게.
- **빈 상태 기본 추천 리스트**: 검색 전 "이런 곡 어때?" 더미 추천 6곡을 ledger 행으로 노출(정적 fixture 시드). 시트가 살아있고 바로 담기 가능.
- 결과/추천 모두 동일 ledger 행(카드 없음): index·제목·가수·TJ/KY·담기 상태.
- 직접입력 = 하단 조용한 링크, 펼칠 때만 폼.
- 상태 우선순위: 추천(빈 검색) → 로딩(150ms+) → 결과 → 없음(재시도 힌트) → 오류.

### 더미데이터

- **fixture 카탈로그 12 → 36곡 확장**(`src/features/catalog/fixture.ts`). 가상 제목·가수·TJ/KY, 결정론적. 다양한 초성/장르 커버해 검색·추천이 풍성.
- 추천 시드 = fixture 상위 6곡(고정).
- 검색 origin 403은 코드/데이터 아님(호스트 불일치). 데모는 정본 호스트로 서빙하거나 `NEXT_PUBLIC_SITE_URL`을 데모 호스트로 빌드.

---

## 3. 보관함 → 세션 콜렉션 (Slice C, 중심)

### 컨셉

**발권 티켓 아카이브** — 발권한 티켓을 좌우로 넘기는 콜렉션. 진행중은 링크를 돌보는 "살아있는" 세션,
완료는 넘겨보는 추억. 티켓 물성(펀칭·절취선·시리얼)이 여기서 주인공이 된다(발권물이므로 정당).

### 구조

- 상단: h1 "보관함" + **세그먼트 컨트롤 `진행중 | 완료`**(radiogroup, aria-current). 카운트 뱃지.
- 본문: 선택 세그먼트의 **가로 스와이프 carousel**.
  - 각 카드 = `TicketCard`(payload=티켓 snapshot). 펀칭·시리얼·요약(곡수·시간·비용·1인당) 그대로.
  - 카드 폭 = viewport의 ~82%, 양옆 이웃 카드 가장자리 peek(다음 장 존재 암시).
  - 중앙 카드 100%, 이웃 scale 0.94 + opacity 0.6(2D 깊이, 3D 금지).
- **진행중 카드 하단**: 공유 링크 관리 스트립 — slug 앞자리·만료 시각·복사·링크 폐기(기존 `ManagedSharesPanel` 로직을 카드 단위로 재사용). 없으면 "링크 만들기"→`/ticket?r=`.
- **완료 카드 하단**: 링크 액션 없음. "추억" kicker + 발권일 + `티켓 열기`(→`/ticket?r=`) + PNG 저장. 조용한 아카이브.
- 빈 상태: 진행중 없음="지금 공유 중인 세션이 없어요"+플랜 링크. 완료 없음="아직 발권한 티켓이 없어요".
- 가져온 플랜(imports)은 완료 세그먼트 하단 보조 목록 or 별도 접이 섹션(2차).

### 애니메이션 (정본 §8 준수, motion/react + CSS)

- **스와이프**: `scroll-snap-type: x mandatory` + `scroll-snap-align: center` 기반(관성·접근성·키보드 무료) — 또는 motion `drag="x"` + 스프링 스냅. 기본은 scroll-snap(모바일 관성 자연스러움), 중앙 판정은 IntersectionObserver로 scale/opacity 갱신.
  - 스프링: 정본 add 스프링 계열(stiffness 520 근처)은 과함 → 카드 전환은 `--ease-standard` 220~260ms, 부드럽게("쫘라락"=플릭 관성은 네이티브 스크롤이 담당).
- **세그먼트 전환(진행중↔완료)**: 정본 §8-3 select 160ms 인디케이터 + 리스트 shared-axis(opacity+translateX ≤8px) 180ms.
- **중앙 카드 포커스**: scale 0.94→1.0, opacity 0.6→1.0, `--motion-state`. transform/opacity만(레이아웃·shadow 애니 금지 §8-6).
- **진입**: 첫 카드들 stagger fade+translateY 4px(40ms 간격).
- **reduced-motion**: scale/스태거 제거, scroll-snap만. 드래그 관성 유지(네이티브).
- 성능: will-change는 스와이프 중만, 4× slowdown long task 0 목표.

### 데이터/구현

- `listTickets()` + `listManagedShares()` 조인(fingerprint 매칭)으로 각 티켓의 링크 상태 계산.
- 진행중 = active 링크 있음, 완료 = 없음(안 A). `src/features/library/` 재구성.
- `TicketCard`는 payload만 필요 — snapshot.payload 그대로. `headingLevel="h3"`(콜렉션 내 카드).
- 카드 단위 공유/폐기 = 기존 `/api/shares/*` + `getManagedShare`/`deleteManagedShare` 재사용.

---

## 4. 발견 더미 큐레이션 (Slice D)

### 방향

"준비 중" 플레이스홀더 → **더미 큐레이션 플레이리스트로 채움**. 단 정직: **TEST DATA 뱃지 유지**
(권리 확보 전 실제 카탈로그 아님을 명시 — 검색 시트의 TEST DATA 관례와 동일). D-028 정신 유지:
색인·서버·동의발행 0, 로컬 fixture 기반.

### 구조

- h1 "발견" + TEST DATA 캡션("가상 큐레이션 미리보기").
- **테마 플레이리스트 카드/행 6종**(fixture 곡으로 구성): 예)
  - "회식 마무리 떼창" · "새벽 감성 발라드" · "2000년대 명곡" · "듀엣 곡" · "고음 도전" · "분위기 UP".
  - 각 플리 = 제목 + 곡 수 + 대표 3곡 미리보기(fixture).
- 탭하면 플리 상세(곡 ledger) → "플랜에 담기"(전체/개별). 실제 곡은 fixture라 origin 무관하게 로컬 담기.
- 가짜 실존 셀럽명·실곡 금지. 가상 테마·가상 곡(fixture)만.

### 더미데이터

- `src/features/discover/fixture-playlists.ts`(신규): 테마별 fixture song id 목록.
- fixture 카탈로그(36곡)에서 조합.

---

## 5. Higgsfield 활용 (선택, 프롬프트 정교)

정본 §10: 생성 이미지는 **reference-only**, 프로덕션 자산으로 미출하. 애니메이션·레이아웃은 코드(motion/react·CSS)로
구현. Higgsfield는 **디자인 무드보드/레퍼런스**로만. 아래 프롬프트는 필요 시 호출용 초안.

### P1 — 콜렉션 갤러리 무드보드

> High-fidelity reference board for a Korean karaoke "session ticket" collection screen, concept CUTLINE / Session Strip.
> A horizontal carousel of paper ticket cards on a warm off-white canvas (#FAF7F0), each ticket white paper with a
> single left perforation edge, side punch holes, a monospaced serial, and a compact summary (song count, time range,
> total, per-person). Center ticket full size and crisp; neighboring tickets slightly smaller and faded at the edges,
> peeking in. Two states shown side by side: an "in-progress" ticket with a small share-link status strip below it, and a
> "completed" ticket with a quiet archival stamp and date. Deep aubergine ink (#15131A), restrained rose action accent
> (#FF3D6E), ochre money accent (#B76E00). Editorial, calm, tactile-paper but flat (no photoreal texture, no gradient,
> no glass, no neon, no 3D). Left-aligned typography, tabular numerals. Reference only.

### P2 — 완료 "추억 아카이브" 스탬프 모티프

> A minimal vector rubber-stamp motif for "완료/추억" on a karaoke session ticket, single ink color (deep aubergine),
> slightly rough stamp edge, small, unobtrusive, placed at a ticket corner. Flat 2D, no gradient, no photoreal. Reference
> only — final asset will be redrawn as controlled inline SVG.

### P3 — 발견 큐레이션 카드 레이아웃 레퍼런스

> Reference layout for themed karaoke playlist cards (fictional themes), CUTLINE style: paper rows on warm canvas, each
> card a theme title, a song count, three preview song lines (fictional titles), and a small "TEST DATA" tag. No album
> art, no celebrity likeness, no photos. Flat editorial, ink + rose. Reference only.

**원칙**: Higgsfield 산출물은 색·밀도·구도 참고만. 실제 UI/아이콘/스탬프는 제어된 inline SVG + 코드로 재작도.
크레딧 소비 전 사용자 확인.

---

## 6. 구현 순서 (제안)

1. **더미데이터**: fixture 12→36 + 발견 fixture-playlists (Slice S/D 데이터 선행, 무의존).
2. **곡담기 정리**: TEST DATA 축소·라벨 제거·기본 추천 리스트·직접입력 하단화 (Slice S).
3. **발견 큐레이션**: 플리 6종 + 상세 + 담기 (Slice D).
4. **보관함 콜렉션**: 세그먼트 + 스와이프 carousel + 진행중/완료 + 카드 단위 링크/아카이브 (Slice C, 최대).
5. (선택) Higgsfield 무드보드 호출 → 코드 구현 미세조정.
6. 테스트·문서 갱신.

## 7. 검증

- `format:check`/`lint`/`typecheck`/`test`/`build:demo`.
- 육안(정본 §12-1): 곡담기 정리 후 밀도, 콜렉션 스와이프 부드러움(390×844), 진행중 링크 관리/완료 아카이브 구분,
  발견 더미 플리. reduced-motion·320px·200% 리플로우.
- 콜렉션 스와이프 60fps·long task 0(4× slowdown).

## 8. 안전

- 미커밋 사용자 작업 보존, 커밋/배포 별도 승인.
- 발견 더미·검색 fixture는 TEST DATA로 명시(권리 주장 금지, D-004/D-028 정신).
- Higgsfield 크레딧은 사용자 확인 후.

## 9. 확정 결정 (사용자, 2026-07-23)

- **Q1**: 진행중/완료 = **안 A(공유 링크 상태 기반)**. 진행중=활성 링크 있음, 완료=없음.
- **Q2**: 완료 = **순수 읽기 아카이브**(재공유 없음, 티켓 열기·PNG만).
- **Q3**: 발견 담기 = **전체 + 개별 둘 다**.

## 10. 구현 상태 (2026-07-23)

| 영역                                                                                                                | 상태                                                                | 파일                                    |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------- |
| fixture 12→36곡                                                                                                     | 완료                                                                | `catalog/fixture.ts`                    |
| 곡담기 정리(TEST DATA 축소·라벨 sr-only·추천 6곡·직접입력 하단)                                                     | 완료                                                                | `plan/search-ledger.tsx`                |
| 발견 더미 큐레이션 6종(전체/개별 담기, TEST DATA)                                                                   | 완료                                                                | `discover/*`, `plan/add-tracks.ts`      |
| 보관함 콜렉션(진행중/완료·scroll-snap carousel·중앙 scale·진행중 링크관리·완료 추억 아카이브)                       | 완료                                                                | `library/library-screen.tsx`            |
| Higgsfield 무드보드 5종(콜렉션·발견 초안 + 세로티켓·세로콜렉션·모던발견 재생성)                                     | 완료(reference-only)                                                | `docs/design/moodboards-2026-07-23/`    |
| **TicketCard 세로 펀치티켓 리디자인**(MB-A: 중앙 SINGSONG·큰 count·양옆 펀치홀 컬럼·절취선·SN+바코드 흰 스텁·₩오커) | 완료(화면: /ticket·/s·콜렉션)                                       | `ticket/ticket-card.tsx`, `globals.css` |
| **발견 에어리 리디자인**(MB-C: 부드러운 흰 카드·여백·TEST DATA pill·로즈 담기 pill)                                 | 완료                                                                | `globals.css`                           |
| 검증                                                                                                                | typecheck/lint/test(199)/build:demo + 육안(티켓·콜렉션·발견 재설계) | —                                       |

**잔여**:

- **PNG/OG 수출 티켓**을 세로 펀치티켓으로 정렬(사용자 "화면 먼저" 선택 → 후속). 규격 1080×1350/1200×630·canonical light·외부이미지 0·폰트 재검증 필요.
- 다중 카드 스와이프 애니 육안(티켓 2장+), 콜렉션/설정 렌더 테스트(jsdom IntersectionObserver 폴리필).
- 검색 origin 403은 데모 호스트 빌드(`NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100`)로 해소.
- 무드보드는 reference-only(정본 §10); 실명 유사 텍스트는 참고값, 제품 fixture는 가상명 유지.
