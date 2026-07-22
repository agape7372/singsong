# Share snapshot SQL privilege checklist

Migration under review:
`supabase/migrations/20260722010000_share_snapshot_v1.sql`

This checklist is a verification recipe, not a claim of a deployed control. The
current result is `NOT_RUN / BLOCKED_EXTERNAL` until it is executed against the
actual Supabase project and attached to the release evidence. Use a disposable
branch database first; never paste credentials into commands, output, or Git.

## Expected privilege model

- `app_private_owner` is `NOLOGIN`, `NOINHERIT`, and owns both schemas, all
  relations, and all functions.
- The trusted migration role is a member of `app_private_owner` without admin
  option so hosted migrations can create/transfer owned objects; `anon`,
  `authenticated`, and `service_role` are not members.
- `PUBLIC`, `anon`, and `authenticated` have zero usage/CRUD/sequence/execute
  privilege in `app_private` and `app_api`.
- `service_role` has zero direct table/view/sequence privileges.
- `service_role` has `USAGE` only on `app_api` and `EXECUTE` only on these exact
  signatures:
  - `inspect_share_snapshot_v1(bytea,bytea,bytea)`
  - `create_share_snapshot_v1(bytea,bytea,smallint,bytea,text,bytea,bytea,bytea)`
  - `get_share_snapshot_v1(bytea)`
  - `required_share_slug_key_versions_v1()`
  - `revoke_share_snapshot_v1(bytea,bytea,bytea,bytea)`
  - `cleanup_share_snapshot_v1(integer)`
- No raw slug, idempotency key, management token, IP, Turnstile material, or
  credential is stored in any relation or function comment.

## BFF environment boundary

The current example configuration names values but intentionally leaves secrets
blank. `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are server-only; the latter must
map to `service_role` and must never be exported through a generic client or a
`NEXT_PUBLIC_*` variable. `SHARE_SLUG_HMAC_KEY_V1` derives the raw capability in
memory, while `SHARE_SLUG_ACTIVE_KEY_VERSION` selects the positive version stored
with each reservation. Startup/readiness compares the configured key registry
with `required_share_slug_key_versions_v1()`.

`RATE_LIMIT_IP_HMAC_KEY_V1` independently derives the 32-byte hour/day bucket
hashes. Do not reuse `RATE_LIMIT_REDIS_TOKEN` or any provider credential as an
HMAC key. `TURNSTILE_SECRET_KEY` and its response material remain in the BFF;
only completed verification reaches the hash-only SQL functions. `APP_PROFILE`
must fail closed when production-only values or external evidence are absent;
`NEXT_PUBLIC_APP_PROFILE` is display configuration, not authorization.

## Static review before applying

1. Confirm the migration contains no `GRANT` to `PUBLIC`, `anon`, or
   `authenticated`, and no table/sequence grant to `service_role`.
2. Confirm every privileged function is `SECURITY DEFINER`, has an empty
   `search_path`, a fixed statement timeout, fully qualified relation/function
   names, and an explicit owner.
3. Confirm default table, sequence, and function privileges are revoked for both
   schemas and the owner role.
4. Confirm active canonical-payload/fingerprint/revoke hash clear on revoke/expiry, 720-hour
   TTL is database-enforced, terminal share rows survive seven days, rate buckets
   survive at most 48 hours, and reservation hashes are never normally deleted.
5. Confirm the allowlist signatures match the server repository exactly. A
   generic Supabase client export or browser access to the server credential is a
   release failure.
6. Confirm `pgcrypto` is installed in the `extensions` schema and the active-row
   check recomputes SHA-256 over the exact canonical UTF-8 text; a supplied
   fingerprint mismatch must fail.

## Catalog queries after applying

Run as the migration/audit role in a transaction-safe SQL console.

```sql
select rolname,
       rolcanlogin,
       rolsuper,
       rolcreatedb,
       rolcreaterole,
       rolinherit,
       rolreplication,
       rolbypassrls
from pg_catalog.pg_roles
where rolname = 'app_private_owner';
-- Expected: one row and every boolean is false.

select members.rolname as member_role,
       memberships.admin_option
from pg_catalog.pg_auth_members as memberships
join pg_catalog.pg_roles as granted_roles
  on granted_roles.oid = memberships.roleid
join pg_catalog.pg_roles as members
  on members.oid = memberships.member
where granted_roles.rolname = 'app_private_owner'
order by members.rolname;
-- Expected: only approved migration/administration roles, all admin_option=false;
-- anon, authenticated, and service_role must be absent.

