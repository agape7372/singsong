/**
 * profile 테이블 접근자. 기기 로컬 정체성 — 공유 스냅샷·티켓·OG 에 절대 안 들어간다.
 *
 * ★ photo 표현: 스키마는 `photo_uri text`(0001_initial.ts:72-74, 열린 결정 M5). BLOB 왕복은
 *    node:sqlite 에서 무손실이지만(M10) RN 에 URL.createObjectURL 이 없어 URI 로 뒀다.
 *    src/(웹)는 `photo?: Blob`(ProfileRecord)로 남고, store 는 `photoUri: string | null`.
 *    억지로 통합하지 않는다 — 공유(BaseProfile)는 photo 축을 아예 모른다(§2.4).
 */

import type { BaseProfile } from "../policy";
import type { SqlSession } from "../sql-executor";

export type StoredProfile = BaseProfile & { photoUri: string | null };

type ProfileRow = {
  id: string;
  nickname: string;
  color_id: string;
  photo_uri: string | null;
  updated_at: string;
};

const COLUMNS = "id, nickname, color_id, photo_uri, updated_at";

function toProfile(row: ProfileRow): StoredProfile {
  return {
    id: row.id,
    nickname: row.nickname,
    colorId: row.color_id,
    photoUri: row.photo_uri,
    updatedAt: row.updated_at,
  };
}

export async function getProfileRow(tx: SqlSession, id: string): Promise<StoredProfile | null> {
  const row = await tx.get<ProfileRow>(`select ${COLUMNS} from profile where id = ?`, [id]);
  return row ? toProfile(row) : null;
}

export async function upsertProfile(tx: SqlSession, profile: StoredProfile): Promise<void> {
  await tx.run(
    `insert into profile (${COLUMNS}) values (?, ?, ?, ?, ?)
     on conflict(id) do update set
       nickname = excluded.nickname,
       color_id = excluded.color_id,
       photo_uri = excluded.photo_uri,
       updated_at = excluded.updated_at`,
    [profile.id, profile.nickname, profile.colorId, profile.photoUri, profile.updatedAt],
  );
}
