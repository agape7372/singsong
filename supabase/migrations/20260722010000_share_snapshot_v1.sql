-- SingSong managed share snapshots, version 1.
--
-- Security boundary:
--   * callers send only SHA-256/HMAC-derived 32-byte hashes to PostgreSQL;
--   * raw slugs, idempotency keys, management tokens, IP addresses, and
--     Turnstile material never enter this schema;
--   * private relations have no direct client or service-role privileges;
--   * the NOLOGIN owner exposes only the six allowlisted app_api functions.
--
-- The BFF must still perform bounded-body parsing, Turnstile verification,
-- trusted-origin checks, canonical JSON serialization/fingerprinting, and the
-- versioned calculation recomputation described by the application contract.

begin;

do $role$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'app_private_owner'
  ) then
    create role app_private_owner
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      noreplication
      nobypassrls;
  end if;
end
$role$;

alter role app_private_owner
  nologin
  nosuperuser
  nocreatedb
  nocreaterole
  noinherit
  noreplication
  nobypassrls;
alter role app_private_owner set search_path = '';
revoke app_private_owner from anon, authenticated, service_role;
-- Hosted Supabase's migration role is intentionally not assumed to be a true
-- superuser. Membership (without ADMIN OPTION) permits creating objects for,
-- and transferring ownership to, the dedicated NOLOGIN role. Browser/service
-- runtime roles were explicitly removed above.
grant app_private_owner to current_user;

do $encoding$
begin
  if pg_catalog.current_setting('server_encoding') <> 'UTF8' then
    raise exception using
      errcode = '22023',
      message = 'SingSong share snapshots require server_encoding=UTF8';
  end if;
end
$encoding$;

-- pgcrypto is used only to cross-check the BFF's SHA-256 fingerprint. Supabase
-- provisions the extensions schema; an extension installed elsewhere is a
-- deliberate deployment blocker because all definer references are qualified.
create extension if not exists pgcrypto with schema extensions;

do $pgcrypto_schema$
begin
  if not exists (
    select 1
    from pg_catalog.pg_extension as installed
    join pg_catalog.pg_namespace as namespaces
      on namespaces.oid = installed.extnamespace
    where installed.extname = 'pgcrypto'
      and namespaces.nspname = 'extensions'
  ) then
    raise exception using
      errcode = '3F000',
      message = 'pgcrypto must be installed in the extensions schema';
  end if;
end
$pgcrypto_schema$;

grant usage on schema extensions to app_private_owner;
grant execute on function extensions.digest(bytea, text) to app_private_owner;

create schema if not exists app_private authorization app_private_owner;
create schema if not exists app_api authorization app_private_owner;
alter schema app_private owner to app_private_owner;
alter schema app_api owner to app_private_owner;

create table app_private.share_reservations (
  id uuid primary key,
  idempotency_hash bytea not null,
  slug_hash bytea not null,
  slug_key_version smallint not null,
  active_share_id uuid,
  state text not null default 'active',
  created_at timestamptz not null,
  terminal_at timestamptz,
  terminal_reason text,
  constraint share_reservations_idempotency_hash_length
    check (pg_catalog.octet_length(idempotency_hash) = 32),
  constraint share_reservations_slug_hash_length
    check (pg_catalog.octet_length(slug_hash) = 32),
  constraint share_reservations_slug_key_version_positive
    check (slug_key_version > 0),
  constraint share_reservations_state
    check (state in ('active', 'terminal')),
  constraint share_reservations_terminal_reason
    check (terminal_reason is null or terminal_reason in ('revoked', 'expired')),
  constraint share_reservations_lifecycle
    check (
      (
        state = 'active'
        and active_share_id is not null
        and terminal_at is null
        and terminal_reason is null
      )
      or
      (
        state = 'terminal'
        and active_share_id is null
        and terminal_at is not null
        and terminal_reason is not null
        and terminal_at >= created_at
      )
    ),
  constraint share_reservations_idempotency_hash_key unique (idempotency_hash),
  constraint share_reservations_slug_hash_key unique (slug_hash),
  constraint share_reservations_active_share_id_key unique (active_share_id)
);

alter table app_private.share_reservations owner to app_private_owner;

create table app_private.shared_plans (
  id uuid primary key,
  reservation_id uuid not null,
  snapshot_fingerprint bytea,
  payload_canonical text,
  schema_version smallint not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  terminal_at timestamptz,
  revoked_at timestamptz,
  revoke_token_hash bytea,
  constraint shared_plans_reservation_id_key unique (reservation_id),
  constraint shared_plans_reservation_id_fkey
    foreign key (reservation_id)
    references app_private.share_reservations (id)
    on update restrict
    on delete restrict
    deferrable initially deferred,
  constraint shared_plans_schema_version_v1 check (schema_version = 1),
  constraint shared_plans_fixed_ttl
    check (expires_at = created_at + interval '720 hours'),
  constraint shared_plans_lifecycle
    check (
      (
        terminal_at is null
        and revoked_at is null
        and snapshot_fingerprint is not null
        and pg_catalog.octet_length(snapshot_fingerprint) = 32
        and payload_canonical is not null
        and pg_catalog.octet_length(payload_canonical) between 1 and 98304
        and revoke_token_hash is not null
        and pg_catalog.octet_length(revoke_token_hash) = 32
      )
      or
      (
        terminal_at is not null
        and terminal_at >= created_at
        and snapshot_fingerprint is null
        and payload_canonical is null
        and revoke_token_hash is null
        and (revoked_at is null or revoked_at = terminal_at)
      )
    )
);

