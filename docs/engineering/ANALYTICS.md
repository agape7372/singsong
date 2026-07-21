# ANALYTICS.md — 계측 정본

> **정본 범위**: 계측 이벤트 이름·트리거 시점·속성 스키마 · 의사결정 게이트 지표의 정의(공식) · 구현 수위(도구 선택)와 `lib/analytics.ts` 인터페이스 · 프라이버시 원칙.
> 이 문서와 다른 문서가 이벤트/지표 관련 사실에서 어긋나면 **이 문서가 이긴다**.
> **버전**: v1.0 · 2026-07-21 · 짝 문서: [`ARCHITECTURE.md`](./ARCHITECTURE.md)(`lib/analytics.ts`가 사는 폴더 구조), [`PLATFORM_NOTES.md`](./PLATFORM_NOTES.md)(PWA 설치 이벤트 발화 조건)

---

## 1. 목적

PRODUCT_SPEC §20 "의사결정 게이트"는 이렇게 말한다: *"공유 링크 클릭→방문 전환·주간 재방문 유의미하면 [Phase B로] 진행"*. 이 문서는 그 게이트를 **측정 가능한 숫자**로 바꾸는 최소 계측을 정의한다.

**이것은 성장 해킹 계측이 아니다.** 퍼널 최적화·A/B 테스트·사용자별 행동 프로파일링을 위한 이벤트가 아니라, "이 제품 아이디어가 통하는지 아닌지"를 판단하기 위한 딱 12개짜리 최소 신호다. 이벤트를 추가하고 싶어지는 유혹이 들면 먼저 "이게 PRODUCT_SPEC §20 게이트와 직접 연결되는가"를 묻는다 — 아니라면 이 문서 범위 밖이다.

---

## 2. 이벤트 스키마 (고정 12종 전수)

**공통 규칙**: 모든 이벤트 속성에 **PII 금지**, **곡 제목/가수명 등 사용자 가시 텍스트 금지**(`songId` 수준까지만 — API_CONTRACT §4의 "title/memo/tags는 신뢰 불가 입력"과 같은 이유로, 애초에 텍스트를 계측 시스템에 보내지 않는다). `slug`는 공개 식별자라 허용(누구나 URL로 알 수 있는 값이며 그 자체로 개인을 특정하지 않음).

