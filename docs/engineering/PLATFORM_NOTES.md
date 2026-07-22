# PLATFORM_NOTES.md — 싱송 플랫폼 특이사항 정본

> **v3 레거시 경고 (2026-07-21)**: 플랫폼 엣지 참고용이다. IME network pause, WebView/Safari/PWA 저장소 비연속성, paste import, 설치 카피는 [`../FINAL_BLUEPRINT.md`](../FINAL_BLUEPRINT.md) §3.3·§6.5·§7.3이 우선한다.

> 정본 범위: IME 처리·초성 검색 엣지케이스·브라우저/OS별 특이사항(iOS Safari 저장소 축출·카카오 인앱)·PWA 설치 동작. 계산 규칙·DDL·문구 원문은 여기 없음 — 각 정본 문서 참조.
> 버전 v1.0 · 2026-07-21
> 짝 문서: [`../engineering/ARCHITECTURE.md`](./ARCHITECTURE.md) §에러 전략 · [`../design/MICROCOPY.md`](../design/MICROCOPY.md) §4-2/§4-8 · [`../verification/TEST_PLAN.md`](../verification/TEST_PLAN.md)

---

## 1. 한글 IME 처리 (최우선)

### 1-1. 문제
한글은 자모가 조합되어 완성되는 입력 방식(IME)을 쓴다. 브라우저는 조합 중인 글자에 대해 `compositionstart` → (조합 중 `input` 이벤트 연속 발생) → `compositionend` 이벤트를 발생시킨다. 이 시퀀스를 무시하면 두 가지 버그가 생긴다.

1. **검색 디바운스가 조합 중간 글자에 반응해 깜빡이거나 이상한 쿼리를 던짐** — 이건 사실 큰 문제가 아니다(§1-3 참조, 오히려 자연스러운 부분·초성 매치로 허용).
2. **Enter 키로 검색/제출을 트리거하는 로직이 "조합 확정용 Enter"에 오발동함** — 이게 실제 버그다. 사용자가 한글 입력 중 마지막 글자를 조합 확정하려고 누른 Enter가 검색창의 "제출" 액션으로 잘못 해석될 수 있다.

### 1-2. 대응 원칙
- **디바운스 검색(자동완성)**: `input` 이벤트마다(조합 중 포함) 그대로 실행해도 된다 — §1-3.
- **명시적 제출 액션(Enter로 폼 submit, 검색 확정 등)**: `keydown` 핸들러에서 `e.nativeEvent.isComposing`(또는 네이티브 DOM이면 `event.isComposing`)을 반드시 확인해 조합 중이면 무시한다.

```tsx
// SearchInput.tsx — Enter 제출과 IME 조합 확정 Enter를 구분
function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return;

  // 조합 중(한글 자모가 아직 합성 중)인 Enter는 제출로 취급하지 않는다.
  // React 합성 이벤트가 아니라 반드시 nativeEvent.isComposing을 봐야 한다 —
  // 일부 브라우저(특히 구형 Android WebView)는 e.isComposing 자체가 부정확할 수 있음.
  if (e.nativeEvent.isComposing) return;

  submitSearch(inputValue);
}
```

- `compositionstart`/`compositionend`로 별도 `isComposingRef`를 직접 관리하는 방식도 가능(아래는 `isComposing` 플래그를 신뢰하기 어려운 구형 환경 대비 폴백):

```tsx
const isComposingRef = useRef(false);

<input
  onCompositionStart={() => { isComposingRef.current = true; }}
  onCompositionEnd={() => {
    // Safari 등 일부 환경은 compositionend가 Enter keydown보다 늦게 도착할 수 있어
    // 다음 tick으로 미뤄 keydown 핸들러가 최신 값을 보게 한다.
    queueMicrotask(() => { isComposingRef.current = false; });
  }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' && !isComposingRef.current && !e.nativeEvent.isComposing) {
      submitSearch(inputValue);
    }
  }}
/>
```

### 1-3. 안드로이드 `keyCode 229` 이슈
- 안드로이드(및 일부 모바일 IME)에서 조합 중 발생하는 `keydown`/`keyup` 이벤트의 `keyCode`(구식 속성)가 실제 키와 무관하게 **229로 고정**되어 온다. `event.key`도 `"Unidentified"`나 `"Process"`로 오는 경우가 있다.
- **대응**: `keyCode` 값 자체로 분기하는 로직을 만들지 않는다(레거시 API라 신뢰 불가). `isComposing` 플래그와 `key === 'Enter'` 조합만 신뢰한다. `keyCode`/`which`는 아예 참조하지 않는 것을 원칙으로 한다.
- 실제 기기별(삼성 키보드, 구글 Gboard 등) 세부 동작 차이는 `추정` — 실기기 테스트로 검증 필요(TEST_PLAN §e2e 모바일 항목 포인터).