alter table app_private.shared_plans owner to app_private_owner;

alter table app_private.share_reservations
  add constraint share_reservations_active_share_id_fkey
  foreign key (active_share_id)
  references app_private.shared_plans (id)
  on update restrict
  on delete restrict
  deferrable initially deferred;

create index shared_plans_active_expiry_idx
  on app_private.shared_plans (expires_at, id)
  where terminal_at is null;

create index shared_plans_terminal_cleanup_idx
  on app_private.shared_plans (terminal_at, id)
  where terminal_at is not null;

create table app_private.share_rate_buckets (
  bucket_kind text not null,
  bucket_hash bytea not null,
  window_start timestamptz not null,
  request_count integer not null,
  expires_at timestamptz not null,
  constraint share_rate_buckets_pkey
    primary key (bucket_kind, bucket_hash, window_start),
  constraint share_rate_buckets_kind
    check (bucket_kind in ('create_hour', 'create_day', 'revoke_hour', 'revoke_day')),
  constraint share_rate_buckets_hash_length
    check (pg_catalog.octet_length(bucket_hash) = 32),
  constraint share_rate_buckets_count_positive
    check (request_count > 0),
  constraint share_rate_buckets_retention
    check (
      expires_at > window_start
      and expires_at <= window_start + interval '48 hours'
    )
);

alter table app_private.share_rate_buckets owner to app_private_owner;
create index share_rate_buckets_expiry_idx
  on app_private.share_rate_buckets (expires_at);

-- RLS is a defense-in-depth layer for browser roles. It is intentionally not
-- forced: the NOLOGIN table owner must be able to execute the definer RPCs.
-- The service_role can bypass RLS, so the zero direct-GRANT contract below is
-- the actual service-role boundary.
alter table app_private.share_reservations enable row level security;
alter table app_private.shared_plans enable row level security;
alter table app_private.share_rate_buckets enable row level security;

comment on table app_private.share_reservations is
  'Permanent hash-only namespace reservations. Terminal rows intentionally survive ordinary cleanup.';
comment on column app_private.share_reservations.idempotency_hash is
  'Exactly 32 bytes. Never store or log the raw browser idempotency key.';
comment on column app_private.share_reservations.slug_hash is
  'Exactly 32 bytes. Never store or log the raw public capability slug.';
comment on table app_private.shared_plans is
  'Immutable 720-hour SharedPlanV1 snapshots; sensitive columns are cleared immediately on terminalization.';
comment on column app_private.shared_plans.payload_canonical is
  'Canonical UTF-8 JSON.stringify text, at most 96 KiB. The BFF reparses with the strict SharedPlanV1 schema.';
comment on column app_private.shared_plans.revoke_token_hash is
  'Exactly 32 bytes. The raw 256-bit management token remains browser-local.';
comment on table app_private.share_rate_buckets is
  'Hash-only fixed-window counters with a maximum 48-hour retention.';

