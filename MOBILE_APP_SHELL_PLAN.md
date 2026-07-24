# SingSong Mobile App Shell Recovery Plan

> Status: COMPLETE · 2026-07-22  
> Trigger: real-phone review found the implemented home visually reads as a landing page and violates the canonical Session Strip app-shell contract.

> Latest renewal verification: 39 Vitest files / 194 tests, fixture build, public Chromium 13 / 7와 PWA 3 / 3 PASS. 아래 37 / 185와 precache 45 기록은 리뉴얼 전 보존 증거이며, 현재 공개 preview는 Folded Session S를 포함한 `ACTIVE_PREVIEW/READY`다.

`COMPLETE`는 repository/local fixture 범위의 구현·자동검증 완료를 뜻한다. 영구 production
배포, 실제 iOS/Android 설치·보조기기 확인, catalog 권리와 운영 credential은 계속
`BLOCKED_EXTERNAL`이다. Quick Tunnel에는 최신 fixture build가 재게시되어 있지만 stable host가 아니다.

## Evidence and root cause

- `docs/design/concepts-10/ADOPTION.md` locks CUTLINE and forbids mixing unrelated concept styles.
- `docs/design/VISUAL_MOTION_DIRECTION.md` requires a compact AppHeader, one continuous Working Session Strip, one Queue→Calculator perforation, an ActionDock, and a two-item mobile PrimaryNav below 900px.
- `docs/FINAL_BLUEPRINT.md` requires the core planner to be the first visible task, with calculation details in disclosure/drawer rather than a stack of independent cards.
- The live 412px screenshot instead begins with marketing copy, uses website-style top navigation, renders three separate bordered cards in one long document, and has no mobile bottom navigation or thumb-reachable next action.
- PWA plumbing works, but the current UI does not communicate an installed app mental model.

## Locked design contract

1. Keep CUTLINE/Session Strip: warm canvas, paper strip, ink information, rose action, ochre money.
2. Remove the mobile marketing hero and website-style top tabs from task routes.
3. Use at most one strong raised surface on home: the continuous Working Strip.
4. Render songs as numbered ledger rows, not cards.
5. Place exactly one perforation between Queue and Calculator.
6. Under 900px, show the same two-item PrimaryNav DOM as a bottom app navigation: `플랜`, `검색`.
7. Keep the next decision in one BottomSlot: home ActionDock or search PlanRail above PrimaryNav.
8. Preserve every validated calculation, search, persistence, share, import, undo, and accessibility behavior.
9. Add an honest install affordance: Android prompt when available and iOS Safari instructions; never claim a temporary preview URL is permanent.
10. No gradients, glass, glow, decorative music imagery, card stacks, or pill-primary-button drift.

## Implementation slices

### Slice A — shell and navigation

- Introduce a shared task-route app shell with compact AppHeader, overflow actions, skip/main focus behavior, PrimaryNav, BottomSlot ownership, safe-area and soft-keyboard handling.
- Keep ticket, shared, import, offline and not-found routes immersive without PrimaryNav.
- Add standalone/display-mode and route-aware styling without duplicating mobile/desktop navigation DOM.

### Slice B — home Working Strip

- Replace the marketing hero with immediate active-plan identity and honest local-storage status.
- Merge queue, empty state, calculation controls and result summary into one semantic strip.
- Keep empty onboarding inside the strip with one `노래 찾기` action.
- Move detailed calculation inputs into a focused disclosure and keep a compact live summary visible.
- Add the mobile ActionDock label required by validity: `N곡 티켓 만들기` or `요금과 인원 입력하기`.

### Slice C — search ledger

- Use a sticky search field and continuous ledger result rows.
- Add the persistent PlanRail with current song/time/cost summary and `플랜 보기`.
- Keep manual-add, IME, abort/sequence, undo and error behavior unchanged.

### Slice D — installation and app feel

- Add the canonical PWA install banner/copy and iOS instruction sheet.
- Add Apple standalone metadata and safe-area treatment.
- Ensure touch targets, focus states, reduced motion and keyboard behavior remain valid.

### Slice E — verification and live replacement

- Extend component/integration tests for shared navigation, BottomSlot, disclosure focus and install affordance.
- Run format, lint, typecheck, focused tests, full test suite and demo production build.
- Capture and review 320×568, 390×844, 768×1024 and 1440×900 screenshots, including the real public-phone origin.
- Restart only the local fixture server behind the existing tunnel, verify public HTTPS 200 and service-worker control, then hand the same or replacement URL to the user.

