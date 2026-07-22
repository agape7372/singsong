# Codex 최종 심사 의견 — Fable/Opus 설계에 대한 독립 리뷰

> **작성일**: 2026-07-21  
> **역할**: 기존 Fable/Opus 문서의 장점을 보존하면서, 구현 전에 치명적 전제와 숨은 unknown을 드러내는 독립 심사  
> **판정**: 현재 `ONESHOT_MASTER.md` v2 실행은 **STOP**. `FINAL_BLUEPRINT.md`와 원샷 v3.2를 기준으로 재개할 것.  
> **주의**: 이 파일은 설계 의도와 비판의 근거를 남기는 리뷰다. 구현 계약은 `FINAL_BLUEPRINT.md`가 정본이다.

---

## 1. 내 결론

기존 문서 세트는 흔한 “아이디어 메모”보다 훨씬 낫다. 제품 범위, 화면 상태, microcopy, 접근성, 테스트, 플랫폼 예외까지 실제 구현을 생각하며 썼다. 특히 다음 판단은 유지할 가치가 높다.

- 오디오·가사·녹음·결제를 MVP에서 제외한 것.
- 개인 플랜을 local-first로 두고 공유본을 immutable snapshot으로 분리한 것.
- 검색에서 한글 IME, 초성, Android 229를 별도로 다룬 것.
- 빈/로딩/오류/오프라인 상태를 정본에 포함한 것.
- 티켓 PNG와 읽기 전용 링크를 같은 share model에서 파생한 것.
- reduced motion, 44px target, XSS text-node 원칙, 실패 증거 요구.
- `DECISIONS_LOG`와 “컴파일 성공 ≠ 동작”이라는 원샷 규칙.

그러나 문서가 정교하다는 사실이 안전하다는 뜻은 아니다. 오히려 원샷 v2는 몇 가지 잘못된 전제를 “정본 그대로” 구현하도록 강제한다. 그 결과는 예쁜 데모일 수 있지만 다음 이유로 외부 베타에 내놓을 수 없다.

1. 링크 slug를 몰라도 anon REST로 전체 공유 row를 읽을 수 있다.
2. 누구나 무제한 공유 row를 만들고 fork_count를 조작할 수 있다.
3. 3곡 묶음과 예산 역계산의 일반식이 틀려 실제 지불 가능 곡수를 잘못 말한다.
4. Kakao WebView에 저장한 Dexie가 Safari/PWA에 나타날 것이라는 가정이 성장 루프를 끊는다.
5. 실제 TJ/KY 데이터의 출처·권리·품질 없이 “배포 가능한 앱”을 주장한다.
6. iTunes 앨범아트는 핵심 가치가 아닌데 법무·CORS·성능·외부 추적 위험을 동시에 만든다.
7. 계산의 시간 추정을 정확한 한 숫자로 보이게 해 사용자의 신뢰를 과도하게 빌린다.

내 최종 의견은 기능을 더 얹는 것이 아니라 **제품의 주인공을 좁히고, 돈·공개범위·저장 위치를 거짓말하지 않는 구조로 다시 잠그는 것**이다.

---

## 2. 제품을 무엇으로 볼 것인가

기존 설계는 세 제품을 한 MVP에 섞었다.

| 제품 | 원하는 가치 | 필요한 핵심 기능 | 현재 문서의 흔적 |
|---|---|---|---|
| 혼코노 애창곡 관리자 | 내 키·메모·기록을 오래 보존 | 계정/백업/히스토리/멀티리스트 | 키·태그·메모·지난 기록 |
| 소그룹 세션 플래너 | 약속 전 시간·비용·곡을 빠르게 확정 | 검색·계산·요약·메신저 공유 | 가장 강한 플로우와 카피 |
| 공개 플리/바이럴 플랫폼 | 다른 사람의 목록을 발견·복제 | SEO/Discover/복제 attribution/moderation | 색인 가능한 `/s`, 셀럽·스트리밍 플리 import |

세 JTBD를 동시에 만족시키려면 인증, 동기화, moderation, collaboration이 필요해진다. “로그인 없는 local-first MVP”와 충돌한다.

따라서 P0는 두 번째만 택했다.

