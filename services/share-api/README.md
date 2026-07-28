# SingSong share API

Framework-independent Node service for native-app search, immutable share links,
and the read-only `/s/:slug` landing page.

## Local fixture

```powershell
npm run share-api:test
npm run share-api:smoke
```

Fixture mode uses fictional search rows and a process-local share repository.
It never contacts Supabase, Redis, or a catalog provider.

Mutation requests must be JSON and include
`X-SingSong-Client: android/<semver>` or `ios/<semver>`. Fixture smoke may use
`fixture/<semver>`. This header is request hygiene and telemetry-free client
identification, not authentication; the raw value is never logged.

## Production preflight

```powershell
npm run share-api:preflight
```

The command intentionally exits non-zero until the Vercel, Supabase, Redis,
catalog-rights, Android signing, and Apple association values in `.env.example`
are supplied. It then probes the Supabase historical slug-key RPC before
returning `PASS`.

The service trusts only Vercel's `x-vercel-forwarded-for` copy when deriving
hashed rate buckets. A caller-supplied `x-forwarded-for` is ignored. The
production limiter is a Redis REST fixed window; the in-memory implementation is
fixture-only and is never selected by `APP_PROFILE=production`.
