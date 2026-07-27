export type SearchableCatalogItem = {
  id: string;
  title: string;
  artist: string;
  codes: readonly string[];
};

export function normalizeSearchText(value: string) {
  return (
    value
      .normalize("NFC")
      // toLocaleLowerCase("ko-KR") 대신 toLowerCase(): 전 코드포인트 1,112,064개 전수 비교에서
      // 차이 0(실측 node v24.11.1). ko 로케일엔 조건부 casing(tr/az/lt 전용)이 없어 스펙상
      // 동일하고, Hermes 의 ASCII 고속경로가 toLowerCase 에만 걸려 플랫폼 ICU 왕복이 사라진다.
      // 소문자화가 normalize("NFC") **뒤**라 İSTANBUL → "i̇stanbul"(U+0069 U+0307 …)처럼 결과가
      // NFC 가 아닐 수 있다 — 재정규화하지 않는 게 의도다(회귀 테스트가 이 코드포인트열을 고정).
      .toLowerCase()
      // /[\p{P}\p{S}]+/gu 는 그대로 둔다. 계획 §3.4 의 "Hermes 모듈 로드 실패 · M1 하드
      // 블로커" 는 반증됐다: 앱이 싣는 hermesc(hermes-v0.17.0)로 컴파일 exit 0 이고,
      // -dump-bytecode 결과 이 문자 클래스는 컴파일 시점에 명시 코드포인트 범위(U16Bracket,
      // 339개 범위)로 전개된다 — 기기 ICU 와 무관하다(hermesc 출력 바이트 수는 입력 소스에
      // 따라 달라 재현 가능한 사실이 아니라 여기 적지 않는다, crit §E-4). 잔여 이슈는
      // Hermes(≈U15.1) ↔ Node(U16.0) 의 752 코드포인트 델타뿐이고 검색 토큰화에만 닿는다
      // (canonical payload·fingerprint 경로엔 도달하지 않음 — serializeSharedSnapshot 계보
      // 전수 확인). 단 isValidSearchQuery 는 클라이언트(search-ledger.tsx:55,85)와
      // 서버(api/search/route.ts:18) 양쪽에서 강제되므로, 델타 문자가 든 질의는
      // "기기 통과 → 서버 400" 이 될 수 있다(데이터 손상 아님, crit §N-5). eslint 에 \p{ 금지
      // 규칙은 넣지 않는다(반증됨) — 근거는 eslint.config.mjs 주석.
      .replace(/[\p{P}\p{S}]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
  );
}

export function tokenizeSearchQuery(value: string) {
  return [...new Set(normalizeSearchText(value).split(" ").filter(Boolean))].sort();
}

const HANGUL_INITIALS = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

export function extractChosung(value: string) {
  return Array.from(normalizeSearchText(value), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0xac00 || codePoint > 0xd7a3) return character;
    return HANGUL_INITIALS[Math.floor((codePoint - 0xac00) / 588)] ?? character;
  }).join("");
}

export function isValidSearchQuery(value: string) {
  const query = normalizeSearchText(value);
  const length = Array.from(query).length;
  if (/^[0-9]+$/u.test(query)) return length <= 6;
  return length >= 2 && length <= 60;
}

function rank(item: SearchableCatalogItem, tokens: readonly string[]) {
  const title = normalizeSearchText(item.title);
  const artist = normalizeSearchText(item.artist);
  const codes = item.codes.join(" ");
  const haystack = `${title} ${artist} ${codes} ${extractChosung(title)} ${extractChosung(artist)}`;
  if (!tokens.every((token) => haystack.includes(token))) return null;
  const query = tokens.join(" ");
  if (title === query || codes === query) return 0;
  if (title.startsWith(query)) return 1;
  if (artist === query) return 2;
  if (artist.startsWith(query)) return 3;
  return 4;
}

/**
 * 코드유닛 사전순. ECMA-262 가 고정한 비교라 ICU·로케일·기기와 무관하다.
 *
 * localeCompare 를 대체한다. 이 타이브레이커는 rankFixtureCatalog 에서만 쓰이고
 * (licensed.ts 는 이걸 부르지 않는다 — crit §E-2), fingerprint·저장 키·canonical
 * payload 어디에도 안 닿는다. 그래서 기기별 정렬 차이가 있어도 증상은 "발견 탭 검색
 * 결과 순서가 다름" 뿐이고 데이터 손상이 아니다. 지금 도달하는 id 집합
 * (fx-001..036 + a,b,c)에서는 localeCompare 와 1,521 순서쌍 전수 일치(실측)라
 * 교체해도 깨지는 테스트가 0 이다.
 */
function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function rankFixtureCatalog<T extends SearchableCatalogItem>(
  items: readonly T[],
  query: string,
  limit = 20,
) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return [];
  return items
    .map((item) => ({ item, score: rank(item, tokens) }))
    .filter((entry): entry is { item: T; score: number } => entry.score !== null)
    .sort(
      (left, right) => left.score - right.score || compareCodeUnits(left.item.id, right.item.id),
    )
    .slice(0, Math.min(20, Math.max(1, limit)))
    .map(({ item }) => item);
}