| 이벤트명 | 트리거 시점(정확히) | 속성(타입) | 발화 화면 | 게이트 연관 |
|---|---|---|---|---|
| `app_open` | 앱이 새 브라우저 탭/세션에서 최초로 상호작용 가능해진 시점(hydration 완료 직후). SPA 내비게이션(라우트 이동)마다 재발화하지 않는다 — 세션당 1회. | 없음 | 전역(모든 라우트 진입점) | `return_visit` 판정의 트리거 지점(§3-3) — 자체로는 게이트 지표 아님 |
| `song_search` | **응답 완료 시 1회 발화(확정)** — 디바운스 경과로 호출된 `search_songs` RPC의 응답이 도착한 시점(성공 응답 한정, 실패는 미발화). Abort된 요청(연속 타이핑)은 발화하지 않음 | `queryLength: number`(글자 수, 원문 금지), `resultCount: number`(확정값 — 0 포함) | `/search` | 코어 활성화 지표(간접) — 게이트 공식에는 직접 쓰이지 않음 |
| `song_added` | "담기(+)" 클릭 처리로 `listItems`에 Dexie insert가 **성공**한 시점 | `songId: number`, `source: 'search' \| 'history'`(검색 결과에서 담았는지, 히스토리 재담기인지) | `/search`, `/`(히스토리 재담기) | 코어 활성화 지표(간접) |
| `calc_changed` | 계산 파라미터(`mode`/`people`/`price` 중 하나 이상) 변경으로 `lib/calc.ts` 재계산 결과가 화면에 반영된 시점. 슬라이더 드래그 등 연속 입력은 디바운스(`추정` 500ms) 후 1회만 | `mode: 'coin_per_song' \| 'coin_per_time' \| 'room_per_time'`, `people: number` | `/`(세션 요약 카드) | 코어 활성화 지표(간접) |
| `ticket_created` | `/ticket/[id]`에 유효한 리스트로 진입해 티켓 카드가 렌더된 시점(진입 자체가 트리거, PNG 저장 여부와 무관) | `songCount: number` | `/ticket/[id]` | 공유 퍼널의 진입 단계(간접) |
| `share_created` | `shared_lists` insert가 **성공**(slug 발급 완료)한 시점 | `slug: string`, `songCount: number` | `/ticket/[id]` | §3-2 확산 지표의 분모 |
| `share_viewed` | `/s/[slug]`가 유효한 payload로 성공 렌더된 시점(클라 hydration 후 1회, SSR 자체가 아니라 실제 뷰어가 화면을 본 시점 기준) | `slug: string` | `/s/[slug]` | §3-2 확산 지표의 분자, §3-2 전환율의 분모 |
| `fork_saved` | "내 플리로 저장" 클릭으로 로컬 Dexie 복제가 **성공**한 시점(`increment_fork` RPC 결과는 기다리지 않음 — fire-and-forget, API_CONTRACT §2-2) | `slug: string`, `songCount: number` | `/s/[slug]` | §3-2 전환율·바이럴계수의 분자 |
| `history_marked` | "오늘 이거 부름" 체크로 `history` row 기록이 성공한 시점 | `songId: number` | `/ticket/[id]`(확정 — BUILD_PLAN §11-6·MICROCOPY `ticket.history.mark`) | 코어 재사용 지표(간접) |
| `pwa_install_shown` | **설치 유도 UI가 노출된 시점(플랫폼 무관 확정)** — 안드로이드는 `beforeinstallprompt` 캡처 후 배너 노출, iOS는 수동 안내 배너 노출(PLATFORM_NOTES §4). 둘 다 이 이벤트 | `platform: 'android' \| 'ios'` | 전역(주로 `/`) | 설치 퍼널 분모 |
| `pwa_install_accepted` | 설치 프롬프트 결과가 `outcome === 'accepted'`로 확인된 시점 — **안드로이드 한정**(iOS는 수동 설치라 수락 시점을 감지할 수 없음. iOS 설치율은 미측정 한계로 명시) | 없음 | 전역 | 설치 퍼널 분자(안드로이드만) |
| `return_visit` | `app_open` 처리 로직 내부에서, 로컬에 이전 방문 기록이 있고 오늘이 그 이후인 경우에 한해 발화(§3-3 산출 로직) | `daysSinceLastVisit: number`(정수, 이전 방문과의 경과일) | 전역(발화 위치는 UI 없음, `app_open` 처리 흐름 내부) | 주간 재방문 지표의 재료(§3-3) |

**빈 검색 결과**는 에러가 아니므로(API_CONTRACT §5) `song_search`가 정상 발화하고 `resultCount: 0`으로 기록된다 — 별도 실패 이벤트를 만들지 않는다.

---

## 3. 게이트 지표 정의 (공식)

PRODUCT_SPEC §20 게이트 통과 기준(수치 임계값 자체)은 이 문서의 소유가 아니다 — **PRODUCT_SPEC §20 참조**(임계값 미정, `기획 확인 필요`로 그쪽에 남아있다). 여기서는 "그 판단에 쓸 숫자를 어떻게 계산하는가"만 정의한다.

### 3-1. 측정 가능성의 한계 — 먼저 짚고 간다

PRODUCT_SPEC §20이 원하는 것은 "공유 링크 **클릭** → 방문 **전환**"이다. 그러나 클릭 자체는 카톡/인스타 등 우리가 계측할 수 없는 앱 안에서 일어나므로 **직접 측정 불가능**하다. 우리가 실제로 관측 가능한 것은 "링크가 열려서 `/s/[slug]`가 렌더됐다"(`share_viewed`)뿐이다. 따라서 아래 지표들은 "클릭 대비 방문 전환율"이 아니라 그 **인접 근사치**다 — 이 한계를 숫자를 볼 때마다 함께 읽는다.

### 3-2. 공유 확산·전환 지표

