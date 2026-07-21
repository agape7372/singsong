# SECURITY.md — 보안 정본

> **정본 범위**: 위협모델 · XSS 대응 · 어뷰징 대응 · CSP · env·비밀 규칙 · takedown 운영 절차.
> 이 문서와 다른 문서(API_CONTRACT DDL 값, PRODUCT_SPEC §9 법적 리스크 포함)가 어긋나면, **DDL·RPC·RLS 값은 API_CONTRACT.md가 이기고, 곡 DB 법적 리스크 서술은 PRODUCT_SPEC.md가 이긴다.** 이 문서는 그 둘에 대한 위협모델·대응 관점만 정본이다.
> **버전**: v1.0 · 2026-07-21 · 짝 문서: [`API_CONTRACT.md`](./API_CONTRACT.md)(DDL·RLS·Zod 정본), [`ARCHITECTURE.md`](./ARCHITECTURE.md)(에러 전략)

---

## 0. 이 문서가 다루지 않는 것

- Postgres DDL·RLS 정책 SQL 원문 → `API_CONTRACT.md` §1, §3 (여기서는 값을 재서술하지 않고 포인터만 남긴다).
- 곡 DB 수집·법적 리스크 전략(크롤링·미러링·상표) → `PRODUCT_SPEC.md` §9, §16 (보안이 아니라 법무 정본. 이 문서는 "경계만" 표시하고 넘어간다).
- 계산 엔진 로직 → `BUILD_PLAN.md` §6.
- 문구 원문 → `design/MICROCOPY.md`(`design/` 디렉터리는 이 시점 `추정` — 실제 생성 여부는 저장소 상태에 따름).

---

## 1. 보호 자산 목록

| 자산 | 왜 중요한가 | 정본(값) |
|---|---|---|
| 공유 스냅샷 무결성 | `shared_lists.payload`가 위조·오염되면 카톡으로 퍼진 링크 전체가 손상된 콘텐츠를 보여준다. 제품의 핵심 바이럴 경로 | API_CONTRACT §1-3, §4 |
| 곡 카탈로그(`songs`) | 시드+델타로 축적한 자산. 통째 유출·조작 시 재구축 비용 + PRODUCT_SPEC §9 법적 리스크 재점화 | API_CONTRACT §1-2 |
| `service_role` 키 | 유출 시 RLS를 완전히 우회 — `songs`·`shared_lists` 전체 쓰기/삭제 가능 | §4 (본 문서) |
| 사용자 로컬 데이터(Dexie) | 리스트·노트·히스토리 — 서버로 전송되지 않는 개인 데이터. 기기 내부 위협(다른 탭·확장 프로그램의 IndexedDB 접근)이 주 벡터 | ARCHITECTURE §데이터 흐름 |
| 서비스 가용성 | 무인증 insert가 스토리지·요청량을 고갈시키면 전체 사용자에게 영향 | §2-3 (본 문서) |

**비자산(명시)**: **개인 계정이 없다.** 로그인·비밀번호·이메일·세션 토큰이 존재하지 않는 구조이므로, 계정 탈취·비밀번호 유출·세션 하이재킹·크리덴셜 스터핑 같은 인증 관련 공격면이 **설계상 원천 제거**된다. `created_by_device`(API_CONTRACT §1-3)는 익명 UUID이며 로그인이 아니다 — 이 값의 위조는 보안 경계가 아니라 통계 왜곡 정도의 영향만 가진다(§2-4).

---

## 2. 위협모델 표

