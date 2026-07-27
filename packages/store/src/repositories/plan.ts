/**
 * plan 테이블 접근자. 첫 인자는 늘 `SqlSession` — 트랜잭션을 열지 않는다(공개 경계가 연다).
 *
 * items·pricing 은 JSON 한 컬럼(0001_initial.ts:23-34). 매퍼가 snake_case ↔ camelCase 와
 * JSON 왕복을 담당한다. `people`/`pricing` 은 nullable — null 을 그대로 바인딩한다
 * (boolean·undefined 는 node:sqlite 가 TypeError, 하지만 여기 그런 값은 안 나온다).
 */

import type { Plan } from "@singsong/domain/models";
import type { SqlSession } from "../sql-executor";

type PlanRow = {
  id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  items: string;
  people: number | null;
  pricing: string | null;
};

const COLUMNS = "id, revision, created_at, updated_at, items, people, pricing";

function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: JSON.parse(row.items),
    people: row.people,
    pricing: row.pricing === null ? null : JSON.parse(row.pricing),
  };
}

export async function readPlanRow(tx: SqlSession, id: string): Promise<Plan | null> {
  const row = await tx.get<PlanRow>(`select ${COLUMNS} from plan where id = ?`, [id]);
  return row ? toPlan(row) : null;
}

/**
 * 전체 치환 upsert. **WHERE 가드를 쓰지 않는다** — CAS(revision 비교)는 호출부가 같은
 * 트랜잭션 안 SELECT 로 이미 했다. `ON CONFLICT … WHERE` 는 행이 없으면 가드를 평가조차
 * 안 하고 INSERT 분기를 타므로(migrations.test.ts:159-178 실측) CAS 를 여기 두면 안 된다.
 */
export async function writePlanRow(tx: SqlSession, plan: Plan): Promise<void> {
  await tx.run(
    `insert into plan (${COLUMNS}) values (?, ?, ?, ?, ?, ?, ?)
     on conflict(id) do update set
       revision = excluded.revision,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       items = excluded.items,
       people = excluded.people,
       pricing = excluded.pricing`,
    [
      plan.id,
      plan.revision,
      plan.createdAt,
      plan.updatedAt,
      JSON.stringify(plan.items),
      plan.people,
      plan.pricing === null ? null : JSON.stringify(plan.pricing),
    ],
  );
}