### 1-4. 조합 중 디바운스 검색은 허용
- `compositionstart`~`compositionend` 사이에도 검색 디바운스(예: 200~300ms)를 그대로 돌리는 것은 **의도적으로 허용**한다. 초성 검색·부분 매치 특성상 "ㄴ" → "노" → "노래" 로 이어지는 중간 상태에서도 그럴듯한 결과가 뜨는 게 오히려 자연스럽다.
- 막아야 하는 건 오직 **"제출"에 해당하는 확정 동작**(Enter, 검색 버튼 즉시 클릭이 아닌 키보드 제출)이다. 마우스 클릭으로 결과를 선택하는 동작은 조합 상태와 무관하므로 별도 가드 불필요.

---

## 2. 초성 검색 엣지케이스

`chosung` 유틸(정확한 구현 위치는 ARCHITECTURE.md 폴더 구조 참조)이 처리해야 하는 입력 케이스 표. 각 케이스의 구체적 테스트 벡터·기대값은 `verification/TEST_PLAN.md`가 정본(여기서는 다뤄야 할 케이스 목록만 규정).

| # | 입력 패턴 | 예시 | 기대 동작(요약) | 비고 |
|---|---|---|---|---|
| 1 | 순수 초성만 | `ㄴㄹㄴㅁ` | "노래는 못참지" 류 초성 매치 후보에 포함 | 기본 케이스 |
| 2 | 완성형 한글만 | `노래방` | 일반 부분 문자열 매치(pg_trgm) | 초성 로직 미개입 |
| 3 | 완성형+초성 혼합 쿼리 | `노래ㅂ`, `ㄴ래방` | 혼합 입력은 초성 매치로 처리하지 않고 완성형 부분 매치로 폴백(안전한 기본값) | 혼합 입력의 정확한 처리 방식은 `확인 필요` — 초성 변환 후 재매치 시도까지 할지는 QA_MATRIX 리스크 등급에 따라 M2 이후 결정 |
| 4 | 쌍자음 초성 | `ㄲ`, `ㄸ`, `ㅃ`, `ㅆ`, `ㅉ` | 단자음과 동일하게 초성 후보로 인식(예: `ㄲ` → "까"로 시작하는 곡) | 쌍자음 19 초성 자모 전체 매핑 필요(ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ) |
| 5 | 영문/숫자 혼합 | `IU`, `2NE1`, `bts 정국` | 영문·숫자는 초성 변환 대상이 아니므로 원문 그대로 부분 매치. 한글 파트만 초성 분리 시도 | 아티스트명에 영문 표기가 흔함 — 대소문자 무시(§2 case) 필수 |
| 6 | 공백 포함 쿼리 | `아이유 밤편지`, `ㅇㅇㅇ ㅂㅍㅈ` | 공백 기준 토큰 분리 후 각 토큰 AND 매치(아티스트+제목 조합 검색을 자연스럽게) | 토큰 순서 무관 매치가 이상적이나 MVP는 순서 유지 매치도 허용 — `확인 필요` |
| 7 | 대소문자 | `IU` vs `iu` vs `Iu` | 영문 쿼리는 대소문자 무시(case-insensitive) 매치 | DB 컬레이션/쿼리 레벨에서 lower() 정규화 |
| 8 | 자모 미완성 입력 중(IME 조합 중간 상태) | "안" 입력 도중의 "ㅇ", "아" 등 중간 스냅샷 | §1-4에 따라 그대로 디바운스 검색에 태움 — 별도 예외처리 불필요 | IME 절과 연결되는 지점 |
| 9 | 특수문자·이모지 섞인 쿼리 | `아이유♥`, `방탄소년단!!` | 특수문자는 검색 전 sanitize로 제거하거나 무시(SECURITY.md의 입력 검증 원칙과 연동) | sanitize 구체 규칙은 SECURITY.md 소관 — 여기서는 "제거 대상"이라는 사실만 명시 |
| 10 | 빈 문자열/공백만 | ``, `   ` | 검색 실행 안 함(요청 자체를 보내지 않음) — MICROCOPY 빈 상태 문구 대상 아님 | 0글자 쿼리는 API_CONTRACT §5 "빈 검색 결과"와 다른 케이스(요청 미발생) |

- 초성 매핑 테이블(19개 초성 자모 유니코드 범위)과 실제 알고리즘 구현은 이 문서 소관이 아니다 — ARCHITECTURE.md 폴더 구조에 `lib/chosung.ts` 등으로 위치할 것으로 `추정`.

