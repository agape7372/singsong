# API_CONTRACT — 서버 계약 정본

> **정본 범위**: Postgres DDL · RPC 시그니처와 의미론 · RLS 정책 · 공유 payload Zod 스키마 · 서버 에러 계약 · 마이그레이션 파일 규칙.
> 이 문서와 다른 문서(PRODUCT_SPEC §12, BUILD_PLAN 구§4 포함)가 어긋나면 **이 문서가 이긴다**.
> **버전**: v1.0 · 2026-07-21 · 짝 문서: [`ARCHITECTURE.md`](./ARCHITECTURE.md)(클라 쪽 소유권), [`SECURITY.md`](./SECURITY.md)(위협모델)

---

## 0. 계약 원칙

1. 서버가 아는 것은 딱 두 가지다: **곡 카탈로그(`songs`, 읽기 전용)** 와 **공유 스냅샷(`shared_lists`, 제한적 쓰기)**. 개인 리스트·노트·히스토리는 서버로 보내지 않는다(ARCHITECTURE §데이터 흐름).
2. 클라이언트는 **anon key**로만 접근한다. `service_role` 키는 시드 스크립트의 로컬 env 전용이며 저장소·클라 번들에 절대 들어가지 않는다(SECURITY §env).
3. 스키마 변경은 `supabase/migrations/NNNN_설명.sql` 순번 파일로만 한다. 롤백 파일은 만들지 않는다(append-only, 수정은 새 마이그레이션으로).
4. 이 문서의 SQL은 **의미론이 계약**이다. 문법 세부(예: plpgsql vs sql)는 빌더가 조정할 수 있으나 **정렬 규칙·제약값·정책 의미는 바꿀 수 없다**. 바꿔야 하면 `DECISIONS_LOG.md`에 기록하고 이 문서를 갱신한다.

---

## 1. DDL 전문

### 1-1. 확장

```sql
create extension if not exists pg_trgm;
```

### 1-2. `songs` — 곡 카탈로그 (읽기 전용)

```sql
create table songs (
  id             bigint generated always as identity primary key,
  title          text not null check (char_length(title) between 1 and 120),
  artist         text not null check (char_length(artist) between 1 and 120),
  tj_no          text check (tj_no ~ '^[0-9]{1,6}$'),
  ky_no          text check (ky_no ~ '^[0-9]{1,6}$'),
  chosung        text,                 -- "ㅂㅍㅈ ㅇㅇㅇ" (title+artist 초성, 시드 시 생성)
  itunes_art_url text,                 -- 애플 CDN URL만 저장, 미디어 자체 호스팅 금지
  duration_sec   int check (duration_sec is null or duration_sec between 30 and 1200),
  created_at     timestamptz not null default now(),
  constraint songs_has_number check (tj_no is not null or ky_no is not null)
);

create unique index songs_tj_no_uq on songs (tj_no) where tj_no is not null;
create unique index songs_ky_no_uq on songs (ky_no) where ky_no is not null;
create index songs_trgm    on songs using gin ((title || ' ' || artist) gin_trgm_ops);
create index songs_chosung on songs using gin (chosung gin_trgm_ops);
```

> **단위 확정**: 곡 길이는 **`duration_sec`(초, int)** 하나뿐이다. `duration_min`(PRODUCT_SPEC §12 초안)은 폐기된 표기. 분 단위는 클라 계산에서 파생한다(`BUILD_PLAN §6`의 `perSongMinutes`는 `duration_sec/60` 반올림으로 만든다).
> **번호 없는 곡은 넣지 않는다**(`songs_has_number`). 번호가 없으면 노래방에서 부를 수 없어 카탈로그 가치가 없다.

### 1-3. `shared_lists` — 공유 스냅샷