## Acceptance gate

- The first 844px mobile viewport exposes the active plan, song action, compact calculation status and persistent bottom navigation without reading marketing copy first.
- Home contains one visual protagonist and one perforation; no repeated independent-card stack.
- `플랜`/`검색` navigation is reachable with one thumb and exposes `aria-current`.
- Empty, populated, invalid-pricing, valid-ticket, search-result and offline states retain recovery paths.
- No horizontal overflow at 320px; dock/nav do not cover content or focused inputs.
- Existing functional and security tests remain meaningful and pass.
- A mobile screenshot review visibly matches the canonical Session Strip reference relationship, without copying the reference raster into production.

## Completion record

| Slice                | 실제 구현                                                                                                                                                                             | 검증                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — shell/navigation | `SiteHeader` 안의 단일 `PrimaryNav` DOM, route-aware `aria-current`, `AppHeaderActions`, viewport/safe-area 기반 `BottomSlot`                                                         | `primary-nav.test.tsx`, `mobile-shell.spec.ts`; mobile bottom↔wide header 전환과 중복 0                                                                                   |
| B — home strip       | `PlanWorkspace`가 queue→단일 perforation→calculator 순서를 유지한다. 0곡은 `WorkingStrip`의 검색 링크 하나, 1곡 이상은 `HomeActionDock`의 요금 입력/발권 행동 하나가 다음 결정을 소유 | `working-strip.test.tsx`, `home-action-dock.test.tsx`, mobile organizer flow 1/1                                                                                          |
| C — search ledger    | sticky search, 연속 ledger row, 현재 곡·시간·비용을 계산하는 `PlanRail`, 플랜 복귀                                                                                                    | `search-ledger.test.tsx`, `plan-rail.test.tsx`, shell E2E                                                                                                                 |
| D — install/app feel | Android `beforeinstallprompt`, iOS Safari 안내, Folded Session S 헤더·설치 아이콘, 14일 dismiss, standalone/immersive-route 억제, temporary-host 경고, Apple metadata와 safe area | install/brand unit·static 계약과 public-origin production PWA 3/3 PASS; 14일 만료와 temporary-host 분기는 code inspection |
| E — regression       | 기존 계산·검색·Dexie·티켓·공유·import·PWA·보안 계약을 변경하지 않고 shell 전용 unit/integration/E2E를 추가                                                                            | current·233-path clean Prettier/ESLint/tsc, Vitest 37 files/185 tests, coverage와 build/PWA/smoke PASS; current Playwright 20 discovered, 13 pass, 7 project-gated skip   |

리뉴얼 전 fixture artifact는 built PWA precache 45/forbidden 0, home/ticket/OG 200,
OG 30,423 bytes, home initial JS gzip 167,035 bytes로 검증됐다. Folded Session S 반영 뒤 current artifact는 precache 49/forbidden 0/required brand assets 3이다. 성능 최종치는 cold LCP
median/worst 324/336ms, TBT 234/240ms, CLS 0.0005; warm LCP 92/144ms, TBT 0;
search p95 15.7ms; calculation median/worst 14/23.7ms; ticket navigation 505ms다.
field p75는 표본 `NONE`이므로 `NOT_RUN + NONE`이다.

스마트폰 확인용 현재 임시 preview는
`https://interactions-suffered-participate-empire.trycloudflare.com`이다. public hostname으로 빌드한 app PID 43664가 `127.0.0.1:34173`을 listen하고 Quick Tunnel PID 43376이 연결한다. Folded Session S의 versioned 180/192/512 assets, manifest와 `singsong-static-v2` worker가 공개 origin에서 200이며 public Chromium PWA 3/3이 PASS했다. 두 process는 사용자 확인을 위해 의도적으로 유지하며 영구 배포나 종료 완료로 판정하지 않는다.

이전 `bond-athletics-calculations-putting`/port 3000 preview는 싱송 종료 후 다른 앱을 오노출해 폐기한 역사 기록이다. 현재 repository shell과 same-origin service-worker 검증은 `ACTIVE_PREVIEW/READY`지만 실제 physical-device 설치는 사용자의 재확인이 필요하므로 production/device PASS로 승격하지 않는다.
