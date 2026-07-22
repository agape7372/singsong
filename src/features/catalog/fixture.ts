import type { CatalogProvider, CatalogTrack } from "./types";
import { normalizeSearchText, rankFixtureCatalog } from "@/domain/catalog";

// Deliberately fictional, deterministic and visibly marked fixture catalog.
export const FIXTURE_CATALOG: readonly CatalogTrack[] = [
  {
    id: "fx-001",
    title: "밤의 체크인",
    artist: "유리별",
    karaokeCodes: { TJ: "91001" },
    source: "fixture",
  },
  {
    id: "fx-002",
    title: "분홍 영수증",
    artist: "모서리",
    karaokeCodes: { KY: "92002" },
    source: "fixture",
  },
  {
    id: "fx-003",
    title: "마지막 환승",
    artist: "여름선",
    karaokeCodes: { TJ: "91003", KY: "92003" },
    source: "fixture",
  },
  {
    id: "fx-004",
    title: "새벽 두 칸",
    artist: "오후반",
    karaokeCodes: { TJ: "91004" },
    source: "fixture",
  },
  {
    id: "fx-005",
    title: "우리의 대기번호",
    artist: "종이달",
    karaokeCodes: { KY: "92005" },
    source: "fixture",
  },
  {
    id: "fx-006",
    title: "한 곡 더",
    artist: "느린불빛",
    karaokeCodes: { TJ: "91006", KY: "92006" },
    source: "fixture",
  },
  {
    id: "fx-007",
    title: "서툰 합창",
    artist: "초록의자",
    karaokeCodes: { TJ: "91007" },
    source: "fixture",
  },
  {
    id: "fx-008",
    title: "토요일의 잔액",
    artist: "레코드룸",
    karaokeCodes: { KY: "92008" },
    source: "fixture",
  },
  {
    id: "fx-009",
    title: "다음 페이지",
    artist: "연필심",
    karaokeCodes: { TJ: "91009" },
    source: "fixture",
  },
  {
    id: "fx-010",
    title: "돌아오는 골목",
    artist: "비상구",
    karaokeCodes: { TJ: "91010", KY: "92010" },
    source: "fixture",
  },
  {
    id: "fx-011",
    title: "작은 앙코르",
    artist: "열한시",
    karaokeCodes: { KY: "92011" },
    source: "fixture",
  },
  {
    id: "fx-012",
    title: "마이크를 넘겨",
    artist: "옆자리",
    karaokeCodes: { TJ: "91012" },
    source: "fixture",
  },
] as const;

export function normalizeCatalogText(value: string) {
  return normalizeSearchText(value);
}

export class FixtureCatalogProvider implements CatalogProvider {
  readonly kind = "fixture" as const;

  async search(query: string, limit = 20) {
    const searchable = FIXTURE_CATALOG.map((track) => ({
      ...track,
      codes: Object.values(track.karaokeCodes),
    }));
    return rankFixtureCatalog(searchable, query, limit).map((entry) => ({
      id: entry.id,
      title: entry.title,
      artist: entry.artist,
      karaokeCodes: { ...entry.karaokeCodes },
      source: entry.source,
    }));
  }
}