---

## 3. iOS Safari 저장소 축출 (최대 플랫폼 리스크)

### 3-1. 문제의 본질 — ITP 7일 규칙
Safari의 Intelligent Tracking Prevention(ITP)은 **사용자가 7일 연속으로 해당 사이트를 방문하지 않으면 그 사이트의 스크립트로 기록된 클라이언트 사이드 저장소(LocalStorage, IndexedDB 등)를 삭제**하는 정책을 갖고 있다. 싱송은 IndexedDB(Dexie)에 리스트·히스토리를 로컬 우선으로 저장하므로, **사용자가 일주일 넘게 재방문하지 않으면 브라우저 탭으로 열었던 경우 데이터가 통째로 사라질 수 있다.**

- 이 정책은 "일반 브라우저 탭"으로 열었을 때 적용되는 것이며, **PWA로 홈 화면에 설치되어 독립 실행(standalone display mode)되는 경우는 이 삭제 정책에서 면제**된다고 알려져 있다(Apple의 공식 문서 기준 홈 화면 앱은 일반 Safari 탭과 다른 저장소 취급을 받음). 다만 iOS/Safari 버전별로 정책이 조정되어 온 이력이 있어 **정확한 면제 조건과 예외는 `확인 필요`** — 최신 WebKit 릴리스 노트 확인 권장.
- 사파리 브라우저 탭에서 PWA를 쓰는 사용자(설치하지 않은 사용자)에게는 이 리스크가 그대로 적용된다는 전제로 설계한다.

### 3-2. `navigator.storage.persist()` 대응 전략
`navigator.storage.persist()`는 브라우저에 "이 오리진의 저장소를 자동 삭제 대상에서 제외해달라"고 요청하는 표준 API다.

```ts
// lib/storage.ts (위치는 ARCHITECTURE.md 폴더 구조 정본을 따를 것 — 추정)
async function requestPersistentStorage(): Promise<boolean> {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) {
    return false; // API 미지원 브라우저
  }
  const alreadyPersisted = await navigator.storage.persisted();
  if (alreadyPersisted) return true;
  return navigator.storage.persist();
}
```

- **호출 시점**: 앱 첫 진입 직후가 아니라, **사용자가 실제로 저장할 가치가 있는 행동을 한 직후**(예: 첫 곡을 리스트에 담은 시점)에 호출하는 것을 권장 — 브라우저 휴리스틱이 "이 사이트와의 인게이지먼트"를 근거로 승인 여부를 판단하는 경향이 있기 때문(High engagement 사용자에게 더 잘 승인된다는 통념). 정확한 승인 알고리즘은 브라우저 비공개 로직이라 `추정`.
- **성공률 한계를 정직하게 기술**: 이 API는 **호출한다고 보장되지 않는다.** 특히 Safari/WebKit은 Chrome 계열보다 자동 승인 기준이 훨씬 보수적이라고 알려져 있고(북마크 추가, 홈 화면 추가, PWA 설치, 알림 권한 허용 등 "몰입도 신호"가 쌓여야 승인 확률이 오른다는 보고가 있음), **일반 Safari 탭에서 이 API 하나만 호출해서는 영속성이 사실상 보장되지 않는다고 봐야 한다**. 성공/실패 여부와 실제 Safari 승인율 수치는 `확인 필요`(공식 수치 없음, 실측 필요).
- 따라서 이 API는 **보조 수단**이지 근본 대책이 아니다.

### 3-3. 근본 대응은 PWA 설치 유도
`navigator.storage.persist()`가 신뢰할 수 없는 이상, **iOS에서 데이터 보존의 실질적 근본 대응은 "홈 화면에 추가(PWA 설치)"를 유도하는 것**이다. 설치된 PWA는 ITP의 7일 삭제 정책 적용 대상에서 벗어난다고 알려져 있으므로(§3-1), 설치율을 올리는 것이 저장소 축출 문제의 실제 해법이다. §4의 설치 유도 UX, MICROCOPY §4-8(`common.persist.warning.*`), §4-8 PWA 배너 문구와 연동해서 설계해야 한다.

### 3-4. 대응 우선순위 표