| 위협 | 공격 벡터 | 영향 | 대응(설계) | 잔존 리스크 | 관련 정본 |
|---|---|---|---|---|---|
| **공유 payload XSS** | 공유 생성 시 `title`/`memo`/`tags`에 `<script>`나 이벤트 핸들러 문자열 주입 → 열람자가 `/s/[slug]` 방문 시 실행 | 열람자 브라우저에서 임의 스크립트 실행(쿠키 없음이라 세션 탈취는 불가하나, 피싱·리다이렉트·크립토재킹형 스크립트 가능) | ① React가 텍스트를 렌더할 때 기본 이스케이프(HTML 엔티티 변환)한다 — `title`·`memo`·`tags`는 항상 JSX 텍스트 노드(`{value}`)로만 렌더, `dangerouslySetInnerHTML` 전면 금지(ONESHOT_MASTER P5). ② `next/og` 티켓 이미지 생성과 `html-to-image` PNG export 경로도 동일 — 두 경로 모두 텍스트를 마크업으로 해석하지 않고 텍스트 노드/속성 값으로만 주입한다(구현 시 `next/og`의 JSX 트리와 `html-to-image` 캡처 대상 DOM 모두 React 렌더 결과여야 함 — 별도 문자열 조립·`innerHTML` 경유 금지). ③ CSP `script-src`로 인라인 스크립트 실행 자체를 추가 차단(§3) | **Zod(API_CONTRACT §4)는 스키마(타입·길이·형식)만 검증하고 문자열 *내용*은 걸러내지 않는다** — `title: z.string().min(1).max(60)`은 `<script>alert(1)</script>`도 통과시킨다. 따라서 방어선은 전적으로 "렌더 시 텍스트 노드만 사용"이라는 코딩 규율에 있다. 이 규율이 깨지는 리팩터(예: 마크다운 렌더러 도입, `innerHTML` 최적화)가 나오면 즉시 재노출된다 → 코드리뷰 체크리스트 항목화 필요(`추정`, TEST_PLAN 연계 확인 필요) | API_CONTRACT §4 |
| **slug 열거·크롤링** | slug가 짧거나 예측 가능하면 무차별 대입으로 전체 공유물을 수집 가능 | 비공개 의도였던 리스트까지 제3자가 대량 수집(단, 제품 전제상 "비공개 공유"라는 개념 자체가 없음 — 아래 잔존 리스크 참조) | `slug`는 `nanoid(10)`, 알파벳 62자 집합(`[A-Za-z0-9_-]`, API_CONTRACT §1-3 정규식과 동일 문자 집합) 기준 엔트로피 ≈ `log2(64^10)` = 60비트(nanoid 기본 알파벳은 64자: A-Za-z0-9_- ). 무작위 대입으로 유효 slug 1개를 맞출 확률은 사실상 0에 수렴(활성 레코드 수가 수백만이어도 공간 대비 무시 가능). 순차 ID·타임스탬프 기반 slug를 쓰지 않는 것이 핵심 대응 | **"공유 = 공개"가 제품 전제**(API_CONTRACT §3 주석)다. slug를 아는 누구나 열람 가능하도록 설계되어 있으므로, 링크가 카톡 오픈채팅방·커뮤니티에 재게시되면 열거 없이도 사실상 공개된다. 이는 열거 방어의 한계가 아니라 제품 설계 자체의 트레이드오프이며, 사용자 고지 문구는 UX_FLOWS §신뢰(`추정` — 미작성 시 기획 확인 필요) 소관 | — (엔트로피 계산은 본 문서, slug 생성 로직은 ARCHITECTURE 소관 `추정`) |
| **무인증 insert 어뷰징(스팸 스냅샷·저장소 폭증)** | anon key로 `shared_lists`에 반복 INSERT — 봇 스크립트가 최대 크기(32KB payload, 곡 100개)로 무한 생성 | 저장소 폭증(무료/저가 티어 한도 소진), 잠재적 비용 증가, DB 성능 저하 | ① 서버 CHECK(payload ≤32KB, 곡 ≤100, calc_snapshot ≤4KB — API_CONTRACT §1-3)로 요청 1건당 크기 상한. ② 클라 선검증(Zod, API_CONTRACT §4)으로 명백히 잘못된 요청은 서버 도달 전 차단(정상 사용자 실수 방지 목적이며 봇 방어는 아님) | **레이트리밋이 없다 — 이는 MVP가 의식적으로 수용하는 리스크다.** anon insert 빈도 제한(IP·디바이스 단위)이 현재 전무하므로, 봇이 스크립트로 반복 호출하면 크기 상한 내에서도 행(row) 수를 무한정 늘릴 수 있다. 후속 옵션(우선순위 미정, `추정`): (a) Vercel WAF의 rate-limit 룰, (b) Next.js 미들웨어에서 요청 빈도 제한(단, 로그인 없이 식별자가 IP뿐이라 우회 쉬움), (c) Cloudflare Turnstile 등 CAPTCHA 유사 챌린지를 공유 생성 버튼에 삽입. 셋 다 MVP 범위 밖 — 트래픽·어뷰징 실측 후 결정(기획 확인 필요) | API_CONTRACT §1-3 |
| **`fork_count` 오염** | `increment_fork(slug)` RPC를 스크립트로 반복 호출 → 특정 공유물의 fork 수치를 인위적으로 부풀림 | fork_count는 UI 상 "인기" 신호로 노출될 수 있는 통계 지표 — 부풀리면 신뢰도 왜곡 가능 | RPC가 `security definer`로 "카운트 +1"이라는 단일 연산만 허용(API_CONTRACT §2-2) — 임의 값 쓰기·다른 컬럼 변조 경로 자체가 없음 | **fork_count는 통계 지표일 뿐 보안 경계가 아니다.** 결제·권한·데이터 무결성 어느 것에도 영향을 주지 않으므로, 오염은 표시상 오차로만 수용한다(레이트리밋 없이 그대로 감수 — MVP 범위에서 대응 안 함, 확정) | API_CONTRACT §2-2 |
| **`service_role` 키 유출** | 저장소 커밋, 클라이언트 번들 노출, 잘못된 env 스코프 설정, CI 로그 노출 | RLS 완전 우회 — `songs`·`shared_lists` 임의 읽기/쓰기/삭제, 사실상 DB 전권 | `service_role`은 **로컬 env(시드 스크립트) 전용**이며 클라 번들·저장소에 절대 포함하지 않는다(API_CONTRACT §0-2). `.env*`를 `.gitignore`에 등록, `NEXT_PUBLIC_` 접두사가 붙은 값만 클라 번들에 포함되는 Next.js 관례를 그대로 따름(§4 표) | 로컬 개발자 PC의 `.env.local` 파일 유출(기기 도난·잘못된 공유)은 이 설계로 막을 수 없음 — 개발자 개인 보안 수칙(디스크 암호화 등)에 의존. 키 로테이션 절차는 HANDOFF 소관(§6) | §4 (본 문서) |
| **의존성 공급망 공격** | npm/pnpm 패키지의 악성 코드 삽입(typosquatting, 유지보수자 계정 탈취 등) | 빌드 타임 또는 런타임에 임의 코드 실행 — 최악의 경우 `service_role` 키가 있는 CI 환경까지 노출 가능 | `pnpm-lock.yaml` 커밋(재현 가능한 의존성 트리 고정) + CI에서 `pnpm audit`(또는 동등 도구) 실행해 **high 이상 취약점 발견 시 빌드 실패**시키는 정책. 신규 의존성 추가는 ONESHOT_MASTER "임의 스택 추가 금지" 원칙과 결합해 최소화 | `pnpm audit`는 알려진 CVE만 탐지 — 제로데이·아직 신고되지 않은 악성 패키지는 탐지 못함. CI 파이프라인 구체 설정(어느 워크플로 파일에 넣을지)은 `추정`, 구현 시 확정 | 본 문서(정책), 구체 CI 파일은 ARCHITECTURE/구현 소관 `확인 필요` |
| **곡 DB 수집·삭제요청의 법적 리스크** | (보안 경계 아님 — 경계 표시만) TJ/금영 DB 통째 미러링 시 데이터베이스제작자권 침해 주장 가능성 | 법적 분쟁, 서비스 중단 요구 | PRODUCT_SPEC §9 권장 전략(시드+사용자기여+델타, 통째 미러링 금지) | 본 문서 소관 아님 | **PRODUCT_SPEC.md §9, §16** — 이 표에 실은 것은 "보안 문서가 이 리스크를 인지하고 있다"는 경계 표시일 뿐, 대응 내용은 정본(PRODUCT_SPEC)을 따른다 |

