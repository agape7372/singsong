# Catalog provenance contract

Status: schema contract for fixture use; non-fixture publication is
**BLOCKED_EXTERNAL** pending approved rights evidence.

Provenance answers four questions without guessing: where a field came from,
which permission allowed its use, which deterministic transformation produced
it, and which published catalog versions exposed it. It is not a claim that any
named provider has authorized SingSong.

## Principles

1. Preserve source assertions; do not manufacture a universal “correct” song or
   karaoke code.
2. Every visible non-fixture field has a source edge and rights-manifest edge.
3. Published versions, transformations, approvals, and removals are immutable.
4. Correction creates a new assertion/version; it does not rewrite history.
5. Raw provider data is not retained unless the manifest explicitly allows it.
6. Fixtures are unmistakably synthetic and can never be promoted as source data.
7. Provenance metadata contains no credentials, tokens, user identifiers, search
   history, personal contact details, or confidential contract text.

## Logical records

These names describe the required data contract; physical storage may use
different table names if the mapping is documented.

### `catalog_sources`

| Field                          | Meaning                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `sourceId`                     | Stable internal identifier such as `fixture`; a name is not permission       |
| `providerLegalName`            | Legal entity from reviewed evidence, or `Synthetic fixture`                  |
| `adapterId` / `adapterVersion` | Code path and immutable build/version                                        |
| `integrationChannel`           | Approved API/export/manual delivery/synthetic generator                      |
| `state`                        | `disabled`, `technical_spike`, `approved`, `suspended`, `expired`, `revoked` |
| `createdAt` / `updatedAt`      | Audit timestamps; state history is retained separately                       |

### `catalog_rights_manifests`

| Field                                       | Meaning                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `manifestId` / `manifestVersion`            | Immutable approval identity                                                                  |
| `sourceId`                                  | Source governed by the manifest                                                              |
| `evidenceRef`                               | Pointer to restricted evidence; no secret or contract body                                   |
| `capabilities`                              | Explicit booleans for fetch/cache/raw retention/normalize/display/search/export/redistribute |
| `fieldScope`, `territories`, `environments` | Allowed data and use boundaries                                                              |
| `effectiveAt`, `expiresAt`, `revokedAt`     | Machine-enforced lifecycle                                                                   |
| `rawRetention`, `normalizedRetention`       | Maximum retention policies                                                                   |
| `approvalRefs`                              | Accountable reviewer records                                                                 |
| `termsVersion`, `attributionVersion`        | Reviewed obligations                                                                         |
| `takedownRouteRef`                          | Restricted operational route identifier, not contact details                                 |

An absent capability is false. A revoked, expired, suspended, or out-of-scope
manifest cannot be attached to a new import or publication.

### `catalog_import_runs`

| Field                                                            | Meaning                                         |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| `runId`                                                          | Random immutable run ID                         |
| `sourceId`, `manifestId`, `manifestVersion`                      | Source and permission evaluated at preflight    |
| `adapterVersion`, `schemaVersion`, `transformSetVersion`         | Reproducibility inputs                          |
| `configHash`                                                     | Hash of non-secret normalized configuration     |
| `sourceSnapshotRef`, `sourceObservedAt`                          | Provider snapshot/revision and observation time |
| `startedAt`, `completedAt`, `status`                             | Run lifecycle                                   |
| `fetchedCount`, `validCount`, `quarantinedCount`, `deletedCount` | Metadata-only outcomes                          |
| `inputDigest`, `stagedDigest`, `reportDigest`                    | Integrity evidence                              |
| `approvalRefs`, `publicationVersionId`                           | Review and result edges                         |

### `catalog_assertions`

One record represents one source assertion, not a forced cross-provider merge.