create or replace function app_private.is_safe_integer(
  p_value jsonb,
  p_min numeric,
  p_max numeric
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_text text;
  v_number numeric;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'number' then
    return false;
  end if;

  v_text := p_value::text;
  if v_text !~ '^-?(0|[1-9][0-9]*)$' then
    return false;
  end if;

  v_number := v_text::numeric;
  return v_number >= p_min
    and v_number <= p_max
    and v_number >= -9007199254740991
    and v_number <= 9007199254740991;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end
$function$;

alter function app_private.is_safe_integer(jsonb, numeric, numeric)
  owner to app_private_owner;

create or replace function app_private.valid_user_text(
  p_value text,
  p_min_codepoints integer,
  p_max_codepoints integer
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
begin
  if p_value is null then
    return false;
  end if;

  if pg_catalog.char_length(p_value) < p_min_codepoints
    or pg_catalog.char_length(p_value) > p_max_codepoints
    or p_value <> pg_catalog.btrim(p_value)
    or not (p_value is nfc normalized)
    or p_value ~ '[[:cntrl:]]'
    or p_value ~ U&'[\007F-\009F\202A-\202E\2066-\2069]'
  then
    return false;
  end if;

  return true;
end
$function$;

alter function app_private.valid_user_text(text, integer, integer)
  owner to app_private_owner;

create or replace function app_private.jsonb_object_size(p_value jsonb)
returns integer
language plpgsql
immutable
parallel safe
security invoker
set search_path = ''
as $function$
declare
  v_size integer;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'object' then
    return null;
  end if;

  select pg_catalog.count(*)::integer
  into v_size
  from pg_catalog.jsonb_object_keys(p_value) as keys(key_name);
  return v_size;
end
$function$;

alter function app_private.jsonb_object_size(jsonb)
  owner to app_private_owner;

create or replace function app_private.jsonb_array_size(p_value jsonb)
returns integer
language plpgsql
immutable
parallel safe
security invoker
set search_path = ''
as $function$
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'array' then
    return null;
  end if;

  return pg_catalog.jsonb_array_length(p_value);
end
$function$;

alter function app_private.jsonb_array_size(jsonb)
  owner to app_private_owner;

create or replace function app_private.validate_shared_plan_v1(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_items jsonb;
  v_item jsonb;
  v_code jsonb;
  v_calculation jsonb;
  v_duration jsonb;
  v_pricing jsonb;
  v_bundle jsonb;
  v_derived jsonb;
  v_ordinality bigint;
  v_item_count integer;
  v_vendor text;
  v_seen_tj boolean;
  v_seen_ky boolean;
  v_low numeric;
  v_midpoint numeric;
  v_high numeric;
  v_total_low numeric;
  v_total_high numeric;
  v_per_person_low numeric;
  v_per_person_high numeric;
begin
  if p_payload is null
    or pg_catalog.jsonb_typeof(p_payload) <> 'object'
    or app_private.jsonb_object_size(p_payload) <> 4
    or not (p_payload ? 'schemaVersion')
    or not (p_payload ? 'artworkSeed')
    or not (p_payload ? 'items')
    or not (p_payload ? 'calculation')
  then
    return false;
  end if;

  if not app_private.is_safe_integer(p_payload -> 'schemaVersion', 1, 1)
    or pg_catalog.jsonb_typeof(p_payload -> 'artworkSeed') <> 'string'
    -- Unpadded base64url for exactly 16 bytes has 21 arbitrary characters and
    -- a final sextet with four zero padding bits: A, Q, g, or w.
    or (p_payload ->> 'artworkSeed') !~ '^[A-Za-z0-9_-]{21}[AQgw]$'
  then
    return false;
  end if;

  v_items := p_payload -> 'items';
  if pg_catalog.jsonb_typeof(v_items) <> 'array' then
    return false;
  end if;

  v_item_count := app_private.jsonb_array_size(v_items);
  if v_item_count < 1 or v_item_count > 100 then
    return false;
  end if;

  for v_item, v_ordinality in
    select element.value, element.ordinality
    from pg_catalog.jsonb_array_elements(v_items) with ordinality as element(value, ordinality)
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
      or app_private.jsonb_object_size(v_item) <> 5
      or not (v_item ? 'source')
      or not (v_item ? 'title')
      or not (v_item ? 'artist')
      or not (v_item ? 'karaokeCodes')
      or not (v_item ? 'order')
      or pg_catalog.jsonb_typeof(v_item -> 'source') <> 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'title') <> 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'artist') <> 'string'
      or (v_item ->> 'source') not in ('catalog', 'manual')
      or not app_private.valid_user_text(v_item ->> 'title', 1, 80)
      or not app_private.valid_user_text(v_item ->> 'artist', 0, 80)
      or not app_private.is_safe_integer(v_item -> 'order', v_ordinality - 1, v_ordinality - 1)
      or pg_catalog.jsonb_typeof(v_item -> 'karaokeCodes') <> 'array'
      or app_private.jsonb_array_size(v_item -> 'karaokeCodes') > 2
    then
      return false;
    end if;

    v_seen_tj := false;
    v_seen_ky := false;
    for v_code in
      select code.value
      from pg_catalog.jsonb_array_elements(v_item -> 'karaokeCodes') as code(value)
    loop
      if pg_catalog.jsonb_typeof(v_code) <> 'object'
        or app_private.jsonb_object_size(v_code) <> 2
        or not (v_code ? 'vendor')
        or not (v_code ? 'code')
        or pg_catalog.jsonb_typeof(v_code -> 'vendor') <> 'string'
        or pg_catalog.jsonb_typeof(v_code -> 'code') <> 'string'
        or (v_code ->> 'vendor') not in ('TJ', 'KY')
        or (v_code ->> 'code') !~ '^[0-9]{1,6}$'
      then
        return false;
      end if;

      v_vendor := v_code ->> 'vendor';
      if (v_vendor = 'TJ' and v_seen_tj) or (v_vendor = 'KY' and v_seen_ky) then
        return false;
      end if;
      v_seen_tj := v_seen_tj or v_vendor = 'TJ';
      v_seen_ky := v_seen_ky or v_vendor = 'KY';
    end loop;
  end loop;

  v_calculation := p_payload -> 'calculation';
  if pg_catalog.jsonb_typeof(v_calculation) <> 'object'
    or app_private.jsonb_object_size(v_calculation) <> 6
    or not (v_calculation ? 'modelVersion')
    or not (v_calculation ? 'songCount')
    or not (v_calculation ? 'duration')
    or not (v_calculation ? 'pricing')
    or not (v_calculation ? 'people')
    or not (v_calculation ? 'derived')
    or pg_catalog.jsonb_typeof(v_calculation -> 'modelVersion') <> 'string'
    or (v_calculation ->> 'modelVersion') is distinct from 'fallback-v1'
    or not app_private.is_safe_integer(v_calculation -> 'songCount', v_item_count, v_item_count)
    or not app_private.is_safe_integer(v_calculation -> 'people', 1, 30)
  then
    return false;
  end if;

  v_duration := v_calculation -> 'duration';
  if pg_catalog.jsonb_typeof(v_duration) <> 'object'
    or app_private.jsonb_object_size(v_duration) <> 4
    or not (v_duration ? 'lowSec')
    or not (v_duration ? 'midpointSec')
    or not (v_duration ? 'highSec')
    or not (v_duration ? 'coverageBps')
    or not app_private.is_safe_integer(v_duration -> 'lowSec', 0, 9007199254740991)
    or not app_private.is_safe_integer(v_duration -> 'midpointSec', 0, 9007199254740991)
    or not app_private.is_safe_integer(v_duration -> 'highSec', 0, 9007199254740991)
    or not app_private.is_safe_integer(v_duration -> 'coverageBps', 0, 0)
  then
    return false;
  end if;

  v_low := (v_duration ->> 'lowSec')::numeric;
  v_midpoint := (v_duration ->> 'midpointSec')::numeric;
  v_high := (v_duration ->> 'highSec')::numeric;
  if v_low > v_midpoint or v_midpoint > v_high then
    return false;
  end if;

  v_pricing := v_calculation -> 'pricing';
  if pg_catalog.jsonb_typeof(v_pricing) <> 'object'
    or not (v_pricing ? 'kind')
  then
    return false;
  end if;

  if v_pricing ->> 'kind' = 'song' then
    if app_private.jsonb_object_size(v_pricing) not in (2, 3)
      or not (v_pricing ? 'singlePriceWon')
      or (app_private.jsonb_object_size(v_pricing) = 2 and v_pricing ? 'bundle')
      or (app_private.jsonb_object_size(v_pricing) = 3 and not (v_pricing ? 'bundle'))
      or not app_private.is_safe_integer(v_pricing -> 'singlePriceWon', 1, 10000000)
    then
      return false;
    end if;

    if v_pricing ? 'bundle' then
      v_bundle := v_pricing -> 'bundle';
      if pg_catalog.jsonb_typeof(v_bundle) <> 'object'
        or app_private.jsonb_object_size(v_bundle) <> 2
        or not (v_bundle ? 'songs')
        or not (v_bundle ? 'priceWon')
        or not app_private.is_safe_integer(v_bundle -> 'songs', 1, 100)
        or not app_private.is_safe_integer(v_bundle -> 'priceWon', 1, 10000000)
      then
        return false;
      end if;
    end if;
  elsif v_pricing ->> 'kind' = 'time' then
    if app_private.jsonb_object_size(v_pricing) <> 3
      or not (v_pricing ? 'blockSeconds')
      or not (v_pricing ? 'blockPriceWon')
      or not app_private.is_safe_integer(v_pricing -> 'blockSeconds', 60, 86400)
      or not app_private.is_safe_integer(v_pricing -> 'blockPriceWon', 1, 10000000)
    then
      return false;
    end if;
  else
    return false;
  end if;

  v_derived := v_calculation -> 'derived';
  if pg_catalog.jsonb_typeof(v_derived) <> 'object'
    or app_private.jsonb_object_size(v_derived) <> 4
    or not (v_derived ? 'totalLowWon')
    or not (v_derived ? 'totalHighWon')
    or not (v_derived ? 'perPersonLowWon')
    or not (v_derived ? 'perPersonHighWon')
    or not app_private.is_safe_integer(v_derived -> 'totalLowWon', 0, 9007199254740991)
    or not app_private.is_safe_integer(v_derived -> 'totalHighWon', 0, 9007199254740991)
    or not app_private.is_safe_integer(v_derived -> 'perPersonLowWon', 0, 9007199254740991)
    or not app_private.is_safe_integer(v_derived -> 'perPersonHighWon', 0, 9007199254740991)
  then
    return false;
  end if;

  v_total_low := (v_derived ->> 'totalLowWon')::numeric;
  v_total_high := (v_derived ->> 'totalHighWon')::numeric;
  v_per_person_low := (v_derived ->> 'perPersonLowWon')::numeric;
  v_per_person_high := (v_derived ->> 'perPersonHighWon')::numeric;
  if v_total_low > v_total_high or v_per_person_low > v_per_person_high then
    return false;
  end if;

  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end
$function$;

alter function app_private.validate_shared_plan_v1(jsonb)
  owner to app_private_owner;

alter table app_private.shared_plans
  add constraint shared_plans_payload_v1
  check (
    payload_canonical is null
    or (
      app_private.validate_shared_plan_v1(payload_canonical::jsonb)
      and snapshot_fingerprint = extensions.digest(
        pg_catalog.convert_to(payload_canonical, 'UTF8'),
        'sha256'
      )
    )
  );

create or replace function app_private.guard_share_reservation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'share reservations are permanent';
  end if;

  if new.id is distinct from old.id
    or new.idempotency_hash is distinct from old.idempotency_hash
    or new.slug_hash is distinct from old.slug_hash
    or new.slug_key_version is distinct from old.slug_key_version
    or new.created_at is distinct from old.created_at
    or old.state <> 'active'
    or new.state <> 'terminal'
    or new.active_share_id is not null
    or new.terminal_at is null
    or new.terminal_reason not in ('revoked', 'expired')
  then
    raise exception using errcode = '55000', message = 'share reservation is immutable';
  end if;

  return new;
end
$function$;

alter function app_private.guard_share_reservation()
  owner to app_private_owner;

create trigger share_reservations_immutable
before update or delete on app_private.share_reservations
for each row execute function app_private.guard_share_reservation();

create or replace function app_private.guard_shared_plan()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if old.terminal_at is null
      or pg_catalog.clock_timestamp() < old.terminal_at + interval '7 days'
    then
      raise exception using errcode = '55000', message = 'active or recently terminal share is immutable';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id
    or new.reservation_id is distinct from old.reservation_id
    or new.schema_version is distinct from old.schema_version
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
    or old.terminal_at is not null
    or new.terminal_at is null
    or new.snapshot_fingerprint is not null
    or new.payload_canonical is not null
    or new.revoke_token_hash is not null
    or (new.revoked_at is not null and new.revoked_at <> new.terminal_at)
  then
    raise exception using errcode = '55000', message = 'share snapshot is immutable';
  end if;

  return new;
end
$function$;

alter function app_private.guard_shared_plan()
  owner to app_private_owner;

create trigger shared_plans_immutable
before update or delete on app_private.shared_plans
for each row execute function app_private.guard_shared_plan();

create or replace function app_private.consume_share_rate_bucket(
  p_bucket_kind text,
  p_bucket_hash bytea,
  p_limit integer,
  p_window_seconds integer,
  p_now timestamptz
)
returns boolean
language plpgsql
security invoker
volatile
parallel unsafe
set search_path = ''
as $function$
declare
  v_window_start timestamptz;
  v_rows integer;
begin
  if p_bucket_kind not in ('create_hour', 'create_day', 'revoke_hour', 'revoke_day')
    or p_bucket_hash is null
    or pg_catalog.octet_length(p_bucket_hash) <> 32
    or p_limit < 1
    or p_window_seconds not in (3600, 86400)
  then
    raise exception using errcode = '22023', message = 'invalid rate bucket input';
  end if;

  v_window_start := pg_catalog.to_timestamp(
    (
      pg_catalog.floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
    )::double precision
  );

  insert into app_private.share_rate_buckets as buckets (
    bucket_kind,
    bucket_hash,
    window_start,
    request_count,
    expires_at
  ) values (
    p_bucket_kind,
    p_bucket_hash,
    v_window_start,
    1,
    -- The daily UTC cleanup may run almost 24 hours after this becomes
    -- eligible. A 24-hour eligibility point keeps normal retention at or below
    -- the 48-hour product ceiling; scheduler delay is an external alert gate.
    v_window_start + interval '24 hours'
  )
  on conflict (bucket_kind, bucket_hash, window_start)
  do update
    set request_count = buckets.request_count + 1
    where buckets.request_count < p_limit;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end
$function$;

alter function app_private.consume_share_rate_bucket(text, bytea, integer, integer, timestamptz)
  owner to app_private_owner;

create or replace function app_private.terminalize_share_reservation(
  p_reservation_id uuid,
  p_reason text,
  p_now timestamptz
)
returns boolean
language plpgsql
security invoker
volatile
parallel unsafe
set search_path = ''
as $function$
declare
  v_reservation app_private.share_reservations%rowtype;
begin
  if p_reason not in ('revoked', 'expired') then
    raise exception using errcode = '22023', message = 'invalid terminal reason';
  end if;

  select reservations.*
  into v_reservation
  from app_private.share_reservations as reservations
  where reservations.id = p_reservation_id
  for update;

  if not found or v_reservation.state <> 'active' then
    return false;
  end if;

  update app_private.shared_plans as plans
  set snapshot_fingerprint = null,
      payload_canonical = null,
      revoke_token_hash = null,
      terminal_at = p_now,
      revoked_at = case when p_reason = 'revoked' then p_now else null end
  where plans.id = v_reservation.active_share_id
    and plans.terminal_at is null;

  if not found then
    raise exception using errcode = '23503', message = 'active share invariant failed';
  end if;

  update app_private.share_reservations as reservations
  set active_share_id = null,
      state = 'terminal',
      terminal_at = p_now,
      terminal_reason = p_reason
  where reservations.id = v_reservation.id;

  return true;
end
$function$;

alter function app_private.terminalize_share_reservation(uuid, text, timestamptz)
  owner to app_private_owner;

create or replace function app_api.inspect_share_snapshot_v1(
  p_idempotency_hash bytea,
  p_snapshot_fingerprint bytea,
  p_revoke_token_hash bytea
)
returns table (
  outcome text,
  slug_key_version smallint,
  stored_slug_hash bytea,
  expires_at timestamptz
)
language plpgsql
security definer
volatile
parallel unsafe
set search_path = ''
set statement_timeout = '2s'
set lock_timeout = '500ms'
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_reservation app_private.share_reservations%rowtype;
  v_share app_private.shared_plans%rowtype;
begin
  if p_idempotency_hash is null
    or pg_catalog.octet_length(p_idempotency_hash) <> 32
    or p_snapshot_fingerprint is null
    or pg_catalog.octet_length(p_snapshot_fingerprint) <> 32
    or p_revoke_token_hash is null
    or pg_catalog.octet_length(p_revoke_token_hash) <> 32
  then
    raise exception using errcode = '22023', message = 'invalid share inspection';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.encode(p_idempotency_hash, 'hex'), 0)
  );

  select reservations.*
  into v_reservation
  from app_private.share_reservations as reservations
  where reservations.idempotency_hash = p_idempotency_hash
  for update;

  if not found then
    return query select 'missing'::text, null::smallint, null::bytea, null::timestamptz;
    return;
  end if;

  if v_reservation.state <> 'active' then
    return query select 'conflict'::text, null::smallint, null::bytea, null::timestamptz;
    return;
  end if;

  select plans.*
  into v_share
  from app_private.shared_plans as plans
  where plans.id = v_reservation.active_share_id
  for update;

  if not found or v_share.terminal_at is not null or v_now >= v_share.expires_at then
    if found and v_share.terminal_at is null then
      perform app_private.terminalize_share_reservation(v_reservation.id, 'expired', v_now);
    end if;
    return query select 'conflict'::text, null::smallint, null::bytea, null::timestamptz;
    return;
  end if;

  if v_share.snapshot_fingerprint = p_snapshot_fingerprint
    and v_share.revoke_token_hash = p_revoke_token_hash
  then
    return query select
      'reusable'::text,
      v_reservation.slug_key_version,
      v_reservation.slug_hash,
      v_share.expires_at;
    return;
  end if;

  return query select 'conflict'::text, null::smallint, null::bytea, null::timestamptz;