---

## 3. CSP 초안

`next.config`(TS/JS 확장자는 구현 시 확정, `추정`)의 `headers()` 함수에서 설정한다. 아래는 **초안**이며 각 지시어의 정확한 값은 실제 도입 도메인(Kakao SDK, Supabase 프로젝트 URL, iTunes 아트워크 CDN)에 맞춰 구현 시 조정한다.

```js
// next.config.js (또는 .ts) — headers() 예시, 구현 시 실제 도메인으로 치환
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Kakao 공유 SDK 스크립트 로딩. 정확한 서브도메인은 카카오 개발자 문서 확인 필요
      "script-src 'self' https://developers.kakao.com https://t1.kakaocdn.net",
      // 앨범아트: 애플 CDN. mzstatic 서브도메인은 지역별로 다를 수 있어 와일드카드. data: 는 next/og·플레이스홀더용
      "img-src 'self' data: https://*.mzstatic.com",
      // Supabase 프로젝트 REST/Realtime + Kakao 공유 API 호출
      "connect-src 'self' https://*.supabase.co https://kapi.kakao.com",
      // Tailwind 빌드 산출물은 기본적으로 외부 스타일시트 요청 없음. 인라인 style 속성 필요 여부는 구현 시 검증
      "style-src 'self'",
      "font-src 'self'",                 // Pretendard self-host(§4 참고) — 외부 폰트 요청 0
      "frame-ancestors 'none'",          // 다른 사이트의 iframe에 삽입 금지(clickjacking 방지)
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },        // MIME 스니핑으로 인한 콘텐츠 타입 오인 실행 방지
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, // 외부 링크 클릭 시 slug가 포함된 풀 URL이 Referer로 새는 것을 완화
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }, // 이 앱이 쓰지 않는 브라우저 기능을 명시적으로 차단(공급망 스크립트가 몰래 요청하는 것도 방지)
];
```