| 우선순위 | 대응 | 효과 | 비용 |
|---|---|---|---|
| 1 | PWA 설치 유도(홈 화면 추가) — §4 | 근본 해결(ITP 삭제 정책 면제로 추정) | UX 설계·설치 배너 노출 타이밍 튜닝 |
| 2 | `navigator.storage.persist()` 호출(첫 인게이지먼트 시점) | 보조적 개선, Safari에서 성공률 낮음(`확인 필요`) | 구현 비용 매우 낮음 — 무조건 넣는다 |
| 3 | 데이터 유실 경고 노출(MICROCOPY `common.persist.warning.*`) | 사용자 기대치 관리, 실제 데이터는 보호 못 함 | 낮음 |
| 4 | 서버 백업 옵션(클라우드 동기화, 가입 필요) | 완전 해결이지만 PRODUCT_SPEC §11 신원 전략상 "가입 없는 코어 루프" 원칙과 충돌 — 지연 가입 이후 단계에서만 | 큰 비용, MVP 범위 아님(BUILD_PLAN §1 제외 항목과 연동 확인 필요) |

---

## 4. PWA 설치 UX 차이 (안드로이드 vs iOS)

### 4-1. 안드로이드(Chrome 계열) — `beforeinstallprompt`
- Chrome/Edge 등은 PWA 설치 조건(manifest 유효성, HTTPS, 서비스워커 등)이 충족되면 `beforeinstallprompt` 이벤트를 발생시킨다. 이 이벤트를 `preventDefault()`로 가로채 저장해뒀다가, 앱이 원하는 시점(예: 리스트에 곡을 3개 이상 담았을 때 등 — 정확한 트리거 조건은 ANALYTICS.md/기획 소관)에 `prompt()`를 호출해 네이티브 설치 다이얼로그를 띄운다.

```ts
let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  showInstallBanner(); // MICROCOPY pwa.install.banner.* 문구 사용
});

async function onInstallClick() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice; // 'accepted' | 'dismissed'
  // outcome을 계측(pwa_install_accepted 등, ANALYTICS.md 이벤트명 정본)에 연결
  deferredPrompt = null;
}
```

- 이벤트가 발생하지 않으면(이미 설치됨, 조건 미충족 등) 배너 자체를 노출하지 않는다.

### 4-2. iOS Safari — 수동 설치(공유 시트 → 홈 화면에 추가)
- iOS Safari는 `beforeinstallprompt`를 지원하지 않는다(`확인 필요` — WebKit이 향후 지원할 가능성은 배제 못 하나 현재 기준 미지원 전제). 네이티브 설치 다이얼로그를 코드로 띄울 방법이 없다.
- **대응**: iOS로 감지되면(UA 스니핑 또는 `navigator.standalone` 부재 등으로 판별 — 정확한 감지 로직은 `확인 필요`, UA 스니핑은 SECURITY.md 원칙과 충돌 소지 없는지 교차 확인) 코드로 트리거하는 대신 **수동 안내 시트**를 보여준다: "공유 버튼 → 홈 화면에 추가" 2단계 안내(MICROCOPY `pwa.install.ios.step1/2`).
- 이미 standalone 모드로 실행 중인지(`window.navigator.standalone === true` 또는 `matchMedia('(display-mode: standalone)').matches`)를 확인해, 이미 설치된 상태라면 배너 자체를 숨긴다.

### 4-3. 분기 로직 요약

| 플랫폼 | 감지 | 설치 트리거 | UI |
|---|---|---|---|
| 안드로이드 Chrome/Edge | `beforeinstallprompt` 이벤트 수신 여부 | `deferredPrompt.prompt()` | 배너 CTA 클릭 → 네이티브 다이얼로그 |
| iOS Safari | UA/`navigator.standalone` 기반 추정(`확인 필요`) | 없음(수동) | 배너 CTA 클릭 → 앱 내 안내 시트(2단계 이미지/텍스트) |
| 이미 설치됨(standalone) | `display-mode: standalone` 매치 | — | 배너 미노출 |
| 데스크톱/미지원 브라우저 | 위 조건 모두 불충족 | — | 배너 미노출(또는 낮은 우선순위 안내 — `확인 필요`) |

---

## 5. 카카오톡 인앱 브라우저

싱송 링크가 카카오톡 채팅방에 공유되면 사용자는 카카오톡 내장 웹뷰(인앱 브라우저)로 열게 되는 경우가 많다. 인앱 브라우저는 일반 모바일 Safari/Chrome과 API 지원 범위가 다르다.

### 5-1. Web Share API 미지원 → 링크 복사 폴백
- 카카오톡 인앱 웹뷰는 `navigator.share()`(Web Share API)를 지원하지 않거나 동작이 불안정한 경우가 있다(`확인 필요` — 카카오 인앱 웹뷰 버전별 편차 존재 가능).
- **대응**: `navigator.share` 존재 여부와 `navigator.canShare` 결과를 확인 후 미지원이면 클립보드 복사(`navigator.clipboard.writeText`)로 폴백하고 MICROCOPY `ticket.share.kakao.fallback.toast`("카톡 공유 대신 링크를 복사했어") 문구를 노출한다.
- 클립보드 API 자체도 인앱 웹뷰에서 권한 이슈로 실패할 수 있어, 최종 폴백은 텍스트 선택 가능한 링크를 화면에 노출하는 방식까지 고려(`확인 필요`, 실기기 테스트 필요).