end
$function$;

alter function app_api.inspect_share_snapshot_v1(bytea, bytea, bytea)
  owner to app_private_owner;

comment on function app_api.inspect_share_snapshot_v1(bytea, bytea, bytea) is
  'Pre-Turnstile inspection; reuse returns the stored slug hash for BFF key verification.';

create or replace function app_api.create_share_snapshot_v1(
  p_idempotency_hash bytea,
  p_slug_hash bytea,
  p_slug_key_version smallint,
  p_snapshot_fingerprint bytea,
  p_payload_canonical text,
  p_revoke_token_hash bytea,
  p_create_hour_bucket_hash bytea,
  p_create_day_bucket_hash bytea
)
returns table (
  outcome text,
  slug_key_version smallint,
  stored_slug_hash bytea,
  expires_at timestamptz
)
language plpgsql
security definer
volatile
parallel unsafe
set search_path = ''
set statement_timeout = '3s'
set lock_timeout = '750ms'
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_reservation app_private.share_reservations%rowtype;
  v_share app_private.shared_plans%rowtype;
  v_reservation_id uuid := pg_catalog.gen_random_uuid();
  v_share_id uuid := pg_catalog.gen_random_uuid();
  v_payload jsonb;
  v_constraint_name text;
begin
  if p_payload_canonical is null
    or pg_catalog.octet_length(p_payload_canonical) not between 1 and 98304
  then
    raise exception using errcode = '22023', message = 'invalid share request';
  end if;

  begin
    v_payload := p_payload_canonical::jsonb;
  exception
    when invalid_text_representation then
      raise exception using errcode = '22023', message = 'invalid share request';
  end;

  if p_idempotency_hash is null
    or pg_catalog.octet_length(p_idempotency_hash) <> 32
    or p_slug_hash is null
    or pg_catalog.octet_length(p_slug_hash) <> 32
    or p_slug_key_version is null
    or p_slug_key_version < 1
    or p_snapshot_fingerprint is null
    or pg_catalog.octet_length(p_snapshot_fingerprint) <> 32
    or p_revoke_token_hash is null
    or pg_catalog.octet_length(p_revoke_token_hash) <> 32
    or p_create_hour_bucket_hash is null
    or pg_catalog.octet_length(p_create_hour_bucket_hash) <> 32
    or p_create_day_bucket_hash is null
    or pg_catalog.octet_length(p_create_day_bucket_hash) <> 32
    or not app_private.validate_shared_plan_v1(v_payload)
  then
    raise exception using errcode = '22023', message = 'invalid share request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.encode(p_idempotency_hash, 'hex'), 0)
  );

  select reservations.*
  into v_reservation
  from app_private.share_reservations as reservations
  where reservations.idempotency_hash = p_idempotency_hash
  for update;

  if found then
    if v_reservation.state = 'active' then
      select plans.*
      into v_share
      from app_private.shared_plans as plans
      where plans.id = v_reservation.active_share_id
      for update;

      if found and (v_share.terminal_at is not null or v_now >= v_share.expires_at) then
        if v_share.terminal_at is null then
          perform app_private.terminalize_share_reservation(v_reservation.id, 'expired', v_now);
        end if;
        return query select 'conflict'::text, null::smallint, null::bytea, null::timestamptz;
        return;
      end if;

      if found
        and v_share.snapshot_fingerprint = p_snapshot_fingerprint
        and v_share.revoke_token_hash = p_revoke_token_hash
      then
        return query select
          'reused'::text,
          v_reservation.slug_key_version,
          v_reservation.slug_hash,
          v_share.expires_at;
        return;
      end if;
    end if;

    return query select 'conflict'::text, null::smallint, null::bytea, null::timestamptz;
    return;
  end if;

  begin
    if not app_private.consume_share_rate_bucket(
      'create_hour', p_create_hour_bucket_hash, 10, 3600, v_now
    ) then
      raise exception using errcode = 'P0001', message = 'share create rate limited';
    end if;
    if not app_private.consume_share_rate_bucket(
      'create_day', p_create_day_bucket_hash, 30, 86400, v_now
    ) then
      raise exception using errcode = 'P0001', message = 'share create rate limited';
    end if;

    insert into app_private.share_reservations (
      id,
      idempotency_hash,
      slug_hash,
      slug_key_version,
      active_share_id,
      state,
      created_at
    ) values (
      v_reservation_id,
      p_idempotency_hash,
      p_slug_hash,
      p_slug_key_version,
      v_share_id,
      'active',
      v_now
    );

    insert into app_private.shared_plans (
      id,
      reservation_id,
      snapshot_fingerprint,
      payload_canonical,
      schema_version,
      created_at,
      expires_at,
      revoke_token_hash
    ) values (
      v_share_id,
      v_reservation_id,
      p_snapshot_fingerprint,
      p_payload_canonical,
      1,
      v_now,
      v_now + interval '720 hours',
      p_revoke_token_hash
    );
  exception
    when sqlstate 'P0001' then
      return query select 'rate_limited'::text, null::smallint, null::bytea, null::timestamptz;
      return;
    when unique_violation then
      -- A deterministic slug collision has no random fallback. The BFF maps
      -- this generic conflict and requires a fresh browser idempotency key.
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name not in (
        'share_reservations_idempotency_hash_key',
        'share_reservations_slug_hash_key'
      ) then
        raise;
      end if;
      return query select 'conflict'::text, null::smallint, null::bytea, null::timestamptz;
      return;
  end;

  return query select
    'created'::text,
    p_slug_key_version,
    p_slug_hash,
    v_now + interval '720 hours';
