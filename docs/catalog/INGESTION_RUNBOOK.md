# Catalog ingestion runbook

Release state: **BLOCKED_EXTERNAL** for every non-fixture source.  
Run owner: Catalog Engineering  
Approval owner: Product Operations + Legal/Data Rights

This runbook defines a reproducible, fail-closed path from an approved source to
a versioned catalog publication. It does not authorize any source. Read
`CATALOG_RIGHTS.md` before running an adapter.

## 1. Safe default: fixture-only

The default application profile is `APP_PROFILE=fixture`. Generate fixtures
deterministically from a checked-in generator version and seed, using invented
titles, invented artists, and synthetic non-vendor codes. Each row must carry:

- `dataClass=fixture` and `rightsState=synthetic`;
- generator name/version and deterministic seed identifier;
- `sourceId=fixture`, import run ID, and content hash;
- a `TEST DATA` presentation marker.

Do not seed a fixture from screenshots, provider pages, search results, copied
catalog exports, or remembered real song/code pairs. Fixture validation must fail
if a row claims `TJ`, `KY`, `KYSing`, or `Manana` as its source.

## 2. Preflight for any non-fixture run

Stop with `BLOCKED_EXTERNAL` unless every item below is true:

1. The adapter appears in an approved, unexpired rights manifest.
2. The manifest explicitly allows this environment and each requested action:
   fetch, cache, raw retention, normalize, display/search, and redistribution.
3. Provider method, permitted fields, territory, retention, rate limits,
   attribution, and takedown contact match the run configuration.
4. Credentials are obtained at runtime from the approved secret manager. Only a
   reference name appears in configuration or logs.
5. Source egress is allowlisted and the adapter is disabled by default.
6. A dry-run destination and quarantine capacity are available.
7. The previous published version and rollback pointer are healthy.

`NEXT_PUBLIC_APP_PROFILE`, a CI variable, or a successful network response is not
approval. Rights manifest evaluation must happen server-side before the adapter
opens a connection.

## 3. Adapter state machine

All adapters implement the same deny-by-default states:

`disabled -> preflight-approved -> dry-run -> reviewed -> publish-approved`

Any manifest expiry, provider suspension, schema drift, integrity alarm, or
takedown moves the adapter to `disabled` and blocks publication.

- `FixtureAdapter` may enter `publish-approved` only for the fixture catalog.
- `MananaAdapter` remains `disabled`/`dry-run` for synthetic or explicitly
  authorized samples until a rights manifest permits more.
- `TJOfficialAdapter` and `KYOfficialAdapter` remain disabled skeletons until
  their respective providers have approved the documented integration channel.

No adapter falls back to scraping when an official integration fails.

## 4. Ingestion sequence

### A. Open the run

Create an immutable import-run record with a random run ID, source ID, adapter
and schema versions, rights-manifest ID/version, environment, requested scope,
start time, and the hash of non-secret configuration. Do not put credentials,
tokens, raw request headers, search terms, or personal contact details in it.

Acquire a per-source publish lease. If another run owns the lease, exit without
fetching. Re-check the manifest after acquiring the lease to close approval races.

### B. Fetch within the approved envelope

Use documented provider endpoints, bounded pages/batches, explicit connect/read
timeouts, capped retries with jitter, and the approved rate limit. Treat redirects
to an unapproved host, TLS failure, unexpected content type, or response above the
configured byte cap as a hard failure.

Raw payload retention is disabled unless the manifest explicitly permits it. If
permitted, store encrypted raw blobs in the restricted evidence store under the
manifest retention period; the application database stores only a content hash
and evidence pointer. Never log response bodies.

### C. Stage and validate

Write fetched records to an isolated run-scoped staging area. A record is not
searchable until publication. Required validation includes:

- source record ID, source revision/observed time, and provenance fields present;
- UTF-8 decoding, bounded field sizes, Unicode normalization, trimmed single-line
  title/artist values, and rejection of NUL/control/bidi override characters;
- vendor is in the manifest allowlist and karaoke code is 1–6 ASCII digits when
  that field is authorized;