select role_name,
       pg_catalog.pg_has_role(role_name, 'app_private_owner', 'MEMBER')
         as direct_or_transitive_member
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
order by role_name;
-- Expected: false for every role, including transitive membership paths.

select n.nspname as schema_name,
       pg_catalog.pg_get_userbyid(n.nspowner) as owner
from pg_catalog.pg_namespace as n
where n.nspname in ('app_private', 'app_api')
order by n.nspname;
-- Expected owner for both: app_private_owner.

select installed.extname, namespaces.nspname as schema_name
from pg_catalog.pg_extension as installed
join pg_catalog.pg_namespace as namespaces
  on namespaces.oid = installed.extnamespace
where installed.extname = 'pgcrypto';
-- Expected: exactly pgcrypto / extensions.

select grantee, table_schema, table_name, privilege_type
from information_schema.table_privileges
where table_schema in ('app_private', 'app_api')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by grantee, table_schema, table_name, privilege_type;
-- Expected: zero rows.

with protected_relations as (
  select classes.oid, namespaces.nspname, classes.relname
  from pg_catalog.pg_class as classes
  join pg_catalog.pg_namespace as namespaces
    on namespaces.oid = classes.relnamespace
  where namespaces.nspname in ('app_private', 'app_api')
    and classes.relkind in ('r', 'p', 'v', 'm', 'f')
)
select roles.role_name,
       protected_relations.nspname,
       protected_relations.relname,
       privileges.privilege
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
cross join protected_relations
cross join (
  values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
) as privileges(privilege)
where pg_catalog.has_table_privilege(
  roles.role_name,
  protected_relations.oid,
  privileges.privilege
);
-- Expected: zero rows, including privileges inherited through role membership.

select grantee, object_schema, object_name, privilege_type
from information_schema.usage_privileges
where object_schema in ('app_private', 'app_api')
  and object_type = 'SEQUENCE'
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by grantee, object_schema, object_name;
-- Expected: zero rows.

with protected_sequences as (
  select classes.oid, namespaces.nspname, classes.relname
  from pg_catalog.pg_class as classes
  join pg_catalog.pg_namespace as namespaces
    on namespaces.oid = classes.relnamespace
  where namespaces.nspname in ('app_private', 'app_api')
    and classes.relkind = 'S'
)
select roles.role_name,
       protected_sequences.nspname,
       protected_sequences.relname,
       privileges.privilege
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
cross join protected_sequences
cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) as privileges(privilege)
where pg_catalog.has_sequence_privilege(
  roles.role_name,
  protected_sequences.oid,
  privileges.privilege
);
-- Expected: zero rows (and this migration creates zero sequences).
```

Check schema usage explicitly:

```sql
select role_name,
       pg_catalog.has_schema_privilege(role_name, 'app_private', 'USAGE')
         as private_usage,
       pg_catalog.has_schema_privilege(role_name, 'app_api', 'USAGE')
         as api_usage
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
order by role_name;
-- Expected: anon F/F, authenticated F/F, service_role F/T.
```

Inspect effective function ACLs including implicit defaults:

```sql
select namespaces.nspname as schema_name,
       functions.proname as function_name,
       pg_catalog.pg_get_function_identity_arguments(functions.oid) as arguments,
       coalesce(grantees.rolname, 'PUBLIC') as grantee,
       acl.privilege_type
from pg_catalog.pg_proc as functions
join pg_catalog.pg_namespace as namespaces
  on namespaces.oid = functions.pronamespace
cross join lateral pg_catalog.aclexplode(
  coalesce(functions.proacl, pg_catalog.acldefault('f', functions.proowner))
) as acl
left join pg_catalog.pg_roles as grantees
  on grantees.oid = acl.grantee
where namespaces.nspname in ('app_private', 'app_api')
  and coalesce(grantees.rolname, 'PUBLIC') in
    ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by schema_name, function_name, arguments, grantee;
-- Expected: only the six exact app_api/service_role EXECUTE rows.

select roles.role_name,
       namespaces.nspname as schema_name,
       functions.oid::pg_catalog.regprocedure as function_signature
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
cross join pg_catalog.pg_proc as functions
join pg_catalog.pg_namespace as namespaces
  on namespaces.oid = functions.pronamespace
where namespaces.nspname in ('app_private', 'app_api')
  and pg_catalog.has_function_privilege(roles.role_name, functions.oid, 'EXECUTE')
