export type SearchableCatalogItem = {
  id: string;
  title: string;
  artist: string;
  codes: readonly string[];
};

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
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
    .sort((left, right) => left.score - right.score || left.item.id.localeCompare(right.item.id))
    .slice(0, Math.min(20, Math.max(1, limit)))
    .map(({ item }) => item);
}