### 5-2. 파일 다운로드(PNG) 제약
- 카카오톡 인앱 웹뷰는 `<a download>` 속성이나 Blob URL 기반 파일 다운로드가 제한되거나 무시되는 경우가 보고된다(`확인 필요` — 정확한 실패 양상은 실기기 검증 필요).
- **대응**: 티켓 이미지 저장(`ticket.share.image`) 버튼을 인앱 브라우저에서 눌렀을 때 다운로드가 실패하면, "외부 브라우저에서 열기" 유도로 전환(§5-3).

### 5-3. 외부 브라우저 열기 유도 시점
- 인앱 브라우저 감지(카카오톡 UA 패턴 매칭 — 예: UA에 `KAKAOTALK` 포함, 정확한 패턴은 `확인 필요`)는 앱 진입 시 항상 체크하되, **배너를 즉시 띄우지 않는다.** 사용자가 실제로 인앱 브라우저의 제약에 부딪히는 행동(이미지 저장 시도, 공유 시도)을 할 때 그 시점에 맞춰 "외부 브라우저에서 열기" 안내를 노출하는 것을 원칙으로 한다 — 진입 즉시 배너를 띄우면 이탈률만 올릴 위험(`추정`, ANALYTICS.md 지표로 검증 필요).
- 카카오는 자체적으로 "다른 브라우저로 열기" 메뉴를 웹뷰 우측 상단에 제공하므로, 싱송이 직접 리다이렉트를 강제하기보다는 **안내만 하고 사용자가 선택하게** 한다(강제 리다이렉트는 카카오 정책·사용자 경험 양쪽에서 리스크).

### 5-4. Kakao JS SDK 로드 전략(지연 로드)
- Kakao SDK(`https://developers.kakao.com/sdk/js/kakao.js` 등)는 티켓/공유 화면 진입 전에는 필요 없다. **홈·검색 등 다른 화면의 초기 로딩 성능을 위해 SDK 스크립트는 티켓 화면(`/ticket/[id]`) 진입 시점 또는 "카톡 공유" 버튼에 실제 인터랙션이 일어나기 직전에 동적 로드**한다(`next/script`의 `lazyOnload` 전략 또는 사용자 클릭 시 동적 `<script>` 삽입).
- SDK 초기화 키(JavaScript 키)는 공개 키이므로 클라이언트 노출 자체는 문제가 아니나, 관리 방식은 SECURITY.md의 env 규칙을 따른다(이 문서는 로드 "시점" 전략만 규정).

---

## 6. html-to-image 사용 시 주의

싱송 티켓 이미지 저장(BUILD_PLAN §11-4)은 `html-to-image`로 DOM을 캔버스에 그려 PNG로 변환한다.

### 6-1. 폰트 로딩 완료 대기
- `html-to-image`는 호출 시점에 DOM을 스냅샷하므로, **Pretendard 웹폰트(self-host, 규칙 §7 및 프로젝트 확정 결정 참조)가 아직 로드되지 않은 상태에서 캡처하면 폴백 시스템 폰트로 렌더된 이미지가 저장**될 수 있다.
- **대응**: `document.fonts.ready` Promise를 캡처 직전에 `await`한다.

```ts
async function exportTicketImage(node: HTMLElement) {
  await document.fonts.ready; // Pretendard 등 self-host 폰트 로딩 완료 보장
  const dataUrl = await toPng(node, { pixelRatio: 2 });
  // ... 다운로드 트리거
}
```

- `document.fonts.ready`만으로 부족한 경우(특정 브라우저에서 즉시 resolve되는 버그 보고 사례 있음, `확인 필요`)를 대비해, 캡처 대상 텍스트가 실제로 목표 폰트로 렌더되는지 `document.fonts.check('1em Pretendard')` 등으로 이중 확인하는 방어적 패턴도 고려할 수 있다.