end
$function$;

alter function app_api.create_share_snapshot_v1(
  bytea, bytea, smallint, bytea, text, bytea, bytea, bytea
) owner to app_private_owner;

comment on function app_api.create_share_snapshot_v1(
  bytea, bytea, smallint, bytea, text, bytea, bytea, bytea
) is
  'Hash-only create; reuse returns the stored slug hash for BFF key verification without quota.';

create or replace function app_api.get_share_snapshot_v1(p_slug_hash bytea)
returns table (
  available boolean,
  snapshot_fingerprint bytea,
  payload_canonical text,
  expires_at timestamptz
)
language plpgsql
security definer
volatile
parallel unsafe
set search_path = ''
set statement_timeout = '2s'
set lock_timeout = '500ms'
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_reservation app_private.share_reservations%rowtype;
  v_share app_private.shared_plans%rowtype;
begin
  if p_slug_hash is null or pg_catalog.octet_length(p_slug_hash) <> 32 then
    return query select false, null::bytea, null::text, null::timestamptz;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.encode(p_slug_hash, 'hex'), 1)
  );

  select reservations.*
  into v_reservation
  from app_private.share_reservations as reservations
  where reservations.slug_hash = p_slug_hash
  for update;

  if not found or v_reservation.state <> 'active' then
    return query select false, null::bytea, null::text, null::timestamptz;
    return;
  end if;

  select plans.*
  into v_share
  from app_private.shared_plans as plans
  where plans.id = v_reservation.active_share_id
  for update;

  if not found or v_share.terminal_at is not null or v_now >= v_share.expires_at then
    if found and v_share.terminal_at is null then
      perform app_private.terminalize_share_reservation(v_reservation.id, 'expired', v_now);
    end if;
    return query select false, null::bytea, null::text, null::timestamptz;
    return;
  end if;

  return query select true, v_share.snapshot_fingerprint, v_share.payload_canonical, v_share.expires_at;