| 지표 | 공식 | 의미 |
|---|---|---|
| 공유 확산(리치) | `distinct(share_viewed.slug) / count(share_created)` | 공유 하나당 평균 몇 명이 열어봤는가. 링크가 실제로 퍼지는지의 대리 지표. |
| 공유 전환율 | `count(fork_saved) / count(share_viewed)` | 본 사람 중 몇 %가 "내 플리로 저장"까지 갔는가 — PRODUCT_SPEC §20 게이트의 핵심 근사치로 취급한다(§3-1 한계 감안). |
| 바이럴 계수(근사, k-factor) | `count(fork_saved) / count(share_created)` | 공유 1건이 평균 몇 건의 신규 fork를 만들어내는가. `k ≥ 1`이면 이론상 자체 증식(단, 표본이 매우 작은 초기 베타에서는 `기획 확인 필요` — 노이즈가 큼). |

### 3-3. 주간 재방문 — `return_visit` 산출 로직 (로컬 `last_visit` 기반)

익명 이벤트 단위 계측(§5)이라 서버에서 "이 사람이 지난주에도 왔다"를 device ID로 조인해서 판정할 수 없다. 대신 **판정 자체를 클라이언트(기기)에서 로컬 상태로 수행**하고, 그 판정 결과만 이벤트로 보낸다.

```
app_open 처리 시:
  lastVisitAt = Dexie.settings.get('lastVisitAt')   // ARCHITECTURE §4-1

  if lastVisitAt is undefined:
    // 이 기기의 첫 방문 — 재방문 아님, 이벤트 없음
  else:
    daysSinceLastVisit = floor((now - lastVisitAt) / 1일)
    if daysSinceLastVisit >= 1:                      // 최소 하루는 지나야 "재방문"으로 침
      track('return_visit', { daysSinceLastVisit })

  Dexie.settings.put('lastVisitAt', now)             // 항상 갱신(다음 판정 기준점 갱신)
```

- **주간 재방문율(근사)** = 관측 기간 동안 `daysSinceLastVisit`가 `1~7` 범위인 `return_visit` 이벤트 수 ÷ 같은 기간 `app_open` 이벤트 수. 정확한 "N% 사용자가 재방문했다"가 아니라 **"전체 방문 중 재방문성 방문의 비율"** 이다(디바이스 단위 dedup을 하지 않으므로 헤비유저가 비율을 끌어올릴 수 있음 — 해석 시 유의, `기획 확인 필요`).
- 게이트 통과 기준(수치)은 PRODUCT_SPEC §20 참조.

---

## 4. 구현 수위

### 4-1. 권장: Vercel Analytics 커스텀 이벤트

- **권장 이유**: 배포 스택이 이미 Vercel(BUILD_PLAN §2)이라 추가 인프라·env·RLS 설정이 0에 가깝다. §1에서 밝힌 "성장 해킹이 아니라 최소 신호"라는 목적에 맞게, 설정 최소화가 곧 정합성이다.
- **한계**: 이벤트 간 비율(§3-2, §3-3 공식)을 대시보드에서 바로 계산해주는 기능은 제공하지 않을 수 있음(`확인 필요`) — 필요시 이벤트 카운트를 수동으로 대조하거나 내보내기해서 계산한다.

### 4-2. 대안: 자체 Supabase `events` 테이블

| | Vercel Analytics | Supabase `events` 테이블 |
|---|---|---|
| 설정 비용 | 거의 0(대시보드 활성화) | 마이그레이션·RLS(anon insert-only) 추가 필요 |
| §3 공식 계산 | 수동 대조/내보내기(`확인 필요`) | SQL로 정확히(§3 공식 그대로 쿼리 작성 가능) |
| slug별 그룹핑 | 제한적(`확인 필요`) | 자유로움 |
| 추가 인프라·비용 | 없음 | 테이블 하나(PRODUCT_SPEC §17 운영비 시나리오에 사실상 영향 없는 수준으로 추정) |

**권장**: MVP는 §4-1(Vercel Analytics)로 시작한다. §3 공식이 대시보드로 안 나와서 게이트 판단이 막히면, 그때 Supabase `events` 테이블로 전환한다(전환 비용은 `lib/analytics.ts`의 `track()` 구현부만 바꾸면 되도록 인터페이스를 도구 무관하게 설계한다, §4-3).

