/**
 * imported_share 테이블 접근자. slug 중복 방지 + 최신순 목록.
 */

import type { ImportedShare } from "../policy";
import type { SqlSession } from "../sql-executor";

type ImportRow = { slug: string; imported_at: string; plan_revision: number };

function toImport(row: ImportRow): ImportedShare {
  return { slug: row.slug, importedAt: row.imported_at, planRevision: row.plan_revision };
}

export async function getImportBySlug(tx: SqlSession, slug: string): Promise<ImportedShare | null> {
  const row = await tx.get<ImportRow>(
    "select slug, imported_at, plan_revision from imported_share where slug = ?",
    [slug],
  );
  return row ? toImport(row) : null;
}

export async function insertImport(tx: SqlSession, share: ImportedShare): Promise<void> {
  await tx.run("insert into imported_share (slug, imported_at, plan_revision) values (?, ?, ?)", [
    share.slug,
    share.importedAt,
    share.planRevision,
  ]);
}

/** 최신순 `imported_at desc, slug`(인덱스 imported_share_by_recency). Dexie 와 동률 순서 다름(M14, §2.5). */
export async function listImportRows(tx: SqlSession): Promise<ImportedShare[]> {
  const rows = await tx.all<ImportRow>(
    "select slug, imported_at, plan_revision from imported_share order by imported_at desc, slug",
  );
  return rows.map(toImport);
}
