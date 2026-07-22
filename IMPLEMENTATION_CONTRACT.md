# SingSong v3.2 Implementation Contract

상태: **LOCKED FOR P0 IMPLEMENTATION**  
우선순위: 현재 사용자 지시 → 보존/보안/법적 제약 → `docs/FINAL_BLUEPRINT.md` → `docs/prompts/ONESHOT_MASTER.md`와 v3.2 handoff → 최신 Git 의도 → 레거시 자료.

## 제품 계약

초기 사용자는 향후 7일 안에 2~4인 노래방 약속을 준비하는 한 명의 주최자다. 앱의 약속은 “가입 없이 오늘 부를 순서와 가격표 기준 예상 범위를 정리해 읽기 쉬운 티켓으로 건넨다”이다. 성공은 첫 세션에서 1곡 이상, 유효한 사용자가 입력한 가격/인원, 발급 가능한 티켓, 로컬 재열기, 수신자의 명시적 import까지다.

### P0

- 단일 활성 플랜, 0~100곡, 검색과 직접 추가, 삭제/undo, 키보드 reorder
- 곡/시간 두 요금 방식, 1~30명, 정직한 시간·총액·인당 범위와 역산
- revision-frozen semantic ticket, 1080×1350 PNG
- 30일 unlisted/noindex immutable link, exact SSR, local revoke capability
- canonical `/import` handoff와 nonempty replacement 확인
- installable PWA, offline shell, 사용자 승인 업데이트
- fixture/production profile, strict validation, redacted logging, tests/runbooks

### 비목표

로그인/회원가입/결제/클라우드 sync, 여러 리스트/히스토리, Discover/셀럽, realtime room, streaming playlist import, album art, lyrics/audio, 실제 카탈로그 scraping, public/indexable feed, decorative QR/barcode, location/microphone 권한은 구현하지 않는다. 직접 추가의 title/artist/vendor code 외 memo/key/tag/device ID도 schema에 만들지 않는다.

## Route 계약

| Route       | 수용 기준                                                                         |
| ----------- | --------------------------------------------------------------------------------- |
| `/`         | 한 활성 플랜의 search → ordered strip → honest calc → issue CTA가 동작한다.       |
| `/search`   | 같은 planner를 검색 focus 상태로 제공하며 URL에 query를 남기지 않는다.            |
| `/ticket`   | valid frozen revision만 렌더하고 invalid/direct 진입은 복구 경로를 준다.          |
| `/s/[slug]` | exact 22-char slug의 immutable SSR만 제공하며 no-store/noindex/no-referrer다.     |
| `/import`   | canonical same-origin URL 또는 raw slug만 받아 preview 후 명시적으로 replace한다. |
| `/offline`  | 연결이 없어도 로컬 플랜은 남는다는 정확한 안내와 home 복귀를 제공한다.            |

추가 list/discover/history route는 금지한다. JSON data API는 `/api/search`, `/api/shares`, exact `/api/shares/[slug]`, `/api/shares/[slug]/revoke`만 공개하고, 비JSON preview renderer로 `/api/og/[slug]`만 둔다. list/enumeration endpoint는 없다.

## 상태 소유권

| 상태                       | 정본과 충돌 규칙                                                          |
| -------------------------- | ------------------------------------------------------------------------- |
| Active plan/settings/items | Dexie singleton, expected revision CAS transaction, 조용한 LWW/merge 금지 |
| Ticket snapshot            | Dexie unique `[planId+revision]`; seed/payload/fingerprint 재사용         |
| Imported slug              | Dexie unique slug; duplicate import 금지                                  |
| Search request/UI          | component-local state; IME/debounce/abort/sequence state machine          |
| Share snapshot             | server immutable row; browser에는 local receipt/capability만 보관         |
| Dialog/toast/update prompt | primitive/component-local; Base UI focus 관리                             |
| Theme                      | OS default; 별도 toggle state 없음                                        |

## Domain 불변조건

- Track 수 `0..100`; ticket/share는 `1..100`; order는 `0..N-1`.
- user text는 NFC, trim, single-line, title 1..80 code points, artist 0..80; control/bidi 거부.
- code는 TJ/KY와 ASCII digit 1..6. 모든 수와 결과는 safe integer.
- 첫 사용의 가격/인원은 비어 있다. 업소나 인원을 추정한 preset은 금지한다.
- duration: `165/210/255초 * N + 15/25/35초 * gaps`, `coverageBps=0`.
- display만 5분 바깥 반올림; billing은 raw seconds.
- bundle min은 정수 전수 열거; per-person은 최종 won만 ceil.
- reverse는 같은 forward를 사용하고 active prefix cap을 넘지 않으며 곡을 삭제하지 않는다.

