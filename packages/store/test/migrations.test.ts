import { describe, expect, it } from "vitest";

import { MIGRATION_0001_EXPECTS, MIGRATION_0001_SQL } from "../src/migrations/0001_initial";
import { migrate, readUserVersion, type Migration } from "../src/migrations/run";
import { assertRealSqlExecutor } from "../src/sql-executor";
import { createNodeSqlExecutor } from "./node-sql-executor";

const INITIAL: Migration = {
  version: 1,
  name: "0001_initial",
  sql: MIGRATION_0001_SQL,
  expects: MIGRATION_0001_EXPECTS,
};

async function objectNames(executor: ReturnType<typeof createNodeSqlExecutor>) {
  const rows = await executor.all<{ name: string }>(
    "select name from sqlite_master where name not like 'sqlite_%' order by name",
  );
  return rows.map((row) => row.name);
}

describe("마이그레이션 러너", () => {
  it("빈 DB 에 0001 을 적용하고 user_version 을 1 로 올린다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      expect(await readUserVersion(executor)).toBe(0);
      expect(await migrate(executor, [INITIAL])).toEqual([1]);
      expect(await readUserVersion(executor)).toBe(1);
      expect(await objectNames(executor)).toEqual([...MIGRATION_0001_EXPECTS].sort());
    } finally {
      await executor.close();
    }
  });

  it("두 번 돌려도 아무 일도 하지 않는다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      await migrate(executor, [INITIAL]);
      expect(await migrate(executor, [INITIAL])).toEqual([]);
      expect(await readUserVersion(executor)).toBe(1);
    } finally {
      await executor.close();
    }
  });

  it("만들었어야 할 오브젝트가 없으면 user_version 을 찍지 않고 통째로 롤백한다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      // 스크립트는 멀쩡한데 expects 에 없는 이름이 하나 섞인 상황 = 스크립트가 잘렸을 때와 같은 신호.
      const broken: Migration = {
        ...INITIAL,
        expects: [...MIGRATION_0001_EXPECTS, "존재하지_않음"],
      };
      await expect(migrate(executor, [broken])).rejects.toThrow(/존재하지_않음/);
      expect(await readUserVersion(executor)).toBe(0);
      expect(await objectNames(executor)).toEqual([]);
    } finally {
      await executor.close();
    }
  });

  it("버전이 건너뛰면 거부한다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      const v2: Migration = { version: 2, name: "0002", sql: "select 1", expects: [] };
      await expect(migrate(executor, [v2])).rejects.toThrow(/순서가 어긋났다/);
      expect(await readUserVersion(executor)).toBe(0);
    } finally {
      await executor.close();
    }
  });
});

describe("execScript 가 필수인 이유", () => {
  it("prepare/run 은 멀티스테이트먼트를 조용히 자른다 — 이 성질이 러너 설계의 근거다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      // 이 테스트는 우리 코드가 아니라 **드라이버의 위험한 성질**을 고정한다.
      // 언젠가 node:sqlite 가 이걸 고치면 여기서 실패하고, 그때 러너의 방어를 재평가하면 된다.
      await executor.run(
        "create table a (x integer) strict; create table b (x integer) strict; create table c (x integer) strict;",
      );
      expect(await objectNames(executor)).toEqual(["a"]);
    } finally {
      await executor.close();
    }
  });

  it("execScript 는 전부 실행한다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      await executor.execScript(
        "create table a (x integer) strict; create table b (x integer) strict; create table c (x integer) strict;",
      );
      expect(await objectNames(executor)).toEqual(["a", "b", "c"]);
    } finally {
      await executor.close();
    }
  });
});