| Field                                          | Meaning                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `assertionId`                                  | Stable internal UUID                                                   |
| `sourceId`, `sourceRecordId`, `sourceRevision` | Provider identity and version                                          |
| `runId`, `manifestId`, `manifestVersion`       | Import and permission lineage                                          |
| `dataClass`                                    | `fixture`, `provider_supplied`, or another approved class              |
| `title`, `artist`                              | Normalized display values allowed by the manifest                      |
| `vendor`, `karaokeCode`                        | Optional source assertion; vendor/code remain paired                   |
| `observedAt`, `effectiveAt`, `withdrawnAt`     | Source lifecycle                                                       |
| `sourceContentHash`                            | Hash of the authorized source record or canonical permitted fields     |
| `normalizedContentHash`                        | Hash after the named transformation set                                |
| `transformTrace`                               | Ordered transformation IDs/versions and field mappings                 |
| `rightsState`                                  | `synthetic`, `approved`, `suspended`, `expired`, `revoked`, `takedown` |
| `supersedesAssertionId`                        | Explicit correction lineage, never an in-place rewrite                 |

If TJ and KY each assert a code for what appears to be the same song, keep two
assertions. A separately reviewed entity-resolution edge may connect them with a
method, confidence, reviewer, and version; it must not erase either source.

### `catalog_quarantine_entries`

Required fields are quarantine ID, run ID, source record reference/content hash,
reason code, first/last observed time, review state, reviewer reference, resolution
edge, and retention deadline. Store minimum diagnostic content and encrypt it.
Quarantine is never searchable or included in product analytics.

### `catalog_publications`

| Field                           | Meaning                                       |
| ------------------------------- | --------------------------------------------- |
| `publicationVersionId`          | Immutable visible catalog version             |
| `createdFromRunIds`             | Reviewed import runs included                 |
| `assertionSetDigest`            | Integrity digest of included assertions       |
| `rightsSnapshotDigest`          | Exact approved manifest versions used         |
| `approvedByRefs`, `publishedAt` | Accountable release evidence                  |
| `previousVersionId`             | Rollback lineage                              |
| `state`                         | `candidate`, `active`, `retired`, `withdrawn` |

The visible catalog pointer targets exactly one validated publication version.
Rollback moves that pointer; it does not mutate either version.

### `catalog_takedowns`

Record a random case ID, received/acknowledged/contained/resolved times, requester
verification state, legal scope reference, affected sources/assertions/publication
versions, action codes, owner/approver role references, and audit hash. Do not put
private correspondence or personal contact data in the application database.

## Field-level transformation trace

Each transformed visible field must be reproducible as:

`source field(s) -> transformation ID/version -> normalized value hash`

Allowed deterministic transformations include documented Unicode normalization,
whitespace policy, vendor-code validation, and schema mapping. Transliteration,
fuzzy matching, artist splitting, title correction, and entity resolution require
explicit transformation versions and review; they may not silently overwrite
source text.

## Fixture provenance

Fixture assertions use `sourceId=fixture`, `dataClass=fixture`,
`rightsState=synthetic`, generator version/seed reference, and a content hash.
They contain invented values and no TJ/KY/Manana source edge. CI must reject a
fixture publication if any row lacks these markers or claims provider approval.

## Integrity and access

- Use canonical serialization and SHA-256 content digests for comparison; a hash
  proves integrity, not ownership or permission.
- Keep approval and rights evidence in the restricted system of record and store
  only opaque references here.
- Restrict raw/quarantine/provenance write access to ingestion roles; application
  search roles receive only the approved active projection.
- Record state transitions append-only with actor role, time, reason code, and
  correlation ID. Logs contain IDs/counts, not catalog payloads.
- Verify all manifest and publication edges before atomically activating a version.
- A takedown or manifest expiry blocks new runs immediately and follows
  `TAKEDOWN.md`; deletion never removes the audit fact that an action occurred.

## Minimum provenance release test

A candidate version fails publication when any visible assertion lacks source,
run, manifest, transformation, content-hash, and publication edges; when a
manifest is not approved and current; when fixture/provider classes are mixed;
or when the assertion set digest cannot be reproduced. Until a real-source run
passes this test with external rights evidence, production remains
`BLOCKED_EXTERNAL`.
