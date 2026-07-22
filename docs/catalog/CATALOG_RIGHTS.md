# Catalog rights and production gate

Status: **BLOCKED_EXTERNAL**  
Applies to: TJ, KY, Manana, and any future non-fixture catalog source  
Decision owner: Product Operations + Legal/Data Rights  
Technical owner: Catalog Engineering

## Current decision

This repository does **not** contain evidence that SingSong may collect, cache,
normalize, display, or redistribute a production karaoke catalog. No document,
adapter name, public web page, vendor brand, API accessibility, or environment
variable is evidence of those rights.

Until an approved evidence package is linked from a rights manifest, the only
enabled catalog is deterministic, explicitly fake fixture data. The application
must keep `APP_PROFILE=fixture`; `NEXT_PUBLIC_APP_PROFILE=fixture` may describe
the UI profile but is never a trust boundary. Changing either value cannot grant
rights or activate a provider.

## Adapter gates

| Adapter             | Allowed now                                                                                          | Forbidden now                                                                                                     | Gate to advance                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `FixtureAdapter`    | Local development, automated tests, demos clearly marked `TEST DATA`                                 | Real song titles, artists, vendor codes, scraped samples, or a claim of catalog completeness                      | None for fixture use; fixture-generation review still applies                                                              |
| `MananaAdapter`     | Interface/schema technical spike using synthetic or provider-supplied, explicitly authorized samples | Fetching, durable caching, normalization, publishing, or redistribution of live provider data                     | Written approval that names the data, territory, purposes, retention, redistribution, and takedown channel                 |
| `TJOfficialAdapter` | Disabled implementation skeleton and contract tests against synthetic responses                      | Scraping TJ pages, replaying undocumented endpoints, importing codes, or using TJ marks/data in production        | Formal TJ permission or contract plus approved manifest and technical credentials issued through the secret manager        |
| `KYOfficialAdapter` | Disabled implementation skeleton and contract tests against synthetic responses                      | Scraping KY/KYSing pages, replaying undocumented endpoints, importing codes, or using KY marks/data in production | Formal KY/KYSing permission or contract plus approved manifest and technical credentials issued through the secret manager |

“Official” in an adapter class name means the intended integration channel; it
does not assert endorsement, affiliation, or permission.

## Required rights manifest

The production gate accepts a manifest only when an accountable human reviewer
has linked evidence. A code change, CI variable, dashboard toggle, or developer
self-attestation is insufficient. Each source manifest must include:

- stable `sourceId`, provider legal name, integration channel, and evidence ID;
- evidence location in the approved legal/contract repository (not copied into
  this Git repository when it is confidential);
- accountable Product Operations and Legal/Data Rights approvers;
- effective date, expiry/renewal date, territories, products, and environments;
- explicit capability decisions for `automatedFetch`, `cache`, `rawRetention`,
  `normalize`, `display`, `search`, `export`, and `redistribute`;
- permitted fields and records, attribution/branding duties, rate limits, and
  source terms/version;
- maximum raw and normalized retention, deletion requirements, and backup
  treatment;
- provider escalation/takedown channel and the internal owner/on-call role;
- credential reference name only; never a credential value;
- reviewer signature/time and a machine-readable status of `approved`,
  `suspended`, `expired`, or `revoked`.

Every capability is deny-by-default. An omitted capability is forbidden. An
expired, suspended, or revoked manifest disables fetch and publish even when
credentials still work.

## Production release gate

Production catalog publication remains `BLOCKED_EXTERNAL` until all of the
following evidence exists and is checked in the release record:

1. Approved, unexpired rights manifest for each enabled source and capability.
2. Provider-approved access method; no scraper or undocumented endpoint is used.
3. Ingestion dry run, quarantine review, provenance completeness check, and
   atomic rollback rehearsal from `INGESTION_RUNBOOK.md`.
4. Takedown owner and backup assigned, alert routing tested, and the response
   drill in `TAKEDOWN.md` completed.
5. Credential storage, rotation, least privilege, and egress allowlist verified
   outside the browser bundle and outside Git.
6. UI attribution, trademarks, notices, and territorial restrictions reviewed.
7. Monitoring and capacity controls enabled without logging catalog payloads,
   search terms, tokens, or personal data.
8. A release approver records `APPROVED_EXTERNAL` with evidence IDs. The app
   profile alone cannot change this state.

If any item is missing, production must stay fixture-only. Staging with real
data is also production use for this gate unless the agreement explicitly says
otherwise.

## Fixture integrity rules

- Fixture records use invented titles, invented artists, and visibly synthetic
  codes that are not represented as TJ or KY assignments.
- Fixtures carry `dataClass=fixture`, `rightsState=synthetic`, and a deterministic
  generation version in provenance.
- Product surfaces that can be screenshotted or demonstrated show `TEST DATA`.
- CI rejects fixture rows that claim a live provider source or omit the fixture
  marker.
- Fixtures are never promoted by copying rows into a production catalog table.
  Production ingestion starts from an approved adapter run with fresh provenance.

## Suspension and expiry

Manifest expiry or a takedown request immediately blocks new fetches and publish
runs for the affected scope. Existing records enter `suspended` quarantine until
Product Operations and Legal/Data Rights decide removal, correction, or renewed
authorization. The takedown process and response targets are defined in
`TAKEDOWN.md`; record lineage and evidence rules are defined in `PROVENANCE.md`.

## Claims this document does not make

This document does not state that TJ, KY/KYSing, Manana, or any other party has
approved SingSong. It does not interpret public availability as a license, and
it does not replace legal review. Its purpose is to ensure the software fails
closed while external rights remain unverified.