end
$function$;

alter function app_api.get_share_snapshot_v1(bytea)
  owner to app_private_owner;

comment on function app_api.get_share_snapshot_v1(bytea) is
  'Exact hash lookup. Missing, revoked, and expired snapshots all return the same unavailable tuple.';

create or replace function app_api.required_share_slug_key_versions_v1()
returns table (slug_key_version smallint)
language sql
security definer
volatile
parallel unsafe
set search_path = ''
set statement_timeout = '2s'
set lock_timeout = '500ms'
as $function$
  select distinct reservations.slug_key_version
  from app_private.share_reservations as reservations
  join app_private.shared_plans as plans
    on plans.id = reservations.active_share_id
  where reservations.state = 'active'
    and plans.terminal_at is null
    and pg_catalog.statement_timestamp() < plans.expires_at
  order by reservations.slug_key_version
$function$;

alter function app_api.required_share_slug_key_versions_v1()
  owner to app_private_owner;

comment on function app_api.required_share_slug_key_versions_v1() is
  'Active slug-key versions required by BFF startup/readiness; returns no secret material.';

create or replace function app_api.revoke_share_snapshot_v1(
  p_slug_hash bytea,
  p_revoke_token_hash bytea,
  p_revoke_hour_bucket_hash bytea,
  p_revoke_day_bucket_hash bytea
)
returns table (outcome text)
language plpgsql
security definer
volatile
parallel unsafe
set search_path = ''
set statement_timeout = '3s'
set lock_timeout = '750ms'
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_reservation app_private.share_reservations%rowtype;
  v_share app_private.shared_plans%rowtype;
