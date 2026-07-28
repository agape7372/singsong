/**
 * ticket 테이블 접근자. PK 는 (plan_id, revision)(0001_initial.ts:45).
 */

import type { TicketSnapshot } from "@singsong/domain/models";
import type { SqlSession } from "../sql-executor";

type TicketRow = {
  plan_id: string;
  revision: number;
  payload: string;
  canonical_payload: string;
  artwork_seed: string;
  fingerprint: string;
  issue_motion_claimed_at: string | null;
  created_at: string;
};

const COLUMNS =
  "plan_id, revision, payload, canonical_payload, artwork_seed, fingerprint, issue_motion_claimed_at, created_at";

function toTicket(row: TicketRow): TicketSnapshot {
  return {
    planId: row.plan_id,
    revision: row.revision,
    payload: JSON.parse(row.payload),
    canonicalPayload: row.canonical_payload,
    artworkSeed: row.artwork_seed,
    fingerprint: row.fingerprint,
    issueMotionClaimedAt: row.issue_motion_claimed_at,
    createdAt: row.created_at,
  };
}

export async function getTicketRow(
  tx: SqlSession,
  planId: string,
  revision: number,
): Promise<TicketSnapshot | null> {
  const row = await tx.get<TicketRow>(
    `select ${COLUMNS} from ticket where plan_id = ? and revision = ?`,
    [planId, revision],
  );
  return row ? toTicket(row) : null;
}

/**
 * first-write-wins. `insert or ignore` 뒤 되읽는다 — 이미 있으면 삽입이 no-op(changes 0,
 * 저장값은 첫 것 유지, M8 실측)이고 되읽은 행이 그 첫 값이다. seed 불변성이 계약(T15).
 */
export async function insertTicketIfAbsent(
  tx: SqlSession,
  ticket: TicketSnapshot,
): Promise<TicketSnapshot> {
  await tx.run(`insert or ignore into ticket (${COLUMNS}) values (?, ?, ?, ?, ?, ?, ?, ?)`, [
    ticket.planId,
    ticket.revision,
    JSON.stringify(ticket.payload),
    ticket.canonicalPayload,
    ticket.artworkSeed,
    ticket.fingerprint,
    ticket.issueMotionClaimedAt,
    ticket.createdAt,
  ]);
  const stored = await getTicketRow(tx, ticket.planId, ticket.revision);
  if (!stored) throw new Error("saveTicket: 삽입 직후 티켓을 읽지 못했다");
  return stored;
}

/**
 * 미청구면 청구하고 true. `WHERE … AND issue_motion_claimed_at IS NULL` + `changes === 1`.
 * ★ 값이 같은 UPDATE 도 changes=1 이지만(M7 실측: sqlite3_changes 는 *쓰인* 행을 센다),
 *    WHERE 가 이미-청구 행과 없는 행을 걸러서 정확히 "이번에 청구함"만 1 이 된다.
 */
export async function claimMotion(
  tx: SqlSession,
  planId: string,
  revision: number,
  nowIso: string,
): Promise<boolean> {
  const result = await tx.run(
    "update ticket set issue_motion_claimed_at = ? where plan_id = ? and revision = ? and issue_motion_claimed_at is null",
    [nowIso, planId, revision],
  );
  return result.changes === 1;
}

/**
 * 최신순. `created_at desc, plan_id, revision desc`(인덱스 ticket_by_recency 와 같은 모양).
 * ★ created_at 동률에서 Dexie(`reverse()` → b#1 a#2 a#1)와 **다르다**(SQL: a#2 a#1 b#1,
 *    M13 실측). 곧 삭제될 Dexie 와 맞추려고 인덱스 방향을 바꾸지 않는다(§2.5). 이식 테스트를
 *    Dexie 답으로 "고치지" 말 것 — migrations.test.ts:133-156 이 SQL 답을 이미 정본으로 고정했다.
 */
export async function listTicketRows(tx: SqlSession): Promise<TicketSnapshot[]> {
  const rows = await tx.all<TicketRow>(
    `select ${COLUMNS} from ticket order by created_at desc, plan_id, revision desc`,
  );
  return rows.map(toTicket);
}