```sql
create table shared_lists (
  slug              text primary key
                    check (slug ~ '^[A-Za-z0-9_-]{10}$'),      -- nanoid(10), 비열거형
  title             text not null check (char_length(title) between 1 and 60),
  payload           jsonb not null
                    check (jsonb_typeof(payload) = 'array'
                       and jsonb_array_length(payload) between 1 and 100
                       and pg_column_size(payload) <= 32768),   -- ≤32KB, 곡 ≤100 (SECURITY §어뷰징)
  calc_snapshot     jsonb
                    check (calc_snapshot is null or pg_column_size(calc_snapshot) <= 4096),
  created_by_device text check (created_by_device is null
                       or created_by_device ~ '^[0-9a-f-]{36}$'), -- 익명 device uuid, 로그인 아님
  fork_count        int not null default 0,
  created_at        timestamptz not null default now()
);
```

> `payload` 항목의 형태는 서버가 검사하지 않는다(비용·유연성). 대신 **읽는 쪽(공유 뷰·fork)이 Zod로 검증**하고, 실패 항목은 버린다(§4). 서버 CHECK는 크기·개수만 막는다.

---

## 2. RPC

### 2-1. `search_songs(q, max_results)` — 곡 검색

```sql
create or replace function search_songs(q text, max_results int default 20)
returns setof songs
language plpgsql stable
as $$
declare
  tq text := trim(q);
  eq text := replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_');
begin
  if length(tq) < 1 then
    return;                                    -- 빈 검색어 = 빈 결과 (에러 아님)
  end if;
  return query
  select s.*
  from songs s
  where (s.title || ' ' || s.artist) ilike '%' || eq || '%' escape '\'
     or s.chosung like '%' || eq || '%' escape '\'
     or s.tj_no = tq
     or s.ky_no = tq
  order by
    (s.tj_no = tq or s.ky_no = tq)                   desc,  -- ① 번호 정확 일치 최우선
    (s.title ilike eq || '%' escape '\')             desc,  -- ② 제목 전방 일치
    similarity(s.title || ' ' || s.artist, tq)       desc,  -- ③ trgm 유사도
    s.id                                             asc    -- ④ tie-break: 결정적 순서 보장
  limit least(greatest(coalesce(max_results, 20), 1), 50);
end;
$$;

grant execute on function search_songs(text, int) to anon;
```