> **주최자가 2분 안에 세션을 계획해 보내는 도구.**

이 결정의 결과:

- 단일 활성 플랜이면 충분하다.
- 메모·키·태그·히스토리는 빠진다.
- 공유는 검색 가능한 콘텐츠가 아니라 30일 unlisted artifact다.
- 수신자는 공동 편집자가 아니라 계획 열람자이며, fork는 선택적 편의 기능이다.
- 다음 방문 리텐션은 4~6주 occasion 단위로 본다.

공동선곡이 실제 핵심 통증으로 검증된다면 P1의 다음 기능은 실시간 방 전체가 아니라 **가벼운 곡 제안 링크**가 더 적절하다. 지금의 읽기 전용 fork가 공동 계획을 해결한다고 과장해서는 안 된다.

---

## 3. 핵심 쟁점별 토론과 최종 의견

### 3.1 공유를 public이라고 부를 것인가

**기존안**: “링크를 아는 누구나” 볼 수 있으며 `/s/[slug]`는 색인 허용. slug 엔트로피를 열거 방어로 사용.

**반대 논거**:

- `using(true)` SELECT는 slug 추측 없이 전체 row를 보여줄 수 있다.
- 색인 허용은 “링크를 아는 사람” 범위를 넘어선다.
- payload에 memo/myKey/tags/device ID까지 들어가면 사용자가 공개를 오해할 위험이 크다.
- 삭제/만료가 없으면 실수로 만든 공유가 영구 공개된다.

**최종 의견**: P0는 unlisted, `noindex/nofollow/noarchive`, 최소 payload, 30일 TTL, hash된 revoke capability다. 공개 Discover는 별도 제품으로 취급한다. 신뢰도: **매우 높음**.

### 3.2 브라우저에서 Supabase를 직접 쓸 것인가

**기존안**: anon key로 songs/search/shared_lists에 직접 접근하고 RLS로 제한.

**반대 논거**:

- RLS와 GRANT는 별개이며 현재 explicit revoke가 없다.
- 공개 INSERT는 client validation을 우회한 저장소 스팸을 막지 못한다.
- created_at, fork_count, device ID 같은 서버 필드도 클라이언트가 정할 수 있다.
- rate limit, Turnstile, token hashing, redacted logging을 한 경계에서 수행하기 어렵다.

**최종 의견**: 검색과 share create/get/revoke 모두 Next BFF를 통과한다. 검색 RPC는 browser/anon에 공개하지 않고 server-only repository가 allowlisted exact signature로만 호출한다. direct table/function grants는 0이고 서버 `sb_secret_*`는 server-only 모듈에 격리한다. 신뢰도: **높음**.

### 3.3 local-first가 곧 데이터 안전인가

**기존안**: Dexie에 저장하고 `navigator.storage.persist()`, PWA 설치를 유도하면 데이터가 더 안전함.

**반대 논거**:

- WebKit은 설치된 Home Screen 앱과 Safari 저장소를 분리하며, 설치 시 IndexedDB를 자동 복사하지 않는다.
- Kakao in-app WebView도 외부 브라우저와 다른 저장소일 수 있다.
- “저장 완료”가 사실상 “이 WebView에만 저장”일 수 있다.
- local-first는 서버에 안 올린다는 프라이버시 장점이지 자동 백업/이관을 뜻하지 않는다.

**최종 의견**: 저장된 컨텍스트를 카피에 밝히고, 인앱에서는 외부 브라우저 링크 복사를 우선한다. 설치 앱에는 `/import` 붙여넣기 경로를 둔다. 자동 이전을 암시하는 설치 카피는 실기기 검증 전 금지한다. 신뢰도: **매우 높음**.

### 3.4 시간은 한 숫자인가 범위인가

**기존안**: iTunes duration 또는 평균값 합산 후 분 단위 결과.

**반대 논거**:

- 노래방 버전, 전주/간주 건너뛰기, 곡 사이 대화, 리모컨 조작이 실제 시간을 바꾼다.
- 일부 duration만 섞으면 누락곡을 빼거나 서로 다른 신뢰 수준을 한 숫자로 합치는 구현 위험이 있다.
- 한 숫자는 시스템이 가진 것보다 강한 확신을 보여준다.
- 반올림된 분을 과금 블록에 넣으면 경계에서 과소 계산한다.