각 지시어가 왜 필요한지:

| 지시어 | 이유 |
|---|---|
| `script-src` | 인라인 스크립트·`eval` 계열을 기본 차단해 §2 XSS 대응의 두 번째 층을 만든다. Kakao SDK가 자체 도메인에서 스크립트를 로드하므로 해당 도메인만 명시 허용 |
| `img-src` | 앨범아트는 iTunes(애플) CDN에서만 로드(BUILD_PLAN §10-3 미디어 원칙). `*.mzstatic.com`이 실제 사용 도메인인지는 `확인 필요`(iTunes Search API 응답의 `artworkUrl100` 등 실측 필요) |
| `connect-src` | fetch/XHR 대상을 Supabase 프로젝트와 Kakao API로 한정 — 악성 스크립트가 삽입되더라도 임의 서버로 데이터를 빼돌리기 어렵게 함 |
| `style-src` | Tailwind는 빌드 타임에 CSS 파일로 산출되므로 원칙적으로 `'self'`로 충분. **인라인 스타일(`style=` 속성)이나 `styled-jsx` 등이 실제로 inline `<style>` 태그를 필요로 하는지는 구현 시 검증** — 필요하다면 `'unsafe-inline'` 대신 nonce/hash 방식을 우선 검토 |
| `frame-ancestors 'none'` | 이 앱을 다른 사이트가 iframe으로 감싸 클릭재킹에 악용하는 것을 차단. 티켓 공유가 목적상 외부 임베드를 요구하지 않음 |
| `X-Content-Type-Options` | 브라우저가 응답의 `Content-Type`을 무시하고 실행 가능한 타입으로 재해석하는 것을 막음 |
| `Referrer-Policy` | slug가 포함된 URL(`/s/[slug]`)에서 외부 링크를 클릭했을 때 전체 URL이 제3자 서버 로그에 노출되는 것을 줄임 |
| `Permissions-Policy` | 카메라·마이크·위치는 이 제품이 전혀 쓰지 않음(PRODUCT_SPEC §16 "위치정보 미취급") — 공급망 취약점으로 삽입된 스크립트가 이런 권한을 몰래 요청해도 브라우저 레벨에서 차단 |

**인라인 스타일/스크립트 필요성은 구현 시 검증**해야 한다: Next.js App Router·Tailwind v4 조합에서 CSS-in-JS나 `next/font` 관련 인라인 태그가 자동 삽입될 수 있으며, 이 경우 `'unsafe-inline'` 대신 Next.js가 제공하는 nonce 메커니즘 사용을 우선 검토한다(`확인 필요`).

---

## 4. env·비밀 규칙 표

