# Catalog takedown and correction runbook

Status: operational contract; non-fixture catalog remains **BLOCKED_EXTERNAL**.  
Primary owner: Data Rights Lead (Product Operations)  
Technical owner: Catalog Engineering on-call  
Backup owner: Legal/Data Rights duty reviewer  
Incident commander: Production Operations on-call for urgent containment

Role names, not personal names or addresses, belong in Git. The restricted
incident system stores the current contact routes and requester correspondence.

## Response targets

These are internal response targets, not legal conclusions. A contract, court
order, or applicable law may require a shorter deadline and always takes priority.

| Severity | Example                                                                                      |                            Acknowledge |            Initial containment |               Owner update |
| -------- | -------------------------------------------------------------------------------------------- | -------------------------------------: | -----------------------------: | -------------------------: |
| Urgent   | court/legal order, credible confidentiality/security exposure, provider emergency suspension | 1 hour during staffed/on-call coverage |                        4 hours | every 4 hours until stable |
| High     | verified rights holder/provider requests removal of published data                           |                         1 business day |                       24 hours |                      daily |
| Normal   | correction, attribution, or provenance dispute without ongoing exposure                      |                         1 business day | 3 business days for assessment |      every 3 business days |

Final resolution timing depends on verified scope and obligations. Do not delay
containment while debating permanent resolution.

## Intake

Accept requests only through the approved restricted route referenced by the
rights manifest and public policy. Create a random case ID and collect the minimum:

- requester role and verification status;
- source/provider and evidence or authority reference;
- affected vendor/code/source record or catalog version;
- requested action, territorial/environment scope, and urgency;
- received time and safe reply route.

Do not request unnecessary identity documents. Never paste personal data,
confidential notices, credentials, tokens, or full provider payloads into Git,
application logs, analytics, or general chat. Link the restricted case instead.

Unverified requests still receive a case and risk assessment. Do not reveal
non-public catalog or share data while verifying the requester.

## Immediate containment

The Data Rights Lead defines scope; Catalog Engineering executes with an
independent reviewer for production changes.

1. Mark the relevant rights manifest/source/assertions `suspended` or `takedown`.
2. Disable scheduled and manual ingestion for the scope before contacting the
   provider again.
3. Block the affected assertions from the next/active search projection. Publish
   a new immutable version or atomically roll back to a known-safe version; never
   edit visible rows in place.
4. Purge only version-keyed application/search/CDN caches in scope and verify from
   an unauthenticated client. Record cache limitations and third-party preview
   behavior.
5. Quarantine new occurrences with `TAKEDOWN_HOLD` so a later import cannot
   silently restore them.
6. If active managed share snapshots contain affected data, use a reviewed,
   database-owner break-glass operation to identify the minimum reservation IDs
   and terminalize them. The public result must be the same generic unavailable
   response as missing, expired, or user-revoked shares. Do not expose a bulk
   operator function to browser or general service roles.
7. Record counts, publication IDs, action codes, timestamps, approver roles, and
   integrity hashes—never raw share slugs/tokens, IPs, user identities, search
   queries, or full snapshot payloads.

The share migration deliberately grants no operator-takedown API. Before a real
catalog is enabled, the team must rehearse the controlled break-glass procedure
or implement a separately reviewed, audited least-privilege operator path. This
is part of the `BLOCKED_EXTERNAL` production gate.

## Investigation and impact

- Resolve every affected assertion through the provenance graph: source record,
  import runs, transformations, publication versions, caches/exports, quarantine,
  and superseding records.
- Compare the request with manifest field, territory, environment, capability,
  and retention scope; Legal/Data Rights decides ambiguous obligations.
- Determine whether backups/raw evidence may be retained and who may access it.
- Check fixture data independently. A synthetic coincidence is corrected as a
  product risk even if it did not originate from the provider.
- Preserve the audit fact and integrity hashes. Content removal is not permission
  to destroy evidence subject to retention or legal hold.

## Resolution outcomes

Use one or more stable actions:

- `REMOVE`: exclude assertions and dependent projections/exports;
- `CORRECT`: add a superseding assertion and new publication version;
- `RESTRICT`: narrow territories, environments, capabilities, or fields;
- `REATTRIBUTE`: publish reviewed attribution in a new version;
- `REJECT_UNVERIFIED`: no content change after documented verification review;
- `RESTORE`: only after new approval evidence and the relisting gate below.

Notify the requester using the restricted route with the case ID and high-level
outcome permitted by policy. Do not disclose unrelated records, users, internal
security controls, or management capabilities.

## Relisting gate

Removed/suspended content cannot return because an adapter sees it again. Relist
only when all are true:

1. Legal/Data Rights records a new or amended approved evidence reference.
2. The rights manifest version and affected capability/scope are current.
3. The quarantine hold is resolved by two accountable reviewers.
4. A fresh ingestion run passes validation/provenance review.
5. A new immutable publication version is approved and its caches verified.
6. The case links the new assertion/publication and records requester notification
   when required.

Never reactivate an old publication version that still contains the disputed
assertion.

## Closure and drills

Close only after search/API/UI verification, cache checks, ingestion block or
approved relisting, provenance impact completion, retention actions, requester
update, and owner approval. Record missed targets and corrective actions.

Before enabling any non-fixture source and at least twice yearly thereafter, run
a drill with synthetic data covering: provider-wide suspension, one vendor-code
correction, cache purge, quarantine hold, rollback, an active managed-share
terminalization, and proof that all unavailable share states remain generic. A
failed or stale drill returns the catalog gate to `BLOCKED_EXTERNAL`.