- no duplicate `(sourceId, sourceRecordId, sourceRevision)`;
- no duplicate `(vendor, code, sourceVersion)` within the published version;
- multiple TJ/KY codes are preserved as separate assertions; fuzzy matching never
  silently merges them into one “truth”;
- unknown fields and schema drift are quarantined, not silently discarded;
- every normalized value can be traced to source fields and a transformation
  version;
- record count, byte count, deletion ratio, and change ratio remain inside the
  approved run envelope.

### D. Quarantine

Quarantine is append-only and not user-visible. Use a stable reason code:

- `RIGHTS_NOT_APPROVED`, `MANIFEST_EXPIRED`, `OUT_OF_SCOPE`;
- `SCHEMA_DRIFT`, `MALFORMED_RECORD`, `FIELD_LIMIT`, `CONTROL_CHARACTER`;
- `DUPLICATE_SOURCE_ID`, `DUPLICATE_VENDOR_CODE`, `AMBIGUOUS_MATCH`;
- `UNSUPPORTED_VENDOR`, `PROVENANCE_MISSING`, `INTEGRITY_MISMATCH`;
- `TAKEDOWN_HOLD`.

Store the minimum data needed to diagnose the issue, encrypted and with the same
or shorter retention than the source agreement. Quarantine access is limited to
Catalog Engineering and the named rights reviewers. Exporting quarantined data
for ad-hoc analysis is forbidden.

### E. Review the dry run

Produce a metadata-only report: run ID, counts by outcome/reason, field-level
change counts, expected versus actual source version, collision counts, rights
manifest ID, and content/Merkle hashes. Samples shown to reviewers must follow
the agreement and must not be pasted into tickets or chat.

Require two approvals for a first source or schema change: Catalog Engineering
and Product Operations/Legal Data Rights. A routine run may use the manifest's
documented approval policy, but cannot approve itself.

### F. Publish atomically

Create a new immutable catalog version. In one transaction, attach validated
records and provenance, record the reviewed run, and move the single publication
pointer from the previous version to the new version. Never update the visible
catalog row-by-row.

After commit, run read-only smoke checks for search availability, record counts,
vendor-code uniqueness, provenance resolvability, and fixture leakage. If any
check fails, move the pointer back to the prior version and open an incident.

### G. Close and retain

Mark the run `published`, `quarantined`, `failed`, or `rolled_back`; record counts,
hashes, approval IDs, publication version, and completion time. Apply manifest
retention to staging/raw data. Provenance, approval, takedown, and publication
lineage are retained according to audit/legal policy even when catalog content is
removed.

## 5. Rollback

Rollback changes only the active publication pointer to a previously validated
immutable version. It does not erase the failed run, quarantine, approvals, or
provenance. Then:

1. disable the adapter and scheduled fetch;
2. purge only approved search/CDN caches by version key;
3. verify the old version is searchable and provenance-resolvable;
4. record incident correlation ID and affected versions;
5. follow `TAKEDOWN.md` if rights or provider integrity is involved.

Never “fix forward” directly in the visible catalog during an incident.

## 6. Scheduling, monitoring, and alerts

Non-fixture schedules remain disabled while the release gate is
`BLOCKED_EXTERNAL`. When approved, monitor metadata only:

- last successful run and source freshness;
- duration, page/record counts, retry/error counts, quarantine ratio;
- schema/version drift, deletion/change spikes, code collisions;
- manifest expiry horizon, adapter state, publish/rollback outcome;
- staging/quarantine capacity and retention deletion failures.

Alert Catalog Engineering on technical failure and Product Operations/Legal Data
Rights on manifest/takedown conditions. Do not emit raw catalog rows, payloads,
credentials, request headers, user search queries, or personal data.

## 7. Release evidence

A production catalog release record must link the rights manifest, dry-run report,
approval record, provenance completeness result, rollback rehearsal, takedown
drill, and monitoring dashboard. Without all evidence, the only valid outcome is
`BLOCKED_EXTERNAL` and fixture-only operation.