### 6-2. 외부 이미지(앨범아트) CORS로 인한 PNG 오염 방지
- Canvas는 CORS 미허용 외부 이미지를 그리면 "tainted canvas"가 되어 `toDataURL`/`toPng` 자체가 실패하거나 빈 이미지를 반환한다. iTunes 앨범아트 URL(PRODUCT_SPEC §13)은 싱송이 호스팅을 통제하지 않으므로 CORS 헤더를 보장할 수 없다.
- **대응(원칙)**: **티켓 이미지에는 외부 이미지(앨범아트 등)를 포함하지 않는다.** 이는 DESIGN_SYSTEM/COMPONENTS의 티켓 시각 규칙(정본: 각 문서)과도 정합해야 하는 제약 조건이며, 이 문서는 "왜 외부 이미지를 넣으면 안 되는가"의 기술적 근거(CORS 오염)만 제공한다. 티켓 카드는 텍스트·아이콘·모노스페이스 숫자 등 자체 렌더 요소로만 구성한다.
- 만약 향후 앨범아트를 티켓에 넣기로 결정이 바뀐다면, `crossOrigin="anonymous"`로 이미지를 로드하고 iTunes가 해당 오리진에 대해 `Access-Control-Allow-Origin`을 실제로 내려주는지 사전 검증이 필요하다(`확인 필요` — 현재는 미검증, 원칙 자체가 이 검증을 회피하기 위한 결정).

### 6-3. Safari 렌더 차이
- `html-to-image`(및 유사 라이브러리)는 내부적으로 SVG `foreignObject`를 이용해 DOM을 이미지화하는데, Safari는 `foreignObject` 렌더링에서 다른 브라우저와 미묘한 차이(폰트 커닝, `border-radius` 클리핑, `box-shadow` 처리 등)를 보이는 사례가 보고되어 있다(`확인 필요` — 구체적 증상은 실기기 캡처 비교 필요).
- **대응**: iOS Safari 실기기(또는 시뮬레이터)에서 캡처 결과물을 다른 브라우저 결과물과 육안 대조하는 검증을 QA 단계(TEST_PLAN 시각 회귀 항목 포인터)에 포함한다. 완벽히 동일한 렌더를 보장할 수 없으므로, 티켓 디자인 자체를 `border-radius`/`box-shadow`처럼 크로스브라우저 편차가 큰 CSS 효과에 과도하게 의존하지 않는 방향으로 설계하는 것을 권장(디자인 상세는 DESIGN_SYSTEM 소관).

---

## 7. next/og 런타임 제약

BUILD_PLAN §11-4는 `app/s/[slug]/opengraph-image.tsx`를 `next/og`(`@vercel/og` 기반, Next.js 내장 `ImageResponse`)로 구현하도록 명시한다.

- **Edge 런타임 강제**: `next/og`의 `ImageResponse`는 Edge 런타임에서 동작하도록 설계되어 있다. Node.js 전용 API(파일시스템 직접 접근 등)를 opengraph-image 라우트 안에서 사용할 수 없다 — 폰트·데이터는 반드시 fetch 가능한 형태(정적 asset URL, 원격 fetch)로 공급해야 한다.
- **폰트 번들 제약**: 시스템 폰트가 아닌 커스텀 폰트(Pretendard 등, 프로젝트 확정 결정 §폰트 self-host 원칙)를 OG 이미지에 쓰려면 `ImageResponse`의 `fonts` 옵션에 폰트 파일 바이너리(ArrayBuffer)를 직접 전달해야 한다. Edge 런타임에서 로컬 폰트 파일을 읽어오는 방법(정적 import 후 fetch, 또는 배포 시 함께 번들되는 asset 경로)은 Next.js 버전에 따라 세부가 달라질 수 있어 **구현 시점에 최신 Next.js 문서 확인 필요**(`확인 필요` — Next.js 버전은 BUILD_PLAN §2 정본).
- **CSS 지원 범위 제한**: `ImageResponse`는 일반 브라우저 CSS 전체를 지원하지 않고 Satori(내부 렌더 엔진) 기반의 제한된 flexbox 서브셋만 지원한다. `grid`, 일부 `position` 값, 복잡한 `box-shadow` 등은 동작하지 않거나 무시될 수 있다 — OG 이미지 레이아웃은 티켓 실제 UI보다 단순화된 별도 구현이 필요하다는 전제로 설계한다.
- **응답 캐시**: OG 이미지 라우트는 매 요청마다 재생성되면 카카오톡 미리보기 로딩이 느려질 수 있다. `shared_lists`는 불변 스냅샷(API_CONTRACT §7 고찰)이므로 `slug` 단위로 캐시 헤더를 강하게 걸어도 안전하다 — 구체적 캐시 전략(revalidate 값 등)은 ARCHITECTURE.md/BUILD_PLAN 배포 설정 소관.

---

## 8. Web Share API 레벨 — 파일 공유 지원 편차

