/**
 * `0001_initial` 스키마를 TS 모듈로 들고 있는다.
 *
 * 왜 .sql 파일이 아닌가 — 이 패키지는 결국 Metro 가 번들한다. `?raw` 임포트는 vite 전용이고
 * Metro 에서 임의 확장자를 문자열로 읽으려면 `sourceExts` 를 건드려야 한다. 런타임마다
 * 다른 로딩 경로를 두는 것보다 문자열 하나가 낫다. 편집기 SQL 지원을 잃는 대신
 * Node·Metro·vitest 어디서나 같은 코드로 로드된다.
 */
export const MIGRATION_0001_SQL = `
-- 싱송 로컬 DB 초기 스키마 (user_version = 1)
--
-- Dexie v1~v5 체인을 하나로 접었다. 배포된 기기가 0대라 이전 경로가 필요 없고,
-- v3→v4 의 receipt/secret 분리 같은 중간 상태를 재현할 이유도 없다.
-- 같은 이유로 이 파일은 M2 까지 자유롭게 고쳐도 된다 — 마이그레이션할 데이터가 없다.
--
-- 전 테이블 STRICT. 컬럼 타입이 실제로 강제된다
-- (실측: 'cannot store TEXT value in INTEGER column', 'unknown datatype for … "varchar(10)"').
--
-- ★ PRAGMA 는 여기 없다. 'journal_mode' 는 트랜잭션 안에서 못 바꾸고
--   'busy_timeout'·'foreign_keys' 는 연결 스코프라 연결을 열 때마다 다시 걸어야 한다.
--   'sql-executor.ts' 의 CONNECTION_PRAGMAS / DURABLE_PRAGMAS 참조.

create table plan (
  id         text    primary key,
  revision   integer not null,
  created_at text    not null,
  updated_at text    not null,
  -- 트랙 배열은 JSON 한 컬럼으로 둔다. 'assertValidTracks' 가 배열을 **단위로** 검증하므로
  -- 자식 테이블로 쪼개면 "절반만 기록된 플랜"이라는, 지금은 표현조차 불가능한 상태가 새로 생긴다.
  -- STRICT 안에서도 CHECK 는 동작하므로 스키마 레벨에서 방어한다(실측).
  items      text    not null check (json_valid(items)),
  people     integer,
  pricing    text             check (pricing is null or json_valid(pricing))
) strict;

create table ticket (
  plan_id                 text    not null,
  revision                integer not null,
  payload                 text    not null check (json_valid(payload)),
  canonical_payload       text    not null,
  artwork_seed            text    not null,
  fingerprint             text    not null,
  issue_motion_claimed_at text,
  created_at              text    not null,
  primary key (plan_id, revision)
) strict;

create table imported_share (
  slug          text    primary key,
  imported_at   text    not null,
  plan_revision integer not null
) strict;

create table managed_share_receipt (
  fingerprint text primary key,
  slug        text unique,
  expires_at  text,
  created_at  text not null
) strict;

-- ★ 열린 결정: 이 테이블에 'references managed_share_receipt(fingerprint) on delete cascade'
--   를 걸지 않았다. 현행 코드에 고아 secret 정리 경로가 있고('getManagedShare' 가 영수증 없는
--   secret 을 지운다) 테스트가 그걸 덮는다. CASCADE 를 넣으면 그 상태가 도달 불가가 되어
--   코드 경로와 테스트가 **조용히 죽는다**. 제품 결정 전까지는 현행 동작을 보존한다.
create table managed_share_secret (
  fingerprint     text primary key,
  idempotency_key text not null,
  revoke_token    text not null,
  created_at      text not null
) strict;

-- ★ 열린 결정: 'photo' 를 BLOB 이 아니라 파일 URI(TEXT)로 뒀다. expo-image-picker 의 출력이
--   URI 이고 DB 를 가볍게 유지한다. 다만 현행 'profile-avatar.tsx' 는 'URL.createObjectURL'
--   전제라 그쪽을 어떻게 바꿀지가 미검증이다. M5(설정 화면) 전에 확정한다.
create table profile (
  id         text primary key,
  nickname   text not null,
  color_id   text not null,
  photo_uri  text,
  updated_at text not null
) strict;

-- ★ 인덱스와 ORDER BY 타이브레이커는 한 몸이다.
--   'order by created_at desc' 만 쓰면 **데이터를 하나도 안 바꾸고 인덱스를 추가하는 것만으로**
--   행 순서가 뒤집힌다(실측: '#1 #2 #3 b#1' → 'b#1 #3 #2 #1'). Dexie 는 인덱스+PK 로
--   전순서를 줬지만 SQLite 는 주지 않는다. 조회는 반드시
--   'order by created_at desc, <pk...>' 로 쓰고, 인덱스도 같은 모양으로 만들어
--   temp b-tree 없이 커버링으로 서빙되게 한다.
create index ticket_by_recency on ticket (created_at desc, plan_id, revision desc);
create index imported_share_by_recency on imported_share (imported_at desc, slug);
create index managed_share_by_recency on managed_share_receipt (created_at desc, fingerprint);
create index managed_share_by_expiry on managed_share_receipt (expires_at);
`;

/** 이 스크립트가 만들어야 하는 sqlite_master 오브젝트. 러너가 user_version 을 찍기 전에 대조한다. */
export const MIGRATION_0001_EXPECTS = [
  "plan",
  "ticket",
  "imported_share",
  "managed_share_receipt",
  "managed_share_secret",
  "profile",
  "ticket_by_recency",
  "imported_share_by_recency",
  "managed_share_by_recency",
  "managed_share_by_expiry",
] as const;