begin
  if p_slug_hash is null
    or pg_catalog.octet_length(p_slug_hash) <> 32
    or p_revoke_token_hash is null
    or pg_catalog.octet_length(p_revoke_token_hash) <> 32
    or p_revoke_hour_bucket_hash is null
    or pg_catalog.octet_length(p_revoke_hour_bucket_hash) <> 32
    or p_revoke_day_bucket_hash is null
    or pg_catalog.octet_length(p_revoke_day_bucket_hash) <> 32
  then
    return query select 'unavailable'::text;
    return;
  end if;

  begin
    if not app_private.consume_share_rate_bucket(
      'revoke_hour', p_revoke_hour_bucket_hash, 60, 3600, v_now
    ) then
      raise exception using errcode = 'P0001', message = 'share revoke rate limited';
    end if;
    if not app_private.consume_share_rate_bucket(
      'revoke_day', p_revoke_day_bucket_hash, 200, 86400, v_now
    ) then
      raise exception using errcode = 'P0001', message = 'share revoke rate limited';
    end if;
  exception
    when sqlstate 'P0001' then
      return query select 'rate_limited'::text;
      return;
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.encode(p_slug_hash, 'hex'), 1)
  );

  select reservations.*
  into v_reservation
  from app_private.share_reservations as reservations
  where reservations.slug_hash = p_slug_hash
  for update;

  if not found or v_reservation.state <> 'active' then
    return query select 'unavailable'::text;
    return;
  end if;

  select plans.*
  into v_share
  from app_private.shared_plans as plans
  where plans.id = v_reservation.active_share_id
  for update;

  if not found
    or v_share.terminal_at is not null
    or v_now >= v_share.expires_at
    or v_share.revoke_token_hash is distinct from p_revoke_token_hash
  then
    if found and v_share.terminal_at is null and v_now >= v_share.expires_at then
      perform app_private.terminalize_share_reservation(v_reservation.id, 'expired', v_now);
    end if;
    return query select 'unavailable'::text;
    return;
  end if;

  perform app_private.terminalize_share_reservation(v_reservation.id, 'revoked', v_now);
  return query select 'revoked'::text;
end
$function$;

alter function app_api.revoke_share_snapshot_v1(bytea, bytea, bytea, bytea)
  owner to app_private_owner;