- `navigator.share()`는 텍스트/URL 공유는 폭넓게 지원되지만, **파일(이미지) 공유(`navigator.share({ files: [...] })`)는 브라우저·OS 조합별로 지원 여부가 갈린다.** 예: 데스크톱 브라우저 다수는 파일 공유 자체를 지원하지 않고, 모바일에서도 `navigator.canShare({ files })`가 `false`를 반환하는 조합이 있다(`확인 필요` — 정확한 지원 매트릭스는 브라우저 벤더 문서·caniuse 최신 상태 확인 필요, 이 문서 작성 시점 기준 완전한 매트릭스 단정 불가).
- **대응 원칙**: 이미지(PNG 티켓) 공유는 **다운로드 폴백을 기본 경로로 취급**한다. 즉 `ticket.share.image` 버튼은 "가능하면 Web Share files, 아니면 다운로드"가 아니라, **다운로드가 항상 안정적으로 동작하는 주경로이고 Web Share files는 지원되는 환경에서만 보조로 열리는 구조**로 설계한다.
- 링크 공유(`ticket.share.link`)는 파일이 아닌 URL 텍스트 공유이므로 Web Share API 지원 편차 문제가 훨씬 적다 — 다만 카카오 인앱 등 §5의 제약은 별개로 적용된다.

```ts
async function shareTicketImage(blob: Blob, fileName: string) {
  const file = new File([blob], fileName, { type: 'image/png' });
  const canShareFile = 'canShare' in navigator && navigator.canShare?.({ files: [file] });

  if (canShareFile) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      // 사용자 취소(AbortError)를 포함해 실패 시 다운로드로 폴백
    }
  }
  triggerDownload(blob, fileName); // 항상 동작하는 기본 경로
}
```

---

## 고찰

| 결정 | 근거 | 기각한 대안 |
|---|---|---|
| IME Enter 가드는 `isComposing` 우선, `keyCode` 참조 금지 | `keyCode`는 조합 중 229로 고정되는 레거시 동작이라 신뢰 불가. `isComposing`이 표준 스펙(UI Events)에 정의된 신뢰 가능한 플래그 | `keyCode === 229`로 조합 상태 판별 — 안드로이드 특정 상황에서만 맞고 다른 플랫폼에서 오판 위험 |
| 조합 중 디바운스 검색은 막지 않고 제출(Enter)만 막음 | 초성/부분 매치 검색 UX 특성상 조합 중간 상태도 유의미한 결과를 줄 수 있어 오히려 자연스러움 — 과도한 가드는 체감 반응성만 떨어뜨림 | 조합 중 모든 입력 이벤트를 무시 — 안전하지만 사용자가 타이핑하는 동안 검색이 멈춰있는 것처럼 보여 반응성 저하 |
| iOS 데이터 보존의 근본 대응을 "PWA 설치 유도"로 명시 | `navigator.storage.persist()`만으로는 Safari에서 보장이 안 된다는 게 업계 통설(정확한 수치는 미확인) — 유일하게 구조적으로 축출 정책 자체를 회피하는 경로가 홈 화면 설치이기 때문 | persist() API만 신뢰하고 설치 유도를 부가 기능으로 취급 — 최대 리스크(iOS 데이터 유실)를 부수적 대책으로만 다루면 근본 해결이 안 됨 |
| 티켓 PNG에 외부 이미지(앨범아트) 원천 미포함 | CORS 미보장 외부 리소스를 캔버스에 그리면 tainted canvas로 export 자체가 실패할 수 있음 — 검증되지 않은 CORS 헤더에 기능 성패를 걸지 않는 방어적 설계 | `crossOrigin="anonymous"` 시도 후 실패 시 폴백 — iTunes가 실제로 CORS 헤더를 내려주는지 사전 확인 없이 구현했다가 프로덕션에서 export 실패로 드러날 리스크 |
| 카카오 인앱 브라우저는 강제 리다이렉트 대신 안내만 | 카카오톡이 자체 "다른 브라우저로 열기" 메뉴를 제공하므로 앱이 임의로 리다이렉트를 강제하면 정책·신뢰도 리스크. 안내 후 선택권은 사용자에게 | 자동 리다이렉트 스크립트 삽입 — 인앱 브라우저 정책 변화에 취약하고 사용자 흐름을 강제로 끊는 부정적 경험 |
| Web Share files는 보조, 다운로드가 항상 주 경로 | 파일 공유 지원 편차가 커서 "지원되면 좋고 아니면 폴백"이 아니라 애초에 폴백을 기본 경로로 설계해야 전 환경에서 기능이 깨지지 않음 | Web Share files를 우선 경로로 삼고 실패 시에만 다운로드 — 지원 브라우저 비율이 낮으면 대부분의 사용자가 예외 경로만 타게 되는 설계 |

