import { z } from "zod";

export type CatalogTrack = {
  id: string;
  title: string;
  artist: string;
  karaokeCodes: Partial<Record<"TJ" | "KY", string>>;
  source: "fixture" | "licensed";
};

export interface CatalogProvider {
  readonly kind: "fixture" | "licensed";
  search(query: string, limit?: number): Promise<CatalogTrack[]>;
}

type LicensedCatalogConfig = {
  url: URL;
  apiKey: string;
};

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const forbiddenText = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ud800-\udfff]/u;

const displayTextSchema = z
  .string()
  .transform((value) => value.normalize("NFC").trim())
  .refine(
    (value) => value.length > 0 && Array.from(value).length <= 80 && !forbiddenText.test(value),
  );
const codeSchema = z.string().regex(/^\d{1,6}$/u);
const providerTrackSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/u),
    title: displayTextSchema,
    artist: displayTextSchema,
    karaokeCodes: z
      .object({
        TJ: codeSchema.optional(),
        KY: codeSchema.optional(),
      })
      .strict(),
  })
  .strict();
const providerResponseSchema = z.object({ results: z.array(providerTrackSchema).max(20) }).strict();

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
    id: "fx-014",
    title: "가로등 아래에서",
    artist: "밤산책",
    karaokeCodes: { KY: "92014" },
    source: "fixture",
  },
  {
    id: "fx-020",
    title: "첫차를 기다리며",
    artist: "새벽정류장",
    karaokeCodes: { KY: "92020" },
    source: "fixture",
  },
] as const;

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function isValidSearchQuery(value: string) {
  const query = normalizeSearchText(value);
  const length = Array.from(query).length;
  if (/^[0-9]+$/u.test(query)) return length >= 1 && length <= 6;
  return length >= 2 && length <= 60;
}

function compareCodeUnits(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fixtureRank(track: CatalogTrack, tokens: readonly string[]) {
  const title = normalizeSearchText(track.title);
  const artist = normalizeSearchText(track.artist);
  const codes = Object.values(track.karaokeCodes).join(" ");
  const haystack = `${title} ${artist} ${codes}`;
  if (!tokens.every((token) => haystack.includes(token))) return null;
  const query = tokens.join(" ");
  if (title === query || codes === query) return 0;
  if (title.startsWith(query)) return 1;
  if (artist === query) return 2;
  if (artist.startsWith(query)) return 3;
  return 4;
}

export class FixtureCatalogProvider implements CatalogProvider {
  readonly kind = "fixture" as const;

  async search(query: string, limit = 20) {
    const tokens = [...new Set(normalizeSearchText(query).split(" ").filter(Boolean))].sort();
    return FIXTURE_CATALOG.map((track) => ({ track, score: fixtureRank(track, tokens) }))
      .filter((entry): entry is { track: CatalogTrack; score: number } => entry.score !== null)
      .sort(
        (left, right) =>
          left.score - right.score || compareCodeUnits(left.track.id, right.track.id),
      )
      .slice(0, Math.min(20, Math.max(1, limit)))
      .map(({ track }) => ({
        ...track,
        karaokeCodes: { ...track.karaokeCodes },
      }));
  }
}

async function readBoundedJson(response: Response) {
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_RESPONSE_BYTES) {
      throw new Error("Licensed catalog response is invalid");
    }
  }
  if (!response.body) throw new Error("Licensed catalog response is invalid");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Licensed catalog response is invalid");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error("Licensed catalog response is invalid");
  }
}

export class LicensedCatalogProvider implements CatalogProvider {
  readonly kind = "licensed" as const;

  constructor(readonly config: LicensedCatalogConfig) {}

  async search(query: string, limit = 20): Promise<CatalogTrack[]> {
    const normalizedQuery = query.normalize("NFC").trim();
    if (
      !isValidSearchQuery(normalizedQuery) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 20
    ) {
      throw new Error("Licensed catalog request is invalid");
    }
    let response: Response;
    try {
      response = await fetch(this.config.url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ query: normalizedQuery, limit }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new Error("Licensed catalog request failed");
    }
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Licensed catalog request failed");
    }
    const parsed = providerResponseSchema.safeParse(await readBoundedJson(response));
    if (
      !parsed.success ||
      parsed.data.results.length > limit ||
      new Set(parsed.data.results.map((track) => track.id)).size !== parsed.data.results.length
    ) {
      throw new Error("Licensed catalog response is invalid");
    }
    return parsed.data.results.map((track) => {
      const karaokeCodes: CatalogTrack["karaokeCodes"] = {};
      if (track.karaokeCodes.TJ) karaokeCodes.TJ = track.karaokeCodes.TJ;
      if (track.karaokeCodes.KY) karaokeCodes.KY = track.karaokeCodes.KY;
      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        karaokeCodes,
        source: "licensed",
      };
    });
  }
}

export class UnavailableCatalogProvider implements CatalogProvider {
  readonly kind = "licensed" as const;

  async search(): Promise<CatalogTrack[]> {
    throw new Error("Licensed catalog configuration is unavailable");
  }
}