## Catalog와 검색 계약

provider interface가 fixture와 production을 분리한다. fixture는 실제 가수·곡·TJ/KY 번호를 흉내 내지 않는 합성 데이터이고 모든 관련 화면에 `TEST DATA`를 표시한다. production catalog는 provenance, 권리, coverage, 공식 delta, takedown과 quality corpus가 승인되기 전 `BLOCKED_EXTERNAL`이다.

검색은 POST JSON, decoded 1KiB, q 최대 60 code points, 결과 최대 20, no-store다. Unicode/공백/구두점 normalize, token AND, title/artist order independent, exact number/title 우선 stable ranking을 사용한다. composition 중 요청 0건, 종료 후 200ms, abort+seq로 stale response commit 0건이다. empty/error/offline에는 직접 추가 또는 재시도 경로가 있다.

## Share/API/DB 계약

- canonical snapshot은 strict schema, server recalculation, UTF-8 96KiB 상한; raw create body는 128KiB.
- idempotency key 128-bit canonical base64url 22자, revoke token 256-bit 43자, artwork seed 128-bit 22자.
- production raw capability/IP는 SQL parameter나 DB/log에 보내지 않고 hash/HMAC만 보낸다.
- slug는 `HMAC-SHA-256(versioned key, "singsong/share-slug/v1" + NUL + idempotencyKey)` 첫 16 bytes. key version 재사용 금지, 마지막 row 후 45일 이상 보존.
- DB TTL은 30일. revoke/expiry 관측 시 reservation terminalize, active FK detach, payload/token 제거; namespace hash는 재사용하지 않는다.
- public/anon/authenticated/service_role의 private direct CRUD는 0. `service_role`은 exact allowlist RPC 6개만 실행한다.
- production create는 Turnstile, HMAC IP 10/hour+30/day DB quota, trusted proxy/origin/content type를 fail closed 검사한다. revoke는 60/hour+200/day.
- missing/expired/revoked/wrong capability는 구별할 수 없는 generic unavailable 응답이다. share/API/OG는 no-store이고 SW cache 금지다.
- structured logs는 route label/status/request ID/duration만 허용하고 payload, query, title/artist, slug/token/IP를 금지한다.

## PWA/시각/접근성 계약

manifest는 192/512/maskable/apple icons를 제공한다. shell/static allowlist만 캐시하고 search/share/API/OG/mutation은 캐시하지 않는다. `skipWaiting:false`; update 발견만으로 reload하지 않고 사용자의 적용 동의 후 전환한다.

Session Strip/CUTLINE은 한 개의 주 raised surface, ledger/perforation, semantic token, 직사각 CTA를 사용한다. gradient/glass/과도한 card stack/음표·마이크 brand mark/생성 PNG crop을 금지한다. light/dark, 320/390/768/1440 reflow, keyboard, visible focus, 200% text, 400% zoom, forced-colors, reduced-motion을 지원한다. ticket issue는 transform/opacity 360ms 이내, rotation 0.6° 이내, revision당 정확히 한 context만 claim한다.

## Verification과 readiness

최소 게이트는 frozen install, format, lint, TypeScript strict, unit/property/oracle, Dexie/API integration, SQL static+실제 ACL, Chromium mobile/desktop E2E, axe, responsive/reduced-motion/forced-colors, production build/start, PWA controlled/offline/update, secret scan이다. mock/static 검사는 실제 RLS·브라우저·실기기 PASS를 대신하지 않는다.

외부 증거가 없는 현재 최대 주장은 `buildCapability=LOCAL_DEMO_READY`, `productionGate=BLOCKED_EXTERNAL`이다. production catalog 권리/품질, Supabase 실프로젝트 ACL와 scheduler, current key와 legacy key disable, Turnstile/도메인, backup/monitoring, legal/privacy/takedown, iOS/Android/Kakao/PWA/OG 실기기 검증, 실제 사용자 연구가 모두 끝나야 사람의 공개 출시 승인 단계로 갈 수 있다.
