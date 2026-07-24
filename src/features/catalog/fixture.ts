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
  {
    id: "fx-013",
    title: "코인 두 개",
    artist: "동전탑",
    karaokeCodes: { TJ: "91013", KY: "92013" },
    source: "fixture",
  },
  {
    id: "fx-014",
    title: "가로등 아래에서",
    artist: "밤산책",
    karaokeCodes: { KY: "92014" },
    source: "fixture",
  },
  {
    id: "fx-015",
    title: "너의 애창곡",
    artist: "하이톤",
    karaokeCodes: { TJ: "91015" },
    source: "fixture",
  },
  {
    id: "fx-016",
    title: "떼창 준비",
    artist: "합창단칸",
    karaokeCodes: { TJ: "91016", KY: "92016" },
    source: "fixture",
  },
  {
    id: "fx-017",
    title: "고음의 계단",
    artist: "삼단고음",
    karaokeCodes: { KY: "92017" },
    source: "fixture",
  },
  {
    id: "fx-018",
    title: "회식의 끝",
    artist: "부장님18번",
    karaokeCodes: { TJ: "91018" },
    source: "fixture",
  },
  {
    id: "fx-019",
    title: "느린 왈츠",
    artist: "삼박자",
    karaokeCodes: { TJ: "91019", KY: "92019" },
    source: "fixture",
  },
  {
    id: "fx-020",
    title: "첫차를 기다리며",
    artist: "새벽정류장",
    karaokeCodes: { KY: "92020" },
    source: "fixture",
  },
  {
    id: "fx-021",
    title: "듀엣의 정석",
    artist: "두목소리",
    karaokeCodes: { TJ: "91021", KY: "92021" },
    source: "fixture",
  },
  {
    id: "fx-022",
    title: "탬버린 흔들어",
    artist: "리듬반",
    karaokeCodes: { TJ: "91022" },
    source: "fixture",
  },
  {
    id: "fx-023",
    title: "이천년대 그 노래",
    artist: "추억재생",
    karaokeCodes: { KY: "92023" },
    source: "fixture",
  },
  {
    id: "fx-024",
    title: "분위기 반전",
    artist: "무드체인지",
    karaokeCodes: { TJ: "91024", KY: "92024" },
    source: "fixture",
  },
  {
    id: "fx-025",
    title: "발라드 한 스푼",
    artist: "저녁노을",
    karaokeCodes: { TJ: "91025" },
    source: "fixture",
  },
  {
    id: "fx-026",
    title: "댄스 타임",
    artist: "스텝밟기",
    karaokeCodes: { KY: "92026" },
    source: "fixture",
  },
  {
    id: "fx-027",
    title: "마지막 하이라이트",
    artist: "엔딩크레딧",
    karaokeCodes: { TJ: "91027", KY: "92027" },
    source: "fixture",
  },
  {
    id: "fx-028",
    title: "조용한 앵콜",
    artist: "속삭임",
    karaokeCodes: { TJ: "91028" },
    source: "fixture",
  },
  {
    id: "fx-029",
    title: "우리 동네 챔피언",
    artist: "노래방지기",
    karaokeCodes: { KY: "92029" },
    source: "fixture",
  },
  {
    id: "fx-030",
    title: "박수 세 번",
    artist: "환호성",
    karaokeCodes: { TJ: "91030", KY: "92030" },
    source: "fixture",
  },
  {
    id: "fx-031",
    title: "감성 충전",
    artist: "촉촉모드",
    karaokeCodes: { TJ: "91031" },
    source: "fixture",
  },
  {
    id: "fx-032",
    title: "쩌렁쩌렁",
    artist: "성량왕",
    karaokeCodes: { KY: "92032" },
    source: "fixture",
  },
  {
    id: "fx-033",
    title: "손잡고 떼창",
    artist: "우정출연",
    karaokeCodes: { TJ: "91033", KY: "92033" },
    source: "fixture",
  },
  {
    id: "fx-034",
    title: "야식 콜",
    artist: "치킨각",
    karaokeCodes: { TJ: "91034" },
    source: "fixture",
  },
  {
    id: "fx-035",
    title: "다시 부르는 첫 곡",
    artist: "무한반복",
    karaokeCodes: { KY: "92035" },
    source: "fixture",
  },
  {
    id: "fx-036",
    title: "우리의 마무리",
    artist: "굿나잇",
    karaokeCodes: { TJ: "91036", KY: "92036" },
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