**최종 의견**: P0는 실제 duration을 섞지 않고 `fallback-v1`을 전 곡에 적용해 `coverageBps=0`을 정직하게 표시한다. integer seconds의 low/mid/high, 5분 단위 바깥 반올림을 분리하고 과금은 raw high/low seconds로 계산한다. 실제 방문 데이터로 다음 modelVersion을 검증한다. 신뢰도: **높음**, 계수 자체는 **실험 필요**.

### 3.5 묶음 요금은 단순 공식으로 충분한가

**기존안**: `floor(N/Y)*X + remainder*P`, 역계산은 평균 묶음 단가로 나눔.

**반대 논거**:

- 묶음이 단품보다 비싸면 overcharge한다.
- 예산이 묶음 가격보다 작을 때 평균 단가 역계산은 살 수 없는 곡 수를 반환한다.
- 일부 곡만 쓰더라도 묶음을 사는 편이 더 싼 경우를 놓칠 수 있다.

**최종 의견**: `k=0..ceil(N/Y)`를 열거한 exact minimum, 역계산은 같은 `cost(n)`에 대한 최대 feasible N. 100곡 cap에서 성능은 문제가 아니다. 신뢰도: **수학적으로 확정**.

### 3.6 앨범아트가 필요한가

**기존안**: iTunes Search API URL을 검색 결과와 홈에 사용, export에는 제외.

**반대 논거**:

- Apple의 공식 조건은 Store 콘텐츠 홍보 맥락과 링크/배지를 전제한다.
- 검색 결과 인식보다 외부 요청, CORS, CLS, 개인정보/추적, 불일치 duration 문제가 커진다.
- 티켓 디자인은 애초에 텍스트·번호·절취선이 더 고유하다.

**최종 의견**: P0 완전 제거. 검색에서 제목·가수·vendor number hierarchy를 강화한다. 법무와 실제 사용자 인식 효용이 확인될 때만 재도입한다. 신뢰도: **높음**.

### 3.7 Kakao SDK를 처음부터 넣을 것인가

**기존안**: Kakao JS SDK를 대표 공유 방식으로 제공.

**반대 논거**:

- SDK 키·도메인·CSP·공급망·인앱 동작을 추가한다.
- 모바일 OS share sheet에서 사용자가 Kakao를 선택할 수 있다.
- 진짜 난제는 SDK 버튼이 아니라 수신 WebView에서 외부 저장소로 넘기는 것.

**최종 의견**: P0는 Web Share, 링크 복사, PNG 저장. Kakao 고유 template이 전환을 유의미하게 높일 때만 SDK를 도입한다. 신뢰도: **중상**; 한국 사용자 테스트로 바꿀 수 있다.

### 3.8 PWA는 제품의 핵심인가

**기존안**: 설치 유도가 iOS 저장소 축출의 해결책.

**반대 논거**:

- 설치가 Safari 데이터를 이관하지 않는다.
- 저빈도 event product에서 설치 마찰이 첫 가치를 늦출 수 있다.
- 서비스워커·업데이트·cache/takedown 정합성은 구현 위험을 늘린다.

**최종 의견**: PWA shell과 오프라인 로컬 플랜은 유지하되 설치를 가치 제안 전면에 두지 않는다. handoff가 실증되기 전 설치 CTA를 적극 노출하지 않는다. 신뢰도: **높음**.

### 3.9 분석 도구를 무엇으로 고정할 것인가

**기존안**: Vercel Analytics로 12개 custom event와 주간 리텐션을 계산.

**반대 논거**:

- Vercel Hobby에는 custom events가 없다.
- stable viewer/user ID가 없으면 평균 고유 시청자·retention·k-factor를 계산할 수 없다.
- 현재 지표식은 “열린 공유 비율”과 “평균 시청자”를 혼동한다.

**최종 의견**: typed adapter와 정확한 이벤트 의미만 코드로 잠그고 provider는 예산 결정 후 선택한다. 초기 검증은 사용성 세션·실제 방문 회고와 결합한다. 수집할 수 없는 것을 지표명으로 과장하지 않는다. 신뢰도: **높음**.

