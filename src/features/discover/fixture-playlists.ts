import { FIXTURE_CATALOG } from "@/features/catalog/fixture";
import type { CatalogTrack } from "@/features/catalog/types";

export type FixturePlaylist = {
  id: string;
  title: string;
  blurb: string;
  songIds: readonly string[];
};

/**
 * Deliberately fictional, visibly-marked TEST DATA curation. No real catalog,
 * no celebrity likeness — themes reference the local fixture catalog only.
 * Real Discover indexing stays deferred (D-028).
 */
export const FIXTURE_PLAYLISTS: readonly FixturePlaylist[] = [
  {
    id: "pl-회식마무리",
    title: "회식 마무리 떼창",
    blurb: "다 같이 소리 지르며 끝내는 한 판",
    songIds: ["fx-016", "fx-030", "fx-033", "fx-018", "fx-036"],
  },
  {
    id: "pl-새벽감성",
    title: "새벽 감성 발라드",
    blurb: "조명 낮추고 촉촉하게",
    songIds: ["fx-004", "fx-025", "fx-031", "fx-014", "fx-020"],
  },
  {
    id: "pl-이천년대",
    title: "이천년대 명곡 모음",
    blurb: "그때 그 감성 다시 재생",
    songIds: ["fx-023", "fx-002", "fx-009", "fx-035", "fx-003"],
  },
  {
    id: "pl-듀엣",
    title: "둘이 부르는 듀엣 곡",
    blurb: "마이크 나눠 잡고",
    songIds: ["fx-021", "fx-019", "fx-007", "fx-012"],
  },
  {
    id: "pl-고음도전",
    title: "고음 도전 셋리스트",
    blurb: "성량 자랑 타임",
    songIds: ["fx-017", "fx-032", "fx-015", "fx-027"],
  },
  {
    id: "pl-분위기업",
    title: "분위기 UP 댄스",
    blurb: "탬버린 챙기고 일어서",
    songIds: ["fx-026", "fx-022", "fx-024", "fx-013", "fx-029"],
  },
] as const;

const CATALOG_BY_ID = new Map(FIXTURE_CATALOG.map((track) => [track.id, track]));

export function playlistTracks(playlist: FixturePlaylist): CatalogTrack[] {
  return playlist.songIds
    .map((id) => CATALOG_BY_ID.get(id))
    .filter((track): track is CatalogTrack => Boolean(track));
}
