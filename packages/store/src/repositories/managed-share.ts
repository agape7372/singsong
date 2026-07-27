/**
 * managed_share_receipt · managed_share_secret 접근자.
 *
 * ★ 두 테이블 사이에 FK 가 **없다**(0001_initial.ts:61-64). 그래서 고아 secret(영수증 없는
 *    secret)이 표현 가능하고, 그걸 지우는 경로가 둘 있다(getManagedShare 단건 정리 +
 *    removeExpiredAndStale 일괄). CASCADE 를 넣으면 그 상태가 도달 불가가 되어 두 경로와
 *    tripwire 테스트가 조용히 죽는다 — P3 에서 FK 를 넣지 않는 결정을 그대로 보존한다.
 */

import type { ManagedShareReceipt, ManagedShareSecret } from "../policy";
import type { SqlSession } from "../sql-executor";

type ReceiptRow = {
  fingerprint: string;
  slug: string | null;
  expires_at: string | null;
  created_at: string;
};

type SecretRow = {
  fingerprint: string;
  idempotency_key: string;
  revoke_token: string;
  created_at: string;
};

function toReceipt(row: ReceiptRow): ManagedShareReceipt {
  return {
    fingerprint: row.fingerprint,
    slug: row.slug,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function toSecret(row: SecretRow): ManagedShareSecret {
  return {
    fingerprint: row.fingerprint,
    idempotencyKey: row.idempotency_key,
    revokeToken: row.revoke_token,
    createdAt: row.created_at,
  };
}

const RECEIPT_COLUMNS = "fingerprint, slug, expires_at, created_at";
const SECRET_COLUMNS = "fingerprint, idempotency_key, revoke_token, created_at";

export async function getReceipt(
  tx: SqlSession,
  fingerprint: string,
): Promise<ManagedShareReceipt | null> {
  const row = await tx.get<ReceiptRow>(
    `select ${RECEIPT_COLUMNS} from managed_share_receipt where fingerprint = ?`,
    [fingerprint],
  );
  return row ? toReceipt(row) : null;
}

export async function getSecret(
  tx: SqlSession,
  fingerprint: string,
): Promise<ManagedShareSecret | null> {
  const row = await tx.get<SecretRow>(
    `select ${SECRET_COLUMNS} from managed_share_secret where fingerprint = ?`,
    [fingerprint],
  );
  return row ? toSecret(row) : null;
}

/** 최신순 `created_at desc, fingerprint`(인덱스 managed_share_by_recency). Dexie 와 정확히 일치(실측). */
export async function listReceipts(tx: SqlSession): Promise<ManagedShareReceipt[]> {
  const rows = await tx.all<ReceiptRow>(
    `select ${RECEIPT_COLUMNS} from managed_share_receipt order by created_at desc, fingerprint`,
  );
  return rows.map(toReceipt);
}

export async function listSecrets(tx: SqlSession): Promise<ManagedShareSecret[]> {
  const rows = await tx.all<SecretRow>(`select ${SECRET_COLUMNS} from managed_share_secret`);
  return rows.map(toSecret);
}

export async function insertReceipt(tx: SqlSession, receipt: ManagedShareReceipt): Promise<void> {
  await tx.run(`insert into managed_share_receipt (${RECEIPT_COLUMNS}) values (?, ?, ?, ?)`, [
    receipt.fingerprint,
    receipt.slug,
    receipt.expiresAt,
    receipt.createdAt,
  ]);
}

export async function insertSecret(tx: SqlSession, secret: ManagedShareSecret): Promise<void> {
  await tx.run(`insert into managed_share_secret (${SECRET_COLUMNS}) values (?, ?, ?, ?)`, [
    secret.fingerprint,
    secret.idempotencyKey,
    secret.revokeToken,
    secret.createdAt,
  ]);
}

/** 완성(slug·expiresAt 채움) 시 영수증을 전체 치환한다. */
export async function putReceipt(tx: SqlSession, receipt: ManagedShareReceipt): Promise<void> {
  await tx.run(
    `insert into managed_share_receipt (${RECEIPT_COLUMNS}) values (?, ?, ?, ?)
     on conflict(fingerprint) do update set
       slug = excluded.slug,
       expires_at = excluded.expires_at,
       created_at = excluded.created_at`,
    [receipt.fingerprint, receipt.slug, receipt.expiresAt, receipt.createdAt],
  );
}

/** 한 fingerprint 의 영수증+secret 을 지운다(Dexie deleteManagedShareInTransaction 등가). */
export async function deleteShare(tx: SqlSession, fingerprint: string): Promise<void> {
  await tx.run("delete from managed_share_receipt where fingerprint = ?", [fingerprint]);
  await tx.run("delete from managed_share_secret where fingerprint = ?", [fingerprint]);
}

/** secret 만 지운다 — 고아 secret 정리(getManagedShare 경로). */
export async function deleteSecret(tx: SqlSession, fingerprint: string): Promise<void> {
  await tx.run("delete from managed_share_secret where fingerprint = ?", [fingerprint]);
}

export async function deleteReceipts(
  tx: SqlSession,
  fingerprints: readonly string[],
): Promise<void> {
  for (const fingerprint of fingerprints) {
    await tx.run("delete from managed_share_receipt where fingerprint = ?", [fingerprint]);
  }
}

export async function deleteSecrets(
  tx: SqlSession,
  fingerprints: readonly string[],
): Promise<void> {
  for (const fingerprint of fingerprints) {
    await tx.run("delete from managed_share_secret where fingerprint = ?", [fingerprint]);
  }
}
