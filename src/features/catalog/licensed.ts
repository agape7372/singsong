import "server-only";
import { z } from "zod";
import type { CatalogProvider, CatalogTrack } from "./types";
import { isValidSearchQuery } from "@/domain/catalog";

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;

class CatalogAdapterError extends Error {}

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

function publicProviderUrl(raw: string | undefined) {
  if (!raw) throw new Error("Licensed catalog configuration is unavailable");
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return url;
  } catch {
    throw new Error("Licensed catalog configuration is unavailable");
  }
}

async function readBoundedJson(response: Response) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_RESPONSE_BYTES) {
      throw new CatalogAdapterError("Licensed catalog response is invalid");
    }
  }
  if (!response.body) throw new CatalogAdapterError("Licensed catalog response is invalid");

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
        throw new CatalogAdapterError("Licensed catalog response is invalid");
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
    throw new CatalogAdapterError("Licensed catalog response is invalid");
  }
}

export class LicensedCatalogProvider implements CatalogProvider {
  readonly kind = "licensed" as const;
  readonly #url: URL;
  readonly #apiKey: string;

  constructor(
    url = process.env.CATALOG_PROVIDER_URL,
    apiKey = process.env.CATALOG_PROVIDER_API_KEY,
  ) {
    this.#url = publicProviderUrl(url);
    if (!apiKey || apiKey.length < 16) {
      throw new Error("Licensed catalog configuration is unavailable");
    }
    this.#apiKey = apiKey;
  }

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.#url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ query: normalizedQuery, limit }),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new CatalogAdapterError("Licensed catalog request failed");
      }
      const parsed = providerResponseSchema.safeParse(await readBoundedJson(response));
      if (!parsed.success) throw new CatalogAdapterError("Licensed catalog response is invalid");
      if (
        parsed.data.results.length > limit ||
        new Set(parsed.data.results.map((track) => track.id)).size !== parsed.data.results.length
      ) {
        throw new CatalogAdapterError("Licensed catalog response is invalid");
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
    } catch (error) {
      if (error instanceof CatalogAdapterError) throw error;
      throw new Error("Licensed catalog request failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Release webpack replaces the fixture module with this module, so synthetic
// rows and their watermark cannot enter a release artifact. This alias is only
// the compile-time replacement target; release runtime always selects licensed.
export { LicensedCatalogProvider as FixtureCatalogProvider };