describe("스키마 불변식", () => {
  it("STRICT 가 실제로 타입을 강제한다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      await migrate(executor, [INITIAL]);
      await expect(
        executor.run(
          "insert into plan (id, revision, created_at, updated_at, items) values (?, ?, ?, ?, ?)",
          ["p", "정수아님", "t", "t", "[]"],
        ),
      ).rejects.toThrow(/cannot store TEXT value in INTEGER column/);
    } finally {
      await executor.close();
    }
  });

  it("plan.items 는 JSON 이 아니면 거부한다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      await migrate(executor, [INITIAL]);
      await expect(
        executor.run(
          "insert into plan (id, revision, created_at, updated_at, items) values (?, ?, ?, ?, ?)",
          ["p", 1, "t", "t", "JSON 아님"],
        ),
      ).rejects.toThrow(/CHECK constraint failed/);
    } finally {
      await executor.close();
    }
  });

  it("최근순 조회는 created_at 동률에서도 전순서다 — 인덱스 유무와 무관하게", async () => {
    const executor = createNodeSqlExecutor();
    try {
      await migrate(executor, [INITIAL]);
      const same = "2026-07-27T00:00:00.000Z";
      for (const [planId, revision] of [
        ["a", 1],
        ["a", 2],
        ["b", 1],
      ] as const) {
        await executor.run(
          "insert into ticket (plan_id, revision, payload, canonical_payload, artwork_seed, fingerprint, created_at) values (?, ?, '{}', '', '', '', ?)",
          [planId, revision, same],
        );
      }
      // 정본 정렬. 타이브레이커가 없으면 인덱스를 추가하는 것만으로 순서가 뒤집힌다(실측).
      const rows = await executor.all<{ plan_id: string; revision: number }>(
        "select plan_id, revision from ticket order by created_at desc, plan_id, revision desc",
      );
      expect(rows.map((r) => `${r.plan_id}#${r.revision}`)).toEqual(["a#2", "a#1", "b#1"]);
    } finally {
      await executor.close();
    }
  });
});

describe("CAS 는 SELECT 후 비교여야 한다", () => {
  it("ON CONFLICT … WHERE 는 행이 없으면 가드를 평가조차 하지 않는다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      await executor.execScript(
        "create table cas (k text primary key, revision integer not null) strict",
      );
      // 통과할 수 없는 가드인데도 INSERT 분기를 타서 행이 생긴다.
      const result = await executor.run(
        "insert into cas (k, revision) values (?, 1) on conflict(k) do update set revision = revision + 1 where cas.revision = -999",
        ["p"],
      );
      expect(result.changes).toBe(1);
      expect(await executor.get("select revision from cas where k = ?", ["p"])).toEqual({
        revision: 1,
      });
    } finally {
      await executor.close();
    }
  });

  it("트랜잭션 안 SELECT 후 비교는 부재와 stale 을 구분한다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      await executor.execScript(
        "create table cas (k text primary key, revision integer not null) strict",
      );

      const write = (key: string, expected: number) =>
        executor.transaction(async (tx) => {
          const row = await tx.get<{ revision: number }>("select revision from cas where k = ?", [
            key,
          ]);
          const actual = row?.revision ?? 0;
          if (actual !== expected) {
            throw new Error(
              `RevisionConflict expected=${expected} actual=${row ? actual : "부재"}`,
            );
          }
          const next = actual + 1;
          await tx.run(
            "insert into cas (k, revision) values (?, ?) on conflict(k) do update set revision = excluded.revision",
            [key, next],
          );
          return next;
        });

      expect(await write("p", 0)).toBe(1);
      await expect(write("p", 0)).rejects.toThrow("RevisionConflict expected=0 actual=1");
      expect(await write("p", 1)).toBe(2);
      await expect(write("없는키", 3)).rejects.toThrow("RevisionConflict expected=3 actual=부재");
    } finally {
      await executor.close();
    }
  });
});

describe("더미 실행기 방어", () => {
  it("정상 실행기는 왕복 검사를 통과한다", async () => {
    const executor = createNodeSqlExecutor();
    try {
      await expect(assertRealSqlExecutor(executor)).resolves.toBeUndefined();
    } finally {
      await executor.close();
    }
  });

  it("changes 를 항상 0 으로 돌려주는 실행기는 잡힌다", async () => {
    const real = createNodeSqlExecutor();
    try {
      // expo-sqlite 의 서버 런타임 더미가 정확히 이 모양이다 — 쓰기가 사라지는데 throw 는 없다.
      const dummy = { ...real, run: async () => ({ changes: 0, lastInsertRowId: 0 }) };
      await expect(assertRealSqlExecutor(dummy)).rejects.toThrow(/더미 구현/);
    } finally {
      await real.close();
    }
  });
});