---

## 4. 디자인에 대한 내 의견

기존 디자인 문서는 색 대비를 상당히 성실하게 다뤘지만, 긍정적인 형태 문법보다 금지 목록이 강했다. 그대로 구현하면 다음 조합으로 수렴할 가능성이 컸다.

> 분홍 pill 버튼 + 흰 rounded card + 작은 shadow + 마이크/음표 illustration + 마지막 화면의 티켓 장식

이것은 나쁘다기보다 **제품을 기억할 이유가 없는 안전한 AI 기본값**이다.

내가 지지하는 방향은 시각 에이전트가 제안한 `Session Strip`이다.

- 곡을 담는 순간부터 티켓 원지가 작성된다.
- 행은 카드가 아니라 ledger다.
- 계산 경계에서만 절취선이 나온다.
- 금액이 인쇄되고 발권할 때 strip이 하나의 ticket으로 독립한다.
- 공유 화면과 PNG/OG도 같은 물성을 유지한다.

이 방향의 장점은 단순히 예쁘다는 것이 아니다.

1. 검색·큐·계산·공유라는 서로 다른 화면을 하나의 object lifecycle로 묶는다.
2. 앨범아트 없이도 기억되는 얼굴을 만든다.
3. 실제 구현이 CSS·SVG·semantic HTML로 가능하다.
4. 모션이 기능 의미를 가진다. “계획이 발권됨”을 보여준다.
5. PNG/OG로 옮겨도 브랜드 일관성이 남는다.

생성한 콘셉트 보드와 모션 스토리보드는 좋은 방향 확인용이지만, 나는 생성 이미지의 픽셀을 그대로 출하하는 데 반대한다. 생성 결과에는 실제 정보 구조와 다른 탭, 불필요한 영문, 비현실적인 숫자판이 섞일 수 있다. 반드시 `VISUAL_MOTION_DIRECTION.md`의 계약으로 재구성해야 한다.

### 디자인에서 특히 지킬 것

- primary pill button 금지; pill은 chip/circle에만.
- 화면당 독립 card 3개 이상을 기본으로 쌓지 않기.
- rose=action, ochre=money, ink=information 의미 유지.
- control border는 surface 대비 3:1 이상.
- TicketCard 전체를 image role로 만들지 않기.
- slider만으로 값을 입력하게 하지 않기.
- drag만으로 reorder하게 하지 않기.
- 320px/200% text resize/1280px에서 400% browser zoom/100곡/긴 한국어/forced-colors를 실제로 보기.
- 모션은 ticket issue 하나를 주인공으로 삼고 page slide/count-up/confetti를 동시에 쓰지 않기.

---

## 5. 원샷 프롬프트에 대한 내 의견

v2의 가장 좋은 아이디어는 phase별 증거, 결정 로그, 가짜 성공 금지다. 가장 나쁜 아이디어는 “정본을 그대로 구현하라”와 “화이트리스트 밖 문서를 보지 마라”다.

문서에 오류가 있을 때, 충실한 빌더는 오류를 더 완벽히 만든다. 따라서 v3는 다음 성격이어야 한다.

### 보존

- git/worktree 보존.
- 실행하지 않은 검증을 통과로 보고하지 않기.
- DECISIONS_LOG, HANDOFF, 재개 가능 상태 파일.
- typecheck/unit/e2e/screenshot의 실제 증거.
- phase/slice별 완료조건.

### 폐기/변경

- 긴 원문 인용 리추얼 → `REQ-*` 추적표.
- 16개 컴포넌트 선구현 → vertical slice에서 필요한 primitive 추출.
- 마지막 a11y/motion retrofit → 각 slice와 함께 구현.
- raw GNU grep → cross-platform package scripts와 `rg` 보조.
- 구현자 자가점수 → 독립 리뷰어의 severity 판정.
- “배포 가능” 단일 상태 → build capability와 human production gate 분리.
- `latest`, Node 20, Next 15, Framer Motion → Node 24, pinned Next 16.1, `motion/react`.
- Lighthouse PWA badge → manifest/SW/offline/실기기 개별 증거.

### 원샷이라는 말의 현실적인 의미