### 4-3. `lib/analytics.ts` 인터페이스

```ts
export type AnalyticsEventName =
  | 'app_open' | 'song_search' | 'song_added' | 'calc_changed'
  | 'ticket_created' | 'share_created' | 'share_viewed' | 'fork_saved'
  | 'history_marked' | 'pwa_install_shown' | 'pwa_install_accepted' | 'return_visit';

export function track(name: AnalyticsEventName, props?: Record<string, string | number>): void;
```

- **미설정 시 no-op.** 계측 도구(Vercel Analytics 등) 초기화가 안 됐거나 env가 비어 있으면 `track()`은 아무것도 하지 않고 조용히 반환한다.
- **콘솔 출력 금지.** 개발 환경이라도 `console.log`로 이벤트를 대신 찍지 않는다(API_CONTRACT §5 공통 규칙 "콘솔에도 남기지 않는다"와 동일 원칙을 계측에도 적용) — 확인이 필요하면 실제 도구의 개발자 대시보드/네트워크 탭으로 본다.
- **오프라인 시 드롭(큐잉 안 함).** 이벤트 전송이 실패하면(오프라인 등) 그냥 버린다 — 재시도 큐를 만들지 않는다.
  - 근거: (1) 이 계측은 절대적 카운트가 아니라 §3의 **비율** 지표라 소수 이벤트 손실이 결론을 바꿀 만큼 민감하지 않다. (2) 큐잉하려면 Dexie에 계측용 테이블을 새로 만들어야 하는데, 그러면 ARCHITECTURE §2의 "Dexie=영속 개인 데이터"라는 경계에 "영속 계측 데이터"라는 이질적 카테고리가 섞인다. (3) MVP 범위(§1)에서 손실 감내가 인프라 복잡도보다 싸다.

---

## 5. 프라이버시

- **익명, 이벤트 단위(디바이스 단위 아님)**: 이벤트에는 `deviceId`(ARCHITECTURE §4-1)를 싣지 않는다 — 서버 쪽에서 "이 이벤트들이 같은 사람 것"이라고 연결할 수 있는 키를 보내지 않는다. `return_visit` 판정조차 로컬에서 끝내고 결과(경과일)만 보내는 이유가 이것이다(§3-3).
- **쿠키 없음.** 계측은 쿠키 기반 세션 추적을 쓰지 않는다(Vercel Analytics는 쿠키리스 방식 — 채택 시 이 속성 유지가 선택 이유 중 하나).
- **개인정보처리방침과의 관계**: 실제 방침 문서 작성·게시는 BUILD_PLAN §10/§13 Phase 10 `HANDOFF.md`(사람 작업)의 몫이다 — 이 문서는 "무엇을 수집하는가"의 정본이고, 그것을 사용자에게 어떻게 고지할지는 HANDOFF로 넘긴다.
- **수집 최소화 원칙**(PRODUCT_SPEC §15 정합): 12종 외 이벤트를 즉흥적으로 추가하지 않는다(§1). 속성도 §2 표에 없는 필드를 임의로 얹지 않는다 — 필요해지면 이 문서(정본)를 먼저 갱신한다.

---

## 고찰