comment on function app_api.revoke_share_snapshot_v1(bytea, bytea, bytea, bytea) is
  'Hash-only revoke. Wrong token, missing slug, expired slug, and revoked slug are indistinguishable.';

create or replace function app_api.cleanup_share_snapshot_v1(p_limit integer)
returns table (
  terminalized_count integer,
  deleted_snapshot_count integer,
  deleted_bucket_count integer
)
language plpgsql
security definer
volatile
parallel unsafe
set search_path = ''
set statement_timeout = '10s'
set lock_timeout = '1s'
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_reservation_id uuid;
  v_terminalized integer := 0;
  v_deleted_snapshots integer := 0;
  v_deleted_buckets integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception using errcode = '22023', message = 'cleanup limit out of range';
  end if;

  for v_reservation_id in
    select reservations.id
    from app_private.share_reservations as reservations
    join app_private.shared_plans as plans
      on plans.id = reservations.active_share_id
    where reservations.state = 'active'
      and plans.terminal_at is null
      and plans.expires_at <= v_now
    order by plans.expires_at, reservations.id
    limit p_limit
    for update of reservations skip locked
  loop
    if app_private.terminalize_share_reservation(v_reservation_id, 'expired', v_now) then
      v_terminalized := v_terminalized + 1;
    end if;
  end loop;

  delete from app_private.shared_plans as plans
  where plans.id in (
    select candidates.id
    from app_private.shared_plans as candidates
    where candidates.terminal_at <= v_now - interval '7 days'
    order by candidates.terminal_at, candidates.id
    limit p_limit
    for update skip locked
  );
  get diagnostics v_deleted_snapshots = row_count;

  delete from app_private.share_rate_buckets as buckets
  where buckets.ctid in (
    select candidates.ctid
    from app_private.share_rate_buckets as candidates
    where candidates.expires_at <= v_now
    order by candidates.expires_at
    limit p_limit
    for update skip locked
  );
  get diagnostics v_deleted_buckets = row_count;

  return query select v_terminalized, v_deleted_snapshots, v_deleted_buckets;
end
$function$;

alter function app_api.cleanup_share_snapshot_v1(integer)
  owner to app_private_owner;

comment on function app_api.cleanup_share_snapshot_v1(integer) is
  'Bounded idempotent cleanup. Never deletes hash-only namespace reservations.';

-- Deny-by-default current-object privileges.
revoke all on schema app_private from public, anon, authenticated, service_role;
revoke all on schema app_api from public, anon, authenticated, service_role;
revoke all on all tables in schema app_private from public, anon, authenticated, service_role;
revoke all on all tables in schema app_api from public, anon, authenticated, service_role;
revoke all on all sequences in schema app_private from public, anon, authenticated, service_role;
revoke all on all sequences in schema app_api from public, anon, authenticated, service_role;
revoke all on all functions in schema app_private from public, anon, authenticated, service_role;
revoke all on all functions in schema app_api from public, anon, authenticated, service_role;

-- Deny-by-default future-object privileges for the NOLOGIN owner.
-- Function EXECUTE defaults are global in PostgreSQL, so revoke the global
-- default for both the owner and the migration creator (the current role).
alter default privileges for role app_private_owner
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role app_private_owner in schema app_private
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role app_private_owner in schema app_api
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role app_private_owner in schema app_private
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role app_private_owner in schema app_api
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role app_private_owner in schema app_private
  revoke all on functions from public, anon, authenticated, service_role;
alter default privileges for role app_private_owner in schema app_api
  revoke all on functions from public, anon, authenticated, service_role;
-- Future objects are normally created by the migration role and then reassigned,
-- so apply the same schema defaults to the current migration creator as well.
alter default privileges in schema app_private
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema app_api
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema app_private
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema app_api
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema app_private
  revoke all on functions from public, anon, authenticated, service_role;
alter default privileges in schema app_api
  revoke all on functions from public, anon, authenticated, service_role;

-- Exact server-side allowlist. Browser roles receive no app_api schema usage.
grant usage on schema app_api to service_role;
grant execute on function app_api.inspect_share_snapshot_v1(bytea, bytea, bytea)
  to service_role;
grant execute on function app_api.create_share_snapshot_v1(
  bytea, bytea, smallint, bytea, text, bytea, bytea, bytea
) to service_role;
grant execute on function app_api.get_share_snapshot_v1(bytea) to service_role;
grant execute on function app_api.required_share_slug_key_versions_v1()
  to service_role;
grant execute on function app_api.revoke_share_snapshot_v1(bytea, bytea, bytea, bytea)
  to service_role;
grant execute on function app_api.cleanup_share_snapshot_v1(integer) to service_role;

commit;

-- Scheduler activation is intentionally external. A production release must
-- record evidence that a daily UTC job invokes cleanup_share_snapshot_v1 with
-- a bounded limit, alerts on failure/capacity, and cannot call arbitrary SQL.
--
-- Manual rollback guidance (destructive; never run as an unattended down step):
--   1. Stop create/read/revoke traffic and the cleanup scheduler.
--   2. Revoke the six exact service_role EXECUTE grants and app_api USAGE.
--   3. Export required audit evidence and confirm retention/legal obligations.
--   4. Drop allowlisted functions, then triggers/helpers, then shared_plans,
--      share_rate_buckets, and finally share_reservations.
--   5. Drop the two schemas and NOLOGIN owner only after proving they own no
--      unrelated objects. Never delete reservations while the namespace or an
--      old client idempotency key can still be replayed.
--   6. Do not drop the shared pgcrypto extension; other Supabase objects may
--      depend on it. Remove it only through a separate dependency audit.