“한 번의 프롬프트”는 한 번의 무검증 생성이 아니다. 같은 에이전트가 저장소 상태 파일을 갱신하며 slice별로 만들고, blocker에서 정직하게 멈추고, 독립 리뷰를 거치는 장기 실행 지시다. 외부 키·데이터 권리·실기기 없이 `productionGate=READY_FOR_HUMAN_RELEASE`를 선언할 수 없어야 하며, 에이전트는 `RELEASED`를 선언하지 않는다.

---

## 6. 기존 문서 충돌의 최종 해석

| 충돌 | 기존 A | 기존 B | 최종 해석 |
|---|---|---|---|
| MVP 범위 | 멀티리스트/스트리밍 플리 import/art/history | 검색→계산→공유 | P0 단일 활성 플랜+검색/직접추가+계산+티켓+safe share+공유 스냅샷 가져오기 |
| TabBar | 2개 | 3개, `/list` 표시/숨김 혼재 | `/`와 `/search`만 2개; ticket/share/import에는 없음 |
| 0곡 계산 | 숨김 | 0값 card 표시 | 계산 card 숨김, actionable empty strip |
| 공유 공개성 | 링크 아는 사람 | 검색엔진 index | unlisted, noindex, 30일 |
| payload | memo/key/tags/device | 개인 데이터 local-only | 공개 payload에서 전부 제외 |
| 검색 IME | composition 중 검색 허용 | composition 중 query 금지 | 입력 반영, network pause, compositionend debounce |
| 검색 재탭 | toggle 삭제 | 담김 상태 | 삭제 금지, undo toast |
| 계산 모드 | 3 segmented | 업소별 다양한 블록 | 2 알고리즘 + 첫 입력 blank/로컬 최근값 |
| 시간 결과 | 단일 분 | 대략 안내 | low/high + coverage |
| 금액 색 | `--gold` | `--gold-text` | semantic `--money-text`; decorative gold만 원색 |
| 티켓 의미 | 전체 role=img | 정보 콘텐츠 | semantic article/dl + aria-hidden decoration |
| album art | iTunes 필수 | export 외부 요청 0 | P0 제거 |
| share insert | browser anon upsert | immutable snapshot/RLS | server BFF insert-only, single-flight |
| 레거시 `fork` | 매 클릭 duplicate | 바이럴 핵심 | P0 명칭은 `공유 스냅샷 가져오기`; active plan replace, per-slug idempotent |
| PWA 설치 | 데이터 보호 | IndexedDB 미이관 | 자동 이전 약속 금지, paste import |
| 런타임 | Node 20+/Next 15 | 2026 신규 구축 | Node 24 LTS/Next 16.1 pinned |
| Motion | Framer Motion | 2026 package | `motion`, `motion/react` |

---

## 7. 아직 내가 확신하지 않는 것

최종 설계가 모든 문제를 “결정”한 척해서는 안 된다. 다음은 실제 증거 없이는 모른다.

- 사용자가 노래방 전에 실제로 가격을 입력할 의지가 있는가.
- 티켓에 날짜/장소가 없으면 공유물이 초대 역할을 충분히 하는가.
- 주최자 모델이 실제 그룹의 대표 행동인가, 아니면 모두가 곡을 제안해야 하는가.
- 기본 30일 만료가 너무 짧거나 긴가.
- 시간 범위가 신뢰를 높이는가, 오히려 복잡하게 느껴지는가.
- OS 공유만으로 Kakao 전환이 충분한가.
- manual add가 불완전한 카탈로그를 실용적으로 보완하는가.
- 사용자가 설치 앱으로 링크를 붙여넣는 recovery를 이해하는가.
- Session Strip의 paper metaphor가 한국 코인노래방 사용자에게 세련되게 느껴지는가, 영수증처럼 낡게 느껴지는가.
- 노래방 재사용 주기는 4주, 8주, 계절/모임 단위 중 무엇인가.

이 항목은 [`UNKNOWN_REGISTER.md`](./UNKNOWN_REGISTER.md)의 실험과 통과 기준으로 관리한다.

---

## 8. 미래 모델에게 남기는 핸드오프