| 결정 | 근거 | 기각한 대안 |
|---|---|---|
| "클릭→방문 전환"을 직접 재는 대신 `share_viewed`/`fork_saved` 비율로 근사 | 클릭은 카톡/인스타 앱 내부에서 일어나 우리 계측 범위 밖 — 측정 불가능한 것을 측정하는 척하지 않는다(집필 규칙 5: 불확실한 사실 단정 금지) | UTM 파라미터로 클릭 추적 — 카톡 인앱 브라우저에서 파라미터가 씻겨나가는 경우가 실무적으로 흔함(`추정`)이고, 애초에 "링크 전달"이 카톡 텍스트 복붙일 수도 있어 신뢰 불가 |
| `return_visit` 판정을 서버가 아니라 클라이언트 로컬에서 수행 | §5 프라이버시 원칙(이벤트 단위, 디바이스 링크 없음)을 지키면서도 "같은 기기가 다시 왔다"는 판단 자체는 필요 — 판단을 로컬로 밀어내면 서버에 식별자를 보낼 필요가 없어진다 | 서버에 `deviceId` 포함 전송 후 서버 조인 — 재방문율은 정확해지지만 이벤트가 사실상 디바이스 단위 추적이 되어 §5 원칙과 충돌 |
| 오프라인 시 이벤트 드롭(큐잉 안 함) | §4-3에 상술 — 비율 지표의 손실 감내 vs Dexie 계측 테이블 신설의 경계 오염 트레이드오프에서 전자를 택함 | localStorage/Dexie 큐 + 재전송 — MVP 범위를 벗어나는 인프라, "성장 해킹 아님"이라는 §1 원칙과도 어긋남(정교한 계측 파이프라인은 이 단계에 안 맞음) |
| Vercel Analytics를 1순위로 권장 | 배포 스택과 이미 결합, 설정 비용 0에 수렴 — §1 "최소 계측" 목적과 가장 잘 맞음 | Supabase `events`부터 시작 — 정확한 SQL 집계는 매력적이나 마이그레이션·RLS까지 얹는 초기 비용이 "게이트를 빨리 재본다"는 목적에 안 맞음(필요해지면 전환 가능하도록 인터페이스만 도구 무관하게 설계, §4-3) |
| 12종 이벤트를 고정하고 확장하지 않음 | 프로젝트 확정 결정(작업 지시 §6) — 게이트와 직결되지 않는 이벤트는 "성장 해킹"으로 범위가 슬며시 넓어지는 통로가 됨 | 화면별 세분화 이벤트(예: 버튼별 클릭 전부) 추가 — 노이즈만 늘고 §3 공식에 안 쓰임 |

## 검증 체크리스트

- [ ] 코드베이스에서 `track(`를 grep했을 때 호출되는 이벤트명이 §2 표의 12종과 정확히 일치하는지(오탈자·추가 이벤트 없음)
- [ ] 각 이벤트 속성에 `title`/`artist`/`memo`/`tags` 등 텍스트 필드가 실려 있지 않은지(§2 공통 규칙) — payload 객체를 코드 리뷰로 확인
- [ ] `deviceId`가 어떤 `track()` 호출에도 속성으로 전달되지 않는지(§5) grep 확인
- [ ] 오프라인 상태에서 `track()` 호출 시 예외가 던져지지 않고 조용히 무시되는지 수동 테스트
- [ ] 계측 도구 미설정(env 없음) 상태로 앱을 띄웠을 때 콘솔에 아무 로그도 안 남는지(§4-3 "콘솔 출력 금지") 확인
- [ ] `return_visit`이 같은 날 두 번째 `app_open`에서는 발화하지 않고(§3-3 `daysSinceLastVisit >= 1` 조건), 다음날 이후 방문에서만 발화하는지 로컬 날짜 조작 테스트로 확인
- [ ] `share_viewed`가 `/s/[slug]` SSR 응답 자체가 아니라 클라 hydration 이후 1회만 발화하는지(중복 발화 없음) 확인

## 미결

- ~~`song_search` 발화 시점~~ → **해소(v1.0 리뷰)**: 응답 완료 시 1회 발화·`resultCount` 확정값으로 확정(§2).
- ~~`history_marked` 발화 화면~~ → **해소(v1.0 리뷰)**: `/ticket/[id]` 확정(§2).
- `calc_changed` 디바운스 시간(`추정` 500ms)은 실제 UI 반응성 테스트 후 조정 가능.
- PRODUCT_SPEC §20 게이트의 구체적 통과 임계값(예: 전환율 몇 % 이상)은 여전히 미정 — 이 문서가 아니라 PRODUCT_SPEC §20에서 확정할 사안.
- Vercel Analytics가 §3 공식(이벤트 간 비율)을 기본 대시보드에서 지원하는지는 `확인 필요` — 실제 도구 검증 후 §4-1 서술 갱신.
- ~~iOS에서 `pwa_install_shown` 발화 여부~~ → **해소(v1.0 리뷰)**: 플랫폼 무관 발화(`platform` 속성으로 구분), `pwa_install_accepted`만 안드로이드 한정으로 확정(§2).
