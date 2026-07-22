# Singsong Final Design Review Plan

> **Status**: COMPLETE · 2026-07-21  
> The review produced the canonical v3.2 blueprint, independent critique, unknown register, visual/motion direction, two reference boards, and one-shot implementation prompt listed below.

## Objective

Turn the existing Fable/Opus pre-implementation documents into a coherent, implementation-ready source of truth, including a robust one-shot build prompt and explicit treatment of unresolved unknowns.

## Review tracks

1. **Repository and product truth audit**
   - Inventory every existing document and extract the product promise, target users, jobs, constraints, success metrics, scope boundaries, and contradictions.
   - Separate facts, decisions, assumptions, hypotheses, and unresolved questions.
2. **Architecture and delivery audit**
   - Review domain model, state transitions, API contracts, security/privacy, platform constraints, observability, testing, failure recovery, and operational readiness.
   - Record decisions and trade-offs at implementation precision without adding unnecessary infrastructure.
3. **UX, visual, image, and motion audit**
   - Review navigation, screen states, accessibility, responsive behavior, microcopy, design tokens, media pipelines, animation semantics, performance, and reduced-motion behavior.
   - Define an original visual direction and production-safe asset-generation prompts where raster imagery is justified.
4. **Adversarial unknown discovery**
   - Probe edge cases, missing actors, permissions, lifecycle gaps, data ownership, error states, abusive use, device/network variation, internationalization, and launch assumptions.
   - Rank unknowns by impact, reversibility, and required validation timing.
5. **Synthesis**
   - Reconcile conflicting recommendations and designate one canonical product/architecture/design contract.
   - Produce an implementation sequence, acceptance gates, and a one-shot prompt that points to the canonical documents and prevents scope drift.
6. **Verification**
   - Cross-check terminology, IDs, states, routes, events, metrics, and acceptance criteria across all documents.
   - Verify the final handoff can be consumed by another model without hidden conversational context.

## Planned deliverables

- A canonical final design/handoff document for subsequent models.
- An unknowns and decision-risk register with launch gates.
- A visual, image, and motion direction document with asset prompts.
- A strengthened one-shot implementation prompt.
- Corrections or addenda to existing documents where needed for internal consistency.

## Non-goals

- Implementing production code in this review pass.
- Inventing external business requirements that cannot be inferred; uncertain items will be surfaced explicitly.
- Expanding the MVP solely to demonstrate technical sophistication.

## Completed deliverables

- [`docs/FINAL_BLUEPRINT.md`](./docs/FINAL_BLUEPRINT.md) — canonical product/UX/calculation/security/PWA/release contract.
- [`docs/CODEX_FINAL_REVIEW.md`](./docs/CODEX_FINAL_REVIEW.md) — independent Fable/Opus critique and decision rationale for future models.
- [`docs/UNKNOWN_REGISTER.md`](./docs/UNKNOWN_REGISTER.md) — 19 ranked product unknowns plus 5 implementation-boundary unknowns with defaults, validation methods, thresholds, timing, blockers, and status fields.
- [`docs/design/VISUAL_MOTION_DIRECTION.md`](./docs/design/VISUAL_MOTION_DIRECTION.md) — Session Strip visual language, responsive composition, accessibility, motion, export, and acceptance gates.
- [`docs/design/assets/session-strip-concept-board.png`](./docs/design/assets/session-strip-concept-board.png) — reference-only product concept board.
- [`docs/design/assets/ticket-issue-storyboard.png`](./docs/design/assets/ticket-issue-storyboard.png) — reference-only ticket motion storyboard.
- [`docs/prompts/ONESHOT_MASTER.md`](./docs/prompts/ONESHOT_MASTER.md) — v3.2 resumable vertical-slice implementation prompt with typed evidence/readiness states.
- [`docs/README.md`](./docs/README.md) — updated source-of-truth order and legacy conflict map.