| 값 | 노출 범위 | 예시 | 규칙 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개(클라 번들 포함) | Supabase 프로젝트 REST 엔드포인트 | 공개 전제 — 프로젝트 URL 자체는 비밀이 아님 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개(클라 번들 포함) | Supabase anon key | RLS(API_CONTRACT §3)로 권한이 이미 제한되어 있으므로 공개되어도 anon 권한 이상은 못함 — **RLS가 뚫리면 이 키의 공개 여부와 무관하게 위험**하므로 RLS 정책 변경 시 리뷰 필수 |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 공개(클라 번들 포함) | 카카오 JS SDK 키 | 카카오 플랫폼 자체가 JS 키를 클라 노출 전제로 설계(도메인 화이트리스트로 방어) — Kakao Developers 콘솔에서 허용 도메인 등록 필요(§6) |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버·로컬 전용, 클라 번들 절대 금지** | 시드 스크립트(`scripts/seed/`, API_CONTRACT §6)용 | `.env.local`에만 두고 커밋 금지. CI에서 시드를 자동화한다면 CI 시크릿 스토어(예: GitHub Actions Secrets)에 등록 — 저장소 파일로는 절대 존재하지 않음 |
| 기타 향후 키(결제·이메일 등) | MVP 범위 밖 | — | 현재 로그인·결제 없음(BUILD_PLAN §10 env 목록에 §10 언급 항목 외 없음) — 추가 시 이 표를 갱신 |

**공통 규칙**:
- `.env*`(단 `.env.example` 제외 — 값 없는 키 목록만 커밋)를 `.gitignore`에 등록한다.
- `NEXT_PUBLIC_` 접두사가 붙은 값만 클라 번들에 포함된다는 Next.js 관례를 그대로 신뢰 — 접두사 없는 키에 실수로 `NEXT_PUBLIC_`을 붙이지 않도록 PR 리뷰 시 env 변수명을 확인한다(`추정`: 자동 린트 규칙은 미정, 구현 시 검토).
- **키 로테이션 절차(발급·교체·무효화 실행)는 사람 몫**이며 이 문서의 범위가 아니다 — HANDOFF 문서(§6, 구현 시 저장소 루트에 생성) 소관.

---

## 5. takedown·운영 절차

### 5-1. 공유물 신고 접수(MVP: 이메일)
1. 앱 내 어딘가(UX_FLOWS·MICROCOPY 소관, `확인 필요` — 위치 미정)에 신고용 연락처(이메일 주소)를 노출한다.
2. 신고 접수 시 운영자가 대상 `slug`를 확인하고, `service_role` 키로 `shared_lists`에서 해당 행을 직접 DELETE한다(anon에는 DELETE 정책이 없으므로 API_CONTRACT §3, 운영자만 가능한 경로).
3. MVP 단계에서는 신고 접수용 관리자 UI를 만들지 않는다 — Supabase 대시보드(SQL Editor 또는 Table Editor)에서 수동 삭제(`추정`: 신고 볼륨이 유의미해지면 관리자 페이지 검토, 기획 확인 필요).
4. 삭제된 slug로의 접근은 API_CONTRACT §5 "slug 없음(공유 뷰)" 에러 계약과 동일하게 404로 처리된다 — 별도 "삭제됨" 상태를 구분하지 않는다(MVP 단순화, `확인 필요`).

### 5-2. 곡 DB 삭제 요청 대응
- TJ/금영 또는 저작권자로부터 특정 곡 정보 삭제 요청이 오면, 운영자가 `service_role`로 `songs`에서 해당 행을 삭제한다.
- 해당 곡이 이미 어떤 `shared_lists.payload`에 스냅샷(비정규화 사본, API_CONTRACT §7)으로 박혀 있다면, 원본 삭제와 무관하게 기존 공유물에는 그 사본이 남는다 — 이는 설계상 트레이드오프(API_CONTRACT §7 "payload 비정규화" 고찰 참조)이며, 곡 단위 소급 삭제까지 전파하는 절차는 **MVP 범위 밖**(`확인 필요`).
- 삭제 요청의 법적 근거·수집 정책 전반은 **PRODUCT_SPEC §9** 소관 — 이 절은 "서버에서 실제로 무엇을 지우는가"라는 실행 절차만 다룬다.

