# SingSong App Renewal Plan

> Status: COMPLETE · 2026-07-22
> Trigger: the current implementation is functionally broad but visually drifts from the repository's canonical CUTLINE / Session Strip direction and reads as an oversized, unfinished shell on real mobile screens.

## 1. Source-of-truth order

1. `docs/FINAL_BLUEPRINT.md`
2. `docs/prompts/ONESHOT_MASTER.md` v3.2
3. `docs/design/VISUAL_MOTION_DIRECTION.md`
4. `docs/design/concepts-10/ADOPTION.md`
5. Domain-specific legacy documents only where they do not conflict with the above

The renewal preserves the current local-first domain, calculation, sharing, import, PWA, security, and API contracts. It changes presentation and interaction composition; it does not silently revive deprecated multi-list, public discovery, album-art, permanent-share, or direct-Supabase-browser behavior.

## 2. Current diagnosis

- The first mobile render is dominated by a large empty paper surface and oversized headings instead of an immediately scannable working strip.
- English implementation labels (`WORKING STRIP`, `HONEST CALC`, and similar copy) compete with the actual Korean task labels.
- `globals.css` contains a large base layer followed by a second mobile-shell recovery layer, creating duplicate selectors and making visual intent difficult to maintain.
- Header, empty state, queue, calculator, dock, and bottom navigation do not yet feel like one compact installed-app composition at 320–430px.
- The chosen CUTLINE reference is materially denser, quieter, and clearer: one paper protagonist, ledger rows, one perforation, restrained rose action, and ochre money.
- The current loading state exposes implementation delay as a near-empty page instead of a stable shell/skeleton.

## 3. Renewal slices

### Slice A — canonical app shell

- Rebuild the visual token layer around the exact CUTLINE palette and semantic aliases.
- Refine the brand mark/wordmark, compact header, route-aware two-item navigation, safe-area ownership, and loading shell.
- Remove duplicated/conflicting CSS instead of adding another override layer.

### Slice B — working session strip

- Make the empty plan compact and action-led; do not allocate a viewport-sized blank card.
- Keep queue and calculator as one continuous paper artifact with exactly one semantic perforation.
- Use Korean-first labels and concise supporting copy.
- Preserve reorder, delete, undo, new-plan, local save, calculation, reverse calculation, and ticket issue behavior.

### Slice C — search and plan rail

- Keep the search input sticky and results as cardless ledger rows.
- Make test-data status visible but quiet.
- Keep manual add, IME debounce, duplicate handling, undo, error recovery, and current-plan rail behavior.

### Slice D — ticket and secondary routes

- Align TicketCard, share, import, offline, missing, and error surfaces with the same CUTLINE hierarchy.
- Preserve public-snapshot disclosure, expiry/revoke, PNG, import handoff, and accessibility contracts.

### Slice E — verification

- Run formatter check, lint, TypeScript, focused unit/integration tests, the full Vitest suite, and demo build.
- Capture and inspect at least 390×844 mobile plus 1440px wide home/search/ticket states where reachable.
- Confirm no horizontal overflow, no dock/nav overlap, no duplicate primary navigation, and no regression in existing functional tests.

## 4. Acceptance criteria

- A first-time user can identify `곡 담기`, current song count, calculation state, and the next action without scrolling through marketing or decorative whitespace.
- Mobile home has one raised surface, cardless rows, and no stack of unrelated rounded cards.
- Rose means action, ochre means money, ink means information; gradients, glass, glow, music clichés, and pill primary buttons are absent.
- Korean task labels lead; English is limited to small serial/brand metadata where it adds ticket character.
- The same component DOM reflows between mobile and wide layouts without duplicated navigation.
- Controls remain at least 44px, keyboard reachable, focus-visible, reduced-motion safe, and usable at 320px / 200% text.
- Existing local-first, calculation, search, sharing, import, PWA, security, and release-profile behavior remains intact.

## 5. Worktree safety

- The current implementation and documentation are uncommitted work and are treated as user-owned.
- No reset, checkout, mass deletion, or history rewrite is allowed.
- Edits are limited to files required by the renewal; unrelated documentation and release evidence remain untouched.

## 6. Completion record

- Replaced the duplicated stylesheet layers with one cohesive CUTLINE system using cream, ink, action rose, and money ochre semantic tokens.
- Renewed the responsive shell, Korean-first brand, loading states, single Session Strip, calculation disclosure, search ledger, BottomSlot actions, and two-item navigation.
- Renewed ticket, managed-share, public-share, import, offline, missing, and error states while preserving the local-first and BFF contracts.
- Strengthened semantic heading/list/data markup, visible share disclosure, unique ticket heading IDs, focus states, reduced motion, forced colors, and mobile safe-area behavior.
- Preserved the existing branch, HEAD, modified documents, untracked implementation, preview processes, and Git history; no reset, clean, checkout, stage, commit, push, or deploy was performed.

## 7. Final verification

| Gate | Result |
| --- | --- |
| Prettier | PASS |
| ESLint | PASS, zero warnings |
| TypeScript | PASS |
| Vitest | PASS, 39 files / 190 tests |
| Next.js fixture production build | PASS |
| Responsive Chromium regression | PASS, 3 / 3 |
| Visual review | PASS at 390×844 and 1440×900 for home, plus 390×844 search |
| Existing Quick Tunnel preview | Authorization required before restarting and republishing the renewed build |

The existing external release gates remain unchanged: licensed catalog data, production credentials and infrastructure, a stable production hostname, and real-device/assistive-technology validation are not represented by the fixture build.
