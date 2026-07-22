# SingSong v3.2 Release Build Plan

> **HISTORICAL IMPLEMENTATION-RUN RECORD.** 최신 리뉴얼 상태는 `APP_RENEWAL_PLAN.md`, `RUN_STATE.md`, `VERIFICATION_REPORT.md`를 따른다. 아래 37 / 185와 `ACTIVE_PREVIEW/READY`는 해당 run 시점의 보존된 증거다.

Run ID: `683054d4ee774d5ea65dedb69d21145c`  
Started: 2026-07-22T00:59:49+09:00  
Owner: Codex release implementation run

## Evidence and precedence

This run implements the current working tree without rewriting its Git history or
overwriting the 16 modified and 46 untracked user files present at the start.
Conflicts are resolved in this order: the current user request, security and data
preservation, repository instructions, `docs/FINAL_BLUEPRINT.md`, the v3.2 one-shot
documents, the latest Git intent, then older material.

The product baseline is SingSong's `CUTLINE / Session Strip`: an installable,
local-first karaoke outing planner for a 2–4 person organizer. A user can build one
ordered plan, get honest time and price ranges, issue a deterministic ticket, share
an unlisted snapshot, and let a recipient explicitly import it without an account.

## Delivery slices

1. **Forensic baseline and traceability**
   - Preserve the initial source fingerprint, dirty-tree status, all refs, reachable
     history, reflogs, Codex capture refs, unreachable objects, binary metadata,
     ignored runtime material, and the external referenced prompt.
   - Produce a material inventory, Markdown read ledger, Git history audit,
     requirements trace, conflict register, unknown resolutions, and decision log.
2. **Deterministic domain core**
   - Strict TypeScript models and Zod validation for plans, tracks, prices, tickets,
     shared snapshots, and API envelopes.
   - Integer-only duration and price calculations, cheapest bundle enumeration,
     reverse-budget prefix calculation, canonical serialization and fingerprints.
   - Unit, property, boundary, and schema tests.
3. **Local-first application**
   - Next.js App Router routes `/`, `/search`, `/ticket`, `/s/[slug]`, `/import`,
     and `/offline`, with no authentication or out-of-scope navigation.
   - Dexie persistence for one active plan, revision compare-and-swap transactions,
     cross-tab invalidation, explicit replacement import, undo, reorder, and limits.
   - CUTLINE responsive UI, light/dark/forced-colors/reduced-motion support, keyboard
     operation, semantic ticket markup, understandable loading/empty/error/retry states.
4. **Safe catalog and sharing boundaries**
   - POST-only fixture search provider with fake deterministic data, ranking,
     normalization, IME debounce/cancellation/sequence guards, size limits and manual add.
   - Server-owned share APIs with immutable validated payloads, request IDs, redacted
     logging, TTL, idempotency, revoke tokens, and a local-demo repository.
   - Supabase function-only schema/repository boundary and Turnstile/rate-limit gates
     documented and disabled until real credentials and approvals exist.
5. **Ticket, image, and PWA behavior**
   - Per-revision ticket snapshot, one-time issue motion, 1080×1350 PNG export,
     unlisted share receipt, explicit recipient handoff, and canonical light export.
   - Serwist service worker with controlled update approval; static shell/local plan
     offline behavior; never cache shares, APIs, OG responses, search, or mutations.
6. **Release verification and operations**
   - Reproducible pnpm install, format, lint, typecheck, unit/integration/property tests,
     production build, real start smoke test, Playwright core-flow and axe checks.
   - Database migration/static privilege checks, secret scan, route/cache/security checks,
     screenshots and machine-readable results under `test-results/<run-id>/`.
   - Deployment, rollback, environment, monitoring, data-rights, ingestion and takedown
     runbooks. The public production gate remains blocked until catalog rights,
     Supabase/Turnstile/domain credentials, legal/ops approval, and real-device/user
     validation are supplied; the target of this run is a verified local demo and a
     deployable production architecture without pretending those approvals exist.

## Architecture boundaries

- `src/domain`: pure calculations, schemas and canonical data; no UI or I/O.
- `src/data`: Dexie active-plan repository and synchronization signals.
- `src/features`: catalog, plan, ticket, share and import use cases.
- `src/app`: route composition and server API boundaries.
- `src/components`: reusable accessible CUTLINE primitives.
- `supabase/migrations`: production storage and function-only access controls.
- `tests`: unit, integration and browser tests; fixtures are visibly non-production.

All state changes use expected revisions. Shared snapshots are immutable and server
revalidated; no last-write-wins merge exists. Logs and analytics exclude slugs,
queries, titles, artists, free text and device identifiers.

## Verification gates

The run may only report a verified local release candidate when all repository-owned
gates pass: install, format, lint, typecheck, tests, production build, start/smoke,
core browser flow, axe Critical/Serious zero, offline/cache contract, migration/static
security checks, secret scan, and a complete material-to-requirement-to-test trace.
Unavailable external or physical checks receive an explicit `BLOCKED_EXTERNAL`
verdict with owner and unblock action; they are never converted into a pass.

## Change ownership

Existing files are preserved unless a narrowly scoped implementation update is
required. New application files and release records created by this run are listed in
`HANDOFF.md`. No commit, branch rewrite, push, stash mutation, reset, or force checkout
is authorized by this plan.

## Mobile shell recovery addendum — complete

The phone review follow-up is specified in `MOBILE_APP_SHELL_PLAN.md`. It replaced the
landing-page drift with one responsive CUTLINE task shell: compact AppHeader, one
two-item Plan/Search navigation DOM, a continuous Working Strip, a single
queue/calculator perforation, and one BottomSlot owner. Empty home keeps its one search
action inside WorkingStrip; nonempty home uses ActionDock, and search uses PlanRail.

Repository verification now covers 37 Vitest files/185 tests with all coverage
thresholds met, 20 Playwright cases with
13 pass and 7 intentional project-gated skips, mobile organizer 1/1, and production PWA
3/3. The public Quick Tunnel remains an explicitly temporary phone-review runtime, not
a production delivery slice. Its initial localhost-bound origin configuration rejected
public search mutation; rebuild/start with the public hostname then passed public search,
share create/read and the Pixel 7 browser-profile organizer-to-import flow. It is now
`ACTIVE_PREVIEW/READY`; same-origin service-worker control also passed in a Pixel 7
Chromium profile, while stable hosting, physical-device install evidence, production
credentials, rights and operations remain outside this plan's
repository authority.

The same 233-path source set was copied byte-for-byte to a writable clean root. Frozen
install, format, lint, typecheck, 37/185 coverage, Next 16.2.11 fixture build, built-PWA
45/0 inspection and HTTP smoke all passed there without changing package or coverage
thresholds.