### 5-3. 절차 요약
```
신고/요청 접수(이메일)
  → 운영자가 대상 식별(slug 또는 songs.id)
  → Supabase 대시보드에서 service_role로 직접 DELETE
  → (곡 삭제 시) PRODUCT_SPEC §9 정책과 일치하는지 재확인
  → 신고자에게 처리 완료 회신
```

---

## 6. 사람 몫 절 (HANDOFF 연계)

아래 항목은 코드로 자동화할 수 없고 **사람이 콘솔에서 직접 확인·설정**해야 한다. 구현 완료 시 저장소 루트 `HANDOFF.md`(README §1 문서 트리에는 없으나 ONESHOT_MASTER Phase 10 산출물로 언급됨, `추정`)에 체크리스트로 옮겨 담는다.

- [ ] Supabase 프로젝트 생성 후 `anon`/`service_role` 키 발급 확인, `service_role` 키가 어떤 저장소·CI 로그에도 노출되지 않았는지 재검사
- [ ] Supabase RLS가 `songs`·`shared_lists` 두 테이블 모두 **enable**되어 있는지 대시보드에서 육안 확인(마이그레이션 파일이 배포에 실제 적용됐는지 별도 검증 — API_CONTRACT §3)
- [ ] Supabase 프로젝트의 Postgres 버전·확장(`pg_trgm`) 활성화 확인
- [ ] Kakao Developers 콘솔에서 JS 키의 "허용 도메인"에 실제 배포 도메인(Vercel 프로덕션 URL, 커스텀 도메인)을 등록 — 미등록 시 공유 기능이 프로덕션에서만 조용히 실패할 수 있음
- [ ] Vercel 프로젝트 env에 `NEXT_PUBLIC_*` 세 개 + (CI 시드 자동화 시) `SUPABASE_SERVICE_ROLE_KEY`를 Secret으로 등록, Preview/Production 스코프 분리 검토
- [ ] `pnpm audit` 정책을 CI(예: GitHub Actions)에 실제로 연결 — 이 문서는 정책만 명시하고 워크플로 파일 자체는 만들지 않음
- [ ] 신고 접수용 이메일 주소를 실제로 확보하고 MICROCOPY/UX_FLOWS에 반영되었는지 교차 확인
- [ ] 키 로테이션 절차(주기·트리거 조건) 수립 — 이 문서는 로테이션이 "사람 몫"이라는 것만 명시하고 절차 자체는 정의하지 않음(`기획 확인 필요`)

---

## 7. 고찰

| 결정 | 근거 | 기각한 대안 |
|---|---|---|
| 레이트리밋 없음을 "수용 리스크"로 명시 | 로그인이 없어 사용자 식별자가 IP뿐이고, MVP 단계에서 미들웨어 rate-limit을 넣어도 우회가 쉬워 실효성 대비 구현 비용이 큼. 정직하게 리스크로 남기고 트래픽 실측 후 결정하는 편이 과잉설계보다 낫다 | 처음부터 미들웨어 rate-limit 또는 Turnstile 도입 — 검증 전 단계 제품에 어뷰징 대응 인프라를 먼저 짓는 것은 우선순위 역전 |
| XSS 방어를 "코딩 규율(텍스트 노드만 렌더)"에 의존 | Zod가 구조는 걸러도 문자열 내용을 정제(sanitize)하지 않는다는 것이 API_CONTRACT §4의 명시적 전제. 별도 sanitizer 라이브러리 도입은 ONESHOT_MASTER "임의 스택 추가 금지" 원칙과 충돌 | DOMPurify 등 sanitizer 도입 — React가 기본 이스케이프를 이미 제공하므로 `dangerouslySetInnerHTML`을 안 쓰는 규율만 지키면 중복 방어가 됨. 다만 이 규율이 문서 지식으로만 존재하고 린트로 강제되지 않는 점은 잔존 리스크로 남긴다(§2 표) |
| `fork_count` 오염을 완전히 수용(대응 없음) | 결제·권한·데이터 무결성에 영향을 주지 않는 순수 통계 지표. 대응 비용을 들일 가치가 없다 | 호출 빈도 제한 — 구현 비용 대비 얻는 것이 표시 정확도뿐이라 기각 |
| takedown을 관리자 UI 없이 Supabase 대시보드 수동 조작으로 시작 | MVP 단계 신고 볼륨을 예측할 수 없는 상태에서 관리자 페이지를 미리 짓는 것은 과잉설계. `service_role` 대시보드 접근만으로 즉시 대응 가능 | 전용 관리자 페이지 구축 — 초기 신고 건수가 사실상 0에 가까울 것으로 예상되는 단계에서 낭비 |
| CSP `img-src`의 `mzstatic.com`을 `확인 필요`로 남김 | iTunes Search API가 실제로 반환하는 아트워크 도메인은 지역·API 버전에 따라 달라질 수 있어, 문서 집필 시점에 확정 단언하면 오히려 틀린 CSP를 낳을 위험(§0 규칙 5 — 실측 필요 표기 원칙) | 도메인을 단언하고 넘어가기 — 실제 배포에서 이미지가 CSP에 막혀 깨지는 사고로 이어질 수 있어 기각 |