order by role_name, schema_name, function_signature;
-- Expected: service_role plus the six exact app_api signatures only; no rows
-- for anon/authenticated and no app_private helper rows.
```

Inspect definer safety:

```sql
select namespaces.nspname as schema_name,
       functions.proname as function_name,
       pg_catalog.pg_get_function_identity_arguments(functions.oid) as arguments,
       pg_catalog.pg_get_userbyid(functions.proowner) as owner,
       functions.prosecdef as security_definer,
       functions.proconfig
from pg_catalog.pg_proc as functions
join pg_catalog.pg_namespace as namespaces
  on namespaces.oid = functions.pronamespace
where namespaces.nspname in ('app_private', 'app_api')
order by schema_name, function_name, arguments;
-- Expected: owner app_private_owner; every app_api function is definer and has
-- search_path="" plus fixed statement_timeout/lock_timeout settings.
```

Inspect owner default ACLs and fail if a later migration restored default PUBLIC
function execution or role grants:

```sql
select pg_catalog.pg_get_userbyid(defaults.defaclrole) as creator_role,
       coalesce(namespaces.nspname, '<global>') as schema_name,
       defaults.defaclobjtype,
       defaults.defaclacl
from pg_catalog.pg_default_acl as defaults
left join pg_catalog.pg_namespace as namespaces
  on namespaces.oid = defaults.defaclnamespace
where (
    defaults.defaclnamespace = 0
    or namespaces.nspname in ('app_private', 'app_api')
  )
order by creator_role, schema_name, defaults.defaclobjtype;
-- Review app_private_owner and the actual migration creator. Their global
-- function defaults and schema defaults must show no
-- PUBLIC/anon/authenticated/service_role grant.
```

## Runtime denial tests

Run each role test inside `begin; ... rollback;` so test data cannot persist.
Permission-denied is the expected result for direct private access.

```sql
begin;
set local role anon;
select * from app_private.shared_plans limit 1;
rollback;

begin;
set local role authenticated;
select * from app_private.share_reservations limit 1;
rollback;

begin;
set local role service_role;
select * from app_private.share_rate_buckets limit 1;
rollback;
```

Then verify `service_role` can call only the allowlist. A zero hash is disposable
test input, not a credential:

```sql
begin;
set local role service_role;
select * from app_api.get_share_snapshot_v1(
  pg_catalog.decode(pg_catalog.repeat('00', 32), 'hex')
);
rollback;
-- Expected: available=false, no permission error, no persisted row.
```

Attempt one internal helper as `service_role` and each app API function as `anon`;
all must fail with permission denied. Also query every sequence dynamically and
verify `service_role` cannot call `nextval` (this version intentionally creates no
sequences).

## Behavioral database tests

Using synthetic `SharedPlanV1` payloads and random test-only hashes, verify:

- strict unknown-key/text/range/order/vendor-code validation;
- canonical payload SHA-256/fingerprint equality and the canonical 16-byte
  artwork-seed tail restriction;
- create, exact retry reuse, same-key/different-fingerprint conflict, and
  deterministic slug collision conflict with no fallback;
- same idempotency key/payload with a different revoke-token hash is a conflict,
  so a retry can never return a management token that does not own the snapshot;
- retry reuse does not increment create quota;
- inspect/reuse returns the stored slug hash; re-deriving with the stored key
  version must compare equal before the BFF returns a URL, and a wrong same-version
  secret must fail readiness/reuse;
- 10/hour and 30/day create limits; 60/hour and 200/day revoke limits; a rejected
  two-bucket attempt does not partially increment the other bucket;
- payload/fingerprint/token hash are cleared immediately on revoke and first-read
  expiry; reservation changes to terminal and detaches its active FK;
- missing, wrong-token, expired, and revoked lookups have the same database result
  shape; the BFF separately verifies equal public status/body/headers and timing
  budget;
- cleanup is bounded/idempotent, deletes terminal snapshots only after seven
  days, deletes expired rate buckets, and never deletes reservation hashes;
- concurrent create/get/revoke tests preserve one active share per reservation.

## External evidence still required

Database tests do not prove the Supabase dashboard/runtime boundary. The release
record must additionally show the `app_api` exposure configuration, server-only
secret-key mapping to `service_role`, disabled legacy key evidence, old-key 401
probe, scheduled daily UTC bounded cleanup, capacity/retention alerts, and browser
bundle secret scan. Until those checks run in the real environment, mark this
checklist `NOT_RUN / BLOCKED_EXTERNAL`, never `PASS`.
