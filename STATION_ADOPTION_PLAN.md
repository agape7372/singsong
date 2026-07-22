# SingSong Station Adoption Plan

> Status: SUPERSEDED · 2026-07-23
> Superseded by `DEMO_PARITY_RENEWAL_PLAN.md`, which adopts the demo's exact information
> architecture instead of only applying the Station visual language to the legacy queue.
> Scope: production Next.js app only. `design-lab/space-concepts/**` remains an unmodified, non-canonical reference artifact.

## 1. Locked interpretation

- Adopt concept 10, SingSong Station, as the production plan-screen composition.
- Preserve the current production palette: cream `#FAF7F0`, ink `#15131A`, action rose `#FF3D6E`, and money ochre `#B76E00`.
- Do not carry the prototype's dark progress scene, station eyebrow, large welcome headline, explanatory copy, or `공간` navigation label into production.
- Start the plan content with a compact overlapping participant profile stack, followed by the song ledger, estimates, and the existing ticket action.
- Remove the visible `함께하는 사람` label, minus/count/plus rectangle, and its surrounding box.
- Keep a circular `+` control at the right edge of the profile stack. It updates the existing local `people` value without inventing accounts, invitations, names, or profile photos that the product does not store.
- Increase production typography for task headings, track rows, controls, and supporting copy while retaining 320px and 200% text usability.
- Remove the visible outline around the ticket side punch so the notch reads as a clean physical cut.

## 2. Product and data boundaries

- The app remains local-first and anonymous; profile circles are local participant placeholders, not account-backed identities.
- Existing search, reorder, remove/undo, calculation, ticket, share, import, PWA, and security contracts remain unchanged.
- The detailed pricing form remains the authoritative place to correct or reduce the participant count; the profile `+` control is a fast increment action only.
- No static design-lab HTML, CSS, JavaScript, capture, or evidence file is edited or bundled into the production app.

## 3. Implementation slices

### Slice A — production participant stack

- Add a semantic participant stack to the populated plan strip.
- Render `나` plus local numbered placeholders from `plan.people`, with a compact overflow count when needed.
- Add a 44px circular `참여자 한 명 추가` button, disabled at the domain maximum.
- Persist increments through the existing revision-CAS plan mutation path.

### Slice B — Station composition and typography

- Simplify the populated strip heading to `같이 부를 곡` and retain the exact song count.
- Use flatter station/ledger grouping without adding the deleted hero or welcome blocks.
- Increase core mobile text sizes and line heights without introducing gradients, glow, glass, or a new color system.
- Keep the existing two-item `플랜` / `검색` production navigation; do not rename it to `공간`.

### Slice C — clean ticket punch

- Keep the physical notch geometry but remove the circular outline and any residual border artifact.
- Verify both light/dark rendering and PNG/browser ticket surfaces.

### Slice D — regression and visual verification

- Add component tests for participant rendering, increment behavior, maximum state, and removed labels/rectangle controls.
- Run format, lint, TypeScript, full Vitest, production build, and focused responsive Chromium tests.
- Capture mobile home with a populated fixture plan and ticket at 390×844; inspect font scale, overflow, focus, and notch clipping.

## 4. Acceptance criteria

- No dark station progress hero, welcome headline/copy, or `공간` production label is present.
- No `함께하는 사람`, minus button, numeric stepper rectangle, or participant container box is present.
- Participant circles overlap cleanly and the rightmost `+` is the only quick-add control.
- Track and summary text is visibly larger while 320px horizontal overflow remains zero.
- Current palette meanings remain unchanged.
- Ticket punches show canvas through the cut with no circular outline.
- The reference HTML remains byte-unchanged throughout implementation.

## 5. Completion evidence

- Prettier, ESLint, TypeScript, and all 39 Vitest files (192 tests) pass.
- The isolated production build completes successfully.
- The full Chromium E2E matrix passes: 13 active project tests, with 7 intentional
  mobile skips; the focused visual contract also passes in both projects.
- At 390px the participant avatars and add button are 44×44px, horizontal overflow is
  zero, and both ticket punch pseudo-elements report a `0px` border.
- SHA-256 hashes for the four `design-lab/space-concepts` reference files are unchanged.