## 8. 검증 체크리스트

- [ ] `next.config`의 `headers()`가 실제로 응답 헤더에 반영되는지 배포 환경에서 브라우저 개발자도구 Network 탭으로 확인
- [ ] 공유 페이지(`/s/[slug]`)에 `<script>`, `onerror=` 등을 포함한 `title`/`memo`/`tags`로 만든 테스트 공유물을 열람 — 스크립트가 실행되지 않고 텍스트 그대로 표시되는지 확인(XSS 회귀 테스트, TEST_PLAN 연계 `확인 필요`)
- [ ] 티켓 이미지 export(PNG, `html-to-image`)와 OG 이미지(`next/og`) 양쪽에서 동일한 악성 문자열 테스트 — 이미지에 텍스트 그대로 렌더되는지 확인
- [ ] 저장소 전체를 `grep -r "SUPABASE_SERVICE_ROLE_KEY"`로 검색해 코드·커밋 이력에 값이 하드코딩되어 있지 않은지 확인
- [ ] `.gitignore`에 `.env*`(`.env.example` 예외)가 등록되어 있는지 확인
- [ ] anon key로 `songs`/`shared_lists`에 API_CONTRACT §8 체크리스트(RLS·CHECK 항목)를 실제로 재현해 거부되는지 확인 — 이 문서는 결과를 재서술하지 않고 API_CONTRACT §8을 그대로 실행 대상으로 삼는다
- [ ] `increment_fork`를 동일 slug로 10회 연속 호출 후 `fork_count`가 정확히 10 증가했는지(로직 정합성) + 이 값이 어떤 권한 검사에도 쓰이지 않는지 코드 검색으로 확인
- [ ] CI 파이프라인에서 의도적으로 high 취약점 의존성을 추가해 빌드가 실패하는지 리허설(정책이 실제로 작동하는지 확인)

## 9. 미결

- CSP `img-src`의 iTunes 아트워크 정확한 도메인(`*.mzstatic.com` 여부) — `확인 필요`, 구현 시 실제 API 응답으로 실측
- `style-src`/`script-src`에 `'unsafe-inline'`이 실제로 필요한지 — Next.js App Router + Tailwind v4 + (사용 시) `next/font` 조합에서 인라인 태그 자동 삽입 여부 `구현 시 검증`
- 레이트리밋 후속 옵션(Vercel WAF / 미들웨어 / Turnstile) 중 실제 채택안과 도입 시점 — `기획 확인 필요`, 트래픽 실측 후 결정
- takedown 신고 접수 이메일 주소 자체(실제 값) — 아직 확보되지 않음, MICROCOPY/UX_FLOWS 확정 시 동기화 필요
- 관리자 페이지 도입 여부와 시점(신고 볼륨이 대시보드 수동 조작으로 감당 안 될 때) — `기획 확인 필요`
- 곡 삭제 요청이 기존 공유물 payload 스냅샷까지 소급 전파해야 하는지(법무 판단 필요) — PRODUCT_SPEC §9와 교차 확인 필요
- `pnpm audit` CI 연결의 구체 워크플로 파일 경로·트리거 조건 — 이 문서는 정책만 정의, 파일 자체는 미생성
- HANDOFF.md의 실제 생성 여부·경로 — README §1 문서 트리에 없고 ONESHOT_MASTER Phase 10 언급에 의존한 `추정`
