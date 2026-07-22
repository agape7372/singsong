# SingSong Station Demo-Parity Renewal Plan

> Status: COMPLETED · 2026-07-23
> Canonical visual reference: the user's second screenshot and concept 10 in
> `design-lab/space-concepts`. The reference files remain read-only.

## 1. Correction

- The previous pass reused the production queue card and only added Station colors and
  avatars. That did not adopt the demo's information architecture.
- This pass treats the demo composition—not the old queue component—as the visual source
  of truth while preserving production data, calculations, persistence, and accessibility.

## 2. Locked composition

- Keep only the overlapping circular participant stack at the top, with the circular `+`
  quick-add control. Keep the previously requested people label, stepper, and box removed.
- Render a square ledger block with the black `A` badge, `SINGSONG`, and a larger bold
  rose numeric count in one header row.
- Render song rows as `01 / title / artist / ×`, matching the demo. Karaoke codes and the
  large up/down/remove control matrix are not visible in the resting layout.
- Center a single visible `+` add action inside the ledger border.
- Render the estimate as a separate two-column bordered strip: `시간` and
  `예상 비용`. The strip itself opens the existing detailed pricing form, so no pricing
  value is invented and the existing calculation contract remains authoritative.
- Place the centered rose `완료` action directly below the estimate strip in normal document
  flow, without an additional completion hint.
- Remove the old rounded queue shell, queue serial/count stamp, bulky calculation summary,
  and fixed action dock from the populated default view.
- Preserve the current production palette and the previous clean ticket-punch correction.

## 3. Functional boundaries

- Existing add, remove/undo, local participant persistence, pricing validation, ticket
  issuance, sharing, import, PWA, and security behavior remain intact.
- Duration continues to use the documented fallback model. Price remains unset until the
  user supplies real venue pricing.
- Reordering remains available as a secondary accessible interaction without changing the
  demo-parity resting layout.
- Empty-plan and search states remain functional and may keep their dedicated recovery UI.

## 4. Acceptance criteria

- At 390px the populated production screenshot has the same block order, border geometry,
  header hierarchy, row density, two-column estimate, and inline CTA as the demo screenshot.
- The only visible per-song control in the resting state is `×`.
- No `QUEUE / 01`, `03 / 100`, karaoke code line, three-button row matrix, bulky calculation
  result, or fixed ticket action dock appears in the populated default view.
- Participant avatars remain unboxed and 44px; the add button persists the count.
- The estimate strip opens the real pricing form and the CTA either opens missing pricing or
  issues the ticket when calculation data is complete.
- 320px and 200–400% text reflow have no horizontal overflow.
- Unit/integration tests, production build, full Chromium E2E, and visual comparison pass.
- The design-lab reference hashes remain unchanged.

## 5. Completion evidence

- A 390px populated fixture with three tracks and four participants matches the locked
  composition and all geometry thresholds: 58–64px header, 56–64px rows, 52–58px add
  row, 64–72px estimate strip, and 58–60px CTA.
- Resting reorder controls have `opacity: 0` and no pointer events; the three delete
  controls remain visible and keyboard reordering remains available.
- TypeScript and ESLint pass; all 39 Vitest files and 193 tests pass.
- The isolated production build completes successfully.
- The full Chromium matrix passes with 13 active tests and seven intentional
  project-specific skips, including 320px and 200–400% reflow coverage.
- The four reference-file SHA-256 hashes are unchanged from the start of this renewal.