이 저장소에서 구현을 시작하는 다음 모델은 다음 순서로 읽어야 한다.

1. `docs/FINAL_BLUEPRINT.md`
2. `docs/UNKNOWN_REGISTER.md`
3. `docs/design/VISUAL_MOTION_DIRECTION.md`
4. `docs/prompts/ONESHOT_MASTER.md`
5. 필요한 기존 도메인 문서

기존 문서가 더 상세해 보인다는 이유로 v3 결정을 되돌리지 말 것. 상세함과 최신성은 다르다. 특히 다음 레거시 조항은 구현하지 않는다.

- `shared_lists`/`songs` public table `using(true)`.
- client-side share insert/upsert와 `increment_fork`.
- memo/key/tags/device ID 공유.
- iTunes album art/duration runtime dependency.
- 평균 묶음 단가 역계산.
- rounded display minute를 billing input으로 사용.
- indexable `/s`.
- PWA 설치가 Safari IndexedDB를 옮긴다는 카피.
- Node 20, raw `framer-motion`, Lighthouse PWA badge.
- 전 컴포넌트 선구현과 마지막 a11y retrofit.

모델이 다른 선택을 제안할 수는 있다. 단, 다음 형식으로 근거를 남겨야 한다.

```text
제안 변경:
뒤집는 v3 결정:
새 증거:
사용자 가치 변화:
보안/프라이버시/비용 영향:
롤백 방법:
필요한 사람 승인:
```

새 증거 없이 취향이나 구현 편의로 v3 결정을 조용히 되돌리는 것은 허용하지 않는다.

---

## 9. 최종 교차 감사에서 추가로 닫은 경계

초안 완성 뒤 제품·아키텍처·원샷 실행·시각 모션을 독립 재감사해 Critical 0을 확인했고, 다음 High 경계를 v3.2 계약에 반영했다.

- random hash-only slug를 versioned HMAC 파생으로 바꿔 DB commit 뒤 응답 유실을 복구한다.
- Turnstile의 5분·single-use·hostname/action/timestamp/attempt UUID와 장애 경계를 공유 transaction에 연결한다.
- 같은 revision의 ticket payload/artworkSeed/fingerprint를 route memory가 아니라 Dexie CAS snapshot으로 고정한다.
- 100곡의 최악 Unicode payload가 기존 32KiB를 넘는 문제를 canonical 96KiB/raw 128KiB와 golden vector로 닫는다.
- 검색을 GET query가 아닌 POST JSON body로 고정하고 hosting·DB log까지 관측면을 확장한다.
- Supabase privileged credential을 신규 `sb_secret_*`로 고정하고 project-level legacy JWT key disable+old-key 401 증거를 release gate로 둔다.
- persistent write 전 atomic run lock, owner nonce, stale takeover, self-reference 없는 source fingerprint와 state/evidence/environment checkpoint hash chain을 원샷 실행 계약으로 둔다.
- 중간 readiness의 admission·하향 전이와 REQUIRED PWA gate를 명시한다.
- 발권 조건 `canIssueTicket`, frozen issued/received visual, transform/opacity-only motion을 이미지와 문서 모두에서 맞춘다.

이들은 “구현됨”이 아니라 **계약이 잠긴 상태**다. 실제 PASS는 `UNKNOWN_REGISTER`의 `U-IMP-*` fault-injection·관측 증거가 생긴 뒤에만 가능하다.

2026-07-21 최신본을 다시 분리 감사한 결과는 문서/제품 정합성 `Critical 0 / High 0`, 원샷·보안 프로토콜 `Critical 0 / High 0`, 시각·모션/에셋 `Critical 0 / High 0`이다. 이는 **설계 계약 감사 결과**이며 앱 구현·외부 통합·실기기 검증 PASS를 뜻하지 않는다.

---

## 10. 최종 한 문장

Fable/Opus는 싱송을 “놀랍도록 상세하게 설명”해 놓았다. 이제 필요한 것은 기능 목록을 더 늘리는 일이 아니라, **그 상세함이 틀린 돈·공개범위·저장 약속을 자동으로 만들어내지 못하게 하고, 티켓이라는 고유한 시각 언어로 하나의 좁은 사용자 순간을 완성하는 일**이다.