**정렬 계약(불변)**: ① 번호 정확 일치 → ② 제목 전방 일치 → ③ 유사도 → ④ `id` 오름차순. 같은 입력은 항상 같은 순서를 반환해야 한다(e2e 스냅샷의 전제, TEST_PLAN 참조).
**이스케이프 계약**: 사용자 입력의 `%`·`_`·`\`는 literal로 취급한다(위 `eq`). 클라이언트는 별도 이스케이프를 하지 않는다(이중 이스케이프 금지).
**결과 상한**: 50. 페이지네이션 없음(MVP) — 상위 50으로 못 찾으면 검색어를 더 치는 UX(SCREENS `/search`).

### 2-2. `increment_fork(p_slug)` — fork 카운트

```sql
create or replace function increment_fork(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update shared_lists
     set fork_count = fork_count + 1
   where slug = p_slug;
$$;

revoke all on function increment_fork(text) from public;
grant execute on function increment_fork(text) to anon;
```

> `security definer`인 이유: `shared_lists`에 UPDATE 정책을 열지 않기 위해서다(§3). anon이 바꿀 수 있는 것은 "fork_count +1"이라는 이 연산 하나뿐이며, 임의 값 쓰기·다른 컬럼 변경은 경로 자체가 없다. 존재하지 않는 slug면 조용히 0행 갱신(에러 아님) — 클라는 결과를 신뢰하지 않고 fire-and-forget 한다.

---

## 3. RLS 정책 전문

```sql
alter table songs        enable row level security;
alter table shared_lists enable row level security;

-- songs: 누구나 읽기. 쓰기 정책 없음 → anon 쓰기 전면 차단 (시드는 service_role로만)
create policy songs_public_read on songs
  for select using (true);

-- shared_lists: 누구나 생성·열람. UPDATE/DELETE 정책 없음 → 직접 변경 불가
create policy shared_lists_public_insert on shared_lists
  for insert with check (true);
create policy shared_lists_public_read on shared_lists
  for select using (true);
```

| 주체 | songs | shared_lists |
|---|---|---|
| anon (클라) | SELECT만 | INSERT·SELECT만 (+`increment_fork` RPC) |
| service_role (시드 스크립트) | 전부 | 전부 (운영자 takedown 삭제 포함) |

> **공유 = 공개**다. slug를 아는 사람은 누구나 열람할 수 있고 이는 제품 의도(카톡 바이럴)다. 사용자 고지 문구는 UX_FLOWS §신뢰, 문구 원문은 MICROCOPY. 수정·삭제 API를 MVP에 열지 않는 근거와 takedown 운영 절차는 SECURITY §위협모델.

---

## 4. 공유 payload — Zod 스키마 (`lib/share.ts` 정본)

직렬화(공유 생성)와 역직렬화(공유 뷰·fork) **양쪽 모두** 이 스키마를 통과해야 한다. 역직렬화에서 항목 단위 실패는 **해당 항목만 제외**하고 진행하며, 전체 실패(배열 아님·0곡)는 SCREENS `/s/[slug]`의 에러 상태로 보낸다.

```ts
import { z } from 'zod';

export const listItemSnapshotSchema = z.object({
  songId: z.number().int().positive(),          // songs.id (비정규화 사본이므로 참조 무결성 요구 안 함)
  title:  z.string().min(1).max(120),
  artist: z.string().min(1).max(120),
  tjNo:   z.string().regex(/^\d{1,6}$/).nullable(),
  kyNo:   z.string().regex(/^\d{1,6}$/).nullable(),
  myKey:  z.string().regex(/^[+-](1[0-2]|[1-9])$/).nullable(),  // "-2", "+3" … ±12
  memo:   z.string().max(100).default(''),
  tags:   z.array(z.string().min(1).max(12)).max(5).default([]),
  order:  z.number().int().min(0).max(99),
});
export type ListItemSnapshot = z.infer<typeof listItemSnapshotSchema>;

export const sharedPayloadSchema = z.array(listItemSnapshotSchema).min(1).max(100);

export const calcSnapshotSchema = z.object({
  mode:   z.enum(['coin_per_song', 'coin_per_time', 'room_per_time']),
  people: z.number().int().min(1).max(30),
  price:  z.object({                              // BUILD_PLAN §6-1 PriceParams와 동일 필드
    pricePerSong: z.number().int().min(0).max(100_000).optional(),
    bundle: z.object({ x: z.number().int().min(0).max(1_000_000),
                       y: z.number().int().min(1).max(100) }).optional(),
    blockMin:   z.number().int().min(1).max(600).optional(),
    blockPrice: z.number().int().min(0).max(1_000_000).optional(),
    hourlyRate: z.number().int().min(0).max(10_000_000).optional(),
    freeMin:    z.number().int().min(0).max(600).optional(),
  }),
  result: z.object({
    totalMin:  z.number().int().min(0),
    totalCost: z.number().int().min(0),
    perPerson: z.number().int().min(0),
  }),
}).nullable();
```

**주의**: `title`·`memo`·`tags`는 **신뢰할 수 없는 사용자 입력**이다. 렌더 시 React 기본 이스케이프 밖으로 꺼내지 않는다 — `dangerouslySetInnerHTML` 전면 금지, `next/og`·PNG export 경로에서도 텍스트 노드로만 사용(SECURITY §XSS).

---

## 5. 서버 에러 계약 (클라 처리 분류)

| 상황 | 감지 방법 | 클라 동작 (정본: ARCHITECTURE §에러 전략) | 문구 (정본: MICROCOPY) |
|---|---|---|---|
| 네트워크 없음/타임아웃 | fetch 실패 | 검색: 오프라인 배너 + 재시도. 로컬 기능은 계속 동작 | "인터넷이 잠깐 끊겼나 봐" 계열 |
| Supabase 5xx/일시 장애 | `error.status >= 500` | 검색·공유 생성 재시도 버튼. 자동 재시도는 TanStack Query 기본(2회)까지만 | 재시도 유도 |
| CHECK/RLS 위반 (공유 생성) | insert error | 곡 100개 초과·제목 길이 등은 **클라에서 선검증**해 서버 도달 전 차단. 도달했다면 버그 → 일반 실패 문구 | 일반 실패 |
| slug 없음 (공유 뷰) | select 0행 | SCREENS `/s/[slug]` 404 상태 | 친절한 404 카피 |
| payload Zod 실패 (공유 뷰) | parse 실패 | 항목 단위 drop, 전체 실패면 404와 동급 처리 | 〃 |
| 빈 검색 결과 | RPC 0행 | 정상 상태(에러 아님) — 빈 결과 UI | "이 곡은 아직 없네" 계열 |

**공통 규칙**: 서버 에러 원문(영문 스택·코드)을 사용자에게 노출하지 않는다. 콘솔에도 남기지 않는다(`console.log` 금지 — 계측은 ANALYTICS 경유).

---

## 6. 마이그레이션 파일 규칙

```
supabase/migrations/
  0001_extensions.sql        # pg_trgm
  0002_songs.sql             # 테이블+인덱스 (§1-2)
  0003_shared_lists.sql      # 테이블 (§1-3)
  0004_rpc_search_songs.sql  # §2-1
  0005_rpc_increment_fork.sql# §2-2
  0006_rls.sql               # §3
```

- 4자리 순번 + snake_case 설명. 한 파일 = 한 관심사.
- 기존 파일 수정 금지 — 변경은 새 순번 파일로.
- 시드는 마이그레이션이 아니라 `scripts/seed/`(service_role, 로컬 실행)로 한다. e2e가 전제하는 고정 시드 곡(예: "밤편지")은 TEST_PLAN §시드 의존성 목록을 따른다.

---

## 7. 고찰 (왜 이렇게 결정했나)

| 결정 | 근거 | 기각한 대안 |
|---|---|---|
| `duration_sec`(초) 통일 | iTunes `trackTimeMillis`에서 파생 시 정밀도 보존. 분은 항상 파생값 | `duration_min` — 반올림 손실, 두 단위 공존은 이번에 실재한 모순의 원인 |
| payload 비정규화(곡 사본 저장) | 공유 뷰·fork가 `songs` 조인 없이 자립 — 원본 곡 삭제·오프라인과 무관하게 렌더 가능 | song_id 참조만 저장 — 조인 필요, takedown으로 곡 삭제 시 공유물 파손 |
| `fork_count`를 RPC로만 | UPDATE 정책을 여는 순간 anon이 임의 행을 덮어쓸 수 있음. definer RPC는 연산을 +1 하나로 좁힘 | 클라 직접 update — 위조·파괴 가능. 트리거 — insert 주체가 없어 부적합 |
| 서버는 payload 내부 무검증 | jsonb 스키마 검증은 PG에서 비용·복잡도 큼. 읽는 쪽 Zod가 최종 방어선이라 위조 payload는 렌더 단계에서 무해화됨 | pg_jsonschema — 확장 의존 추가, MVP 과잉 |
| 검색 상한 50·페이지네이션 없음 | 노래방 검색은 "정확히 그 곡 찾기" — 50위 밖 결과는 검색어 보강이 답 | 무한스크롤 — 복잡도 대비 가치 없음 |
| slug 수정·삭제 API 없음(MVP) | 공유물은 불변 스냅샷이라는 단순한 정신 모델. 삭제 요구는 운영자(takedown) 경로로 | 소유 디바이스 삭제 허용 — device id 위조 가능해 사실상 무의미한 보안 |

## 8. 검증 체크리스트 (이 계약의 테스트 방법)

- [ ] anon으로 `songs` INSERT/UPDATE 시도 → 거부되는지 (RLS)
- [ ] anon으로 `shared_lists` UPDATE/DELETE 시도 → 거부되는지
- [ ] payload 101곡·33KB 초과 INSERT → CHECK 위반으로 거부되는지
- [ ] `search_songs('%')` → literal `%`로 검색되는지 (이스케이프)
- [ ] `search_songs('48210')` → 번호 일치 곡이 1위인지 (정렬 계약 ①)
- [ ] 같은 검색어 2회 호출 → 동일 순서인지 (tie-break ④)
- [ ] `increment_fork('없는slug')` → 에러 없이 무시되는지
- [ ] Zod: `myKey:"+13"`·`tags` 6개·`memo` 101자 → 각각 거부되는지 (단위 테스트, TEST_PLAN)