## 검증 체크리스트

1. **IME Enter 가드**: 실제 한글 IME(맥 한글 입력기, 안드로이드 Gboard 한글 키보드)로 검색창에 단어를 입력하며 마지막 글자 조합 확정 시점에 Enter를 눌러 검색이 오발동하지 않는지 수동 검증(TEST_PLAN e2e 모바일 항목 포인터).
2. **`keyCode` 미참조 grep**: 코드베이스에서 `keyCode`/`which` 참조 grep — 0건(§1-3 원칙 위반 여부 확인).
3. **초성 유틸 케이스 커버리지**: §2 표의 10개 케이스가 `verification/TEST_PLAN.md`의 chosung 유닛 테스트 목록에 1:1로 존재하는지 대조.
4. **`storage.persist()` 호출 확인**: 첫 곡 담기 시점 직후 `navigator.storage.persist()`가 실제로 호출되는지(Devtools Application 탭 또는 코드 리뷰)로 확인.
5. **PWA 배너 분기**: 안드로이드 Chrome 실기기/에뮬레이터에서 `beforeinstallprompt` 배너가, iOS Safari 실기기/시뮬레이터에서 수동 안내 시트가 각각 올바르게 노출되는지, 이미 설치된 상태(standalone)에서는 배너가 숨는지 3가지 상태 모두 수동 확인.
6. **카카오 인앱 폴백**: 실제 카카오톡 앱에서 공유된 링크를 열어 (a) 카톡 공유 버튼 폴백 토스트 노출, (b) 이미지 저장 실패 시 외부 브라우저 유도 안내가 뜨는지 수동 검증 — 자동화 어려움, TEST_PLAN 수동 시나리오로 등록.
7. **html-to-image 폰트 보장**: 캡처된 PNG를 육안으로 열어 Pretendard 폰트(시스템 폰트 폴백이 아님)로 렌더됐는지 확인 — 느린 네트워크 스로틀링 상태에서 특히 확인(폰트 로딩 지연 재현).
8. **CORS 오염 회귀 방지**: 티켓 카드 컴포넌트 코드에서 `<img>` 또는 `background-image`로 외부(iTunes 등) URL을 참조하는 곳이 있는지 grep — 0건이어야 함(§6-2 원칙 위반 여부).
9. **OG 이미지 200 응답**: `/s/[slug]/opengraph-image` 경로에 실제로 GET 요청을 보내 200과 유효한 이미지 바이너리가 오는지, 카카오 링크 프리뷰 디버거(또는 동등 도구)로 실제 미리보기가 뜨는지 확인(BUILD_PLAN §11-4 완료조건과 연동).
10. **Web Share files 폴백**: `navigator.share`/`canShare`를 강제로 `undefined` 처리한 환경(또는 지원 안 하는 브라우저)에서 이미지 저장 버튼이 다운로드로 정상 폴백하는지 확인.

## 미결

- iOS Safari의 정확한 ITP 홈 화면 설치 면제 조건과 최신 정책 변화(§3-1) — **실측 필요**, WebKit 릴리스 노트 최신본 확인.
- `navigator.storage.persist()`의 Safari 실제 승인율(§3-2) — 공개된 신뢰할 수치 없음, **실측 필요**(가능하면 자체 텔레메트리로 추정치 축적 — ANALYTICS.md 이벤트 스키마에 반영 여부는 기획 확인 필요).
- iOS 감지 로직(UA 스니핑 vs `navigator.standalone` 등, §4-2)의 구체적 구현 방식과 SECURITY.md UA 처리 원칙과의 정합 — **기획/엔지니어링 확인 필요**.
- 카카오톡 인앱 웹뷰의 Web Share API·다운로드 제약(§5-1, §5-2)의 정확한 실패 양상과 카카오 버전별 편차 — **실기기 실측 필요**, 이 문서의 서술은 업계에 알려진 일반적 패턴에 기반한 `추정`.
- next/og 폰트 바이너리 로딩 구현 세부(§7)는 Next.js 정확한 버전(BUILD_PLAN §2 정본) 확정 후 **구현 시점 재확인 필요**.
- Web Share API 파일 공유 지원 매트릭스(§8)의 최신 브라우저별 현황 — **실측 필요**(caniuse 등 최신 자료로 구현 직전 재확인).
- ~~혼합 입력(완성형+초성) 처리 정책~~ → **확정(v1.0 리뷰)**: MVP는 완성형 부분 매치 폴백만(§2 케이스 3의 안전 기본값 채택). 초성 변환 재시도 로직은 후속 — 실사용에서 혼합 쿼리 빈도가 관측되면 재검토.
