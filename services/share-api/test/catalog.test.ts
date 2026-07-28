import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FIXTURE_CATALOG,
  FixtureCatalogProvider,
  isValidSearchQuery,
  LicensedCatalogProvider,
  normalizeSearchText,
  UnavailableCatalogProvider,
} from "../src/catalog.js";

const PROVIDER_URL = new URL("https://catalog.example.test/v1/search");
const API_KEY = "catalog-test-key";

type ProviderResult = {
  id: string;
  title: string;
  artist: string;
  karaokeCodes: {
    TJ?: string;
    KY?: string;
  };
};

function providerResult(overrides: Partial<ProviderResult> = {}): ProviderResult {
  return {
    id: "licensed-001",
    title: "밤의 체크인",
    artist: "유리별",
    karaokeCodes: { TJ: "91001", KY: "92001" },
    ...overrides,
  };
}

function jsonResponse(
  body: unknown,
  init: {
    status?: number;
    headers?: HeadersInit;
  } = {},
) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(body), {
    ...(init.status === undefined ? {} : { status: init.status }),
    headers,
  });
}

function licensedProvider() {
  return new LicensedCatalogProvider({
    url: PROVIDER_URL,
    apiKey: API_KEY,
  });
}

function mockFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("catalog query normalization and fixture ranking", () => {
  it("normalizes Unicode, case, punctuation, symbols, and whitespace", () => {
    expect(normalizeSearchText("  CAFE\u0301—Night!!\t\t$ Live  ")).toBe("café night live");
    expect(normalizeSearchText("ＦＯＯ...Bar")).toBe("ｆｏｏ bar");
  });

  it("accepts only the documented numeric and text query lengths", () => {
    expect(isValidSearchQuery("0")).toBe(true);
    expect(isValidSearchQuery("123456")).toBe(true);
    expect(isValidSearchQuery("1234567")).toBe(false);
    expect(isValidSearchQuery("가")).toBe(false);
    expect(isValidSearchQuery("가나")).toBe(true);
    expect(isValidSearchQuery("가".repeat(60))).toBe(true);
    expect(isValidSearchQuery("가".repeat(61))).toBe(false);
    expect(isValidSearchQuery("!!!")).toBe(false);
  });

  it("ranks title matches ahead of artist matches and filters missing tokens", async () => {
    const provider = new FixtureCatalogProvider();

    await expect(provider.search("밤")).resolves.toMatchObject([
      { id: "fx-001", title: "밤의 체크인" },
      { id: "fx-014", artist: "밤산책" },
    ]);
    await expect(provider.search("새벽")).resolves.toMatchObject([
      { id: "fx-004", title: "새벽 두 칸" },
      { id: "fx-020", artist: "새벽정류장" },
    ]);
    await expect(provider.search("없는 곡")).resolves.toEqual([]);
  });

  it("covers exact code, exact artist, prefix, substring, and canonical token ranking", async () => {
    const provider = new FixtureCatalogProvider();

    await expect(provider.search("92003")).resolves.toMatchObject([{ id: "fx-003" }]);
    await expect(provider.search("새벽정류장")).resolves.toMatchObject([{ id: "fx-020" }]);
    await expect(provider.search("밤의")).resolves.toMatchObject([{ id: "fx-001" }]);
    await expect(provider.search("체크")).resolves.toMatchObject([{ id: "fx-001" }]);
    await expect(provider.search("체크인 체크인 밤의")).resolves.toMatchObject([{ id: "fx-001" }]);
  });

  it("clamps limits, applies deterministic id ordering, and returns defensive code copies", async () => {
    const provider = new FixtureCatalogProvider();
    const minimum = await provider.search("", 0);
    const maximum = await provider.search("", 100);

    expect(minimum.map(({ id }) => id)).toEqual(["fx-001"]);
    expect(maximum.map(({ id }) => id)).toEqual([
      "fx-001",
      "fx-002",
      "fx-003",
      "fx-004",
      "fx-005",
      "fx-006",
      "fx-014",
      "fx-020",
    ]);

    minimum[0]!.karaokeCodes.TJ = "1";
    expect(FIXTURE_CATALOG[0]!.karaokeCodes.TJ).toBe("91001");
    await expect(provider.search("91001")).resolves.toMatchObject([
      { karaokeCodes: { TJ: "91001" } },
    ]);
  });
});

describe("licensed catalog provider", () => {
  it("sends the licensed request contract and maps a valid strict response", async () => {
    const signal = new AbortController().signal;
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const fetchMock = mockFetch(
      jsonResponse({
        results: [
          providerResult({
            title: "  Cafe\u0301 Night  ",
            artist: "  Glass Star  ",
          }),
          providerResult({
            id: "licensed-002",
            title: "Second Song",
            artist: "Second Artist",
            karaokeCodes: {},
          }),
        ],
      }),
    );

    await expect(licensedProvider().search("  Cafe\u0301  ", 2)).resolves.toEqual([
      {
        id: "licensed-001",
        title: "Café Night",
        artist: "Glass Star",
        karaokeCodes: { TJ: "91001", KY: "92001" },
        source: "licensed",
      },
      {
        id: "licensed-002",
        title: "Second Song",
        artist: "Second Artist",
        karaokeCodes: {},
        source: "licensed",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(String(input)).toBe(PROVIDER_URL.toString());
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ query: "Café", limit: 2 }),
      cache: "no-store",
      redirect: "error",
      signal,
    });
    const headers = new Headers(init?.headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(timeoutSpy).toHaveBeenCalledWith(5_000);
  });

  it("uses the default limit when one is not supplied", async () => {
    const fetchMock = mockFetch(jsonResponse({ results: [] }));

    await expect(licensedProvider().search("밤의 체크인")).resolves.toEqual([]);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      query: "밤의 체크인",
      limit: 20,
    });
  });

  it("rejects invalid queries and limits before making a network request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const provider = licensedProvider();
    const invalidRequests: Array<[query: string, limit: number]> = [
      ["가", 1],
      ["1234567", 1],
      ["!".repeat(3), 1],
      ["가".repeat(61), 1],
      ["valid query", 0],
      ["valid query", 21],
      ["valid query", 1.5],
      ["valid query", Number.NaN],
      ["valid query", Number.POSITIVE_INFINITY],
    ];

    for (const [query, limit] of invalidRequests) {
      await expect(provider.search(query, limit)).rejects.toThrow(
        "Licensed catalog request is invalid",
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps network and timeout failures to the stable request error", async () => {
    const provider = licensedProvider();
    for (const failure of [
      new TypeError("socket contains private detail"),
      new DOMException("request timed out", "TimeoutError"),
    ]) {
      const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(failure);
      vi.stubGlobal("fetch", fetchMock);
      await expect(provider.search("valid query")).rejects.toThrow(
        "Licensed catalog request failed",
      );
    }
  });

  it("rejects non-success statuses and non-JSON media types", async () => {
    const provider = licensedProvider();

    mockFetch(jsonResponse({ results: [] }, { status: 503 }));
    await expect(provider.search("valid query")).rejects.toThrow("Licensed catalog request failed");

    mockFetch(
      new Response('{"results":[]}', {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    );
    await expect(provider.search("valid query")).rejects.toThrow("Licensed catalog request failed");

    mockFetch(new Response('{"results":[]}'));
    await expect(provider.search("valid query")).rejects.toThrow("Licensed catalog request failed");
  });

  it("rejects duplicate IDs, more results than requested, and invalid strict schemas", async () => {
    const provider = licensedProvider();
    const invalidPayloads: unknown[] = [
      {
        results: [providerResult(), providerResult()],
      },
      {
        results: [providerResult(), providerResult({ id: "licensed-002" })],
      },
      {
        results: [providerResult()],
        unexpected: true,
      },
      {
        results: [providerResult({ id: "contains spaces" })],
      },
      {
        results: [providerResult({ title: `unsafe\u202etitle` })],
      },
      {
        results: [providerResult({ artist: "x".repeat(81) })],
      },
      {
        results: [providerResult({ karaokeCodes: { TJ: "not-a-code" } })],
      },
      {
        results: Array.from({ length: 21 }, (_, index) =>
          providerResult({ id: `licensed-${index}` }),
        ),
      },
    ];
    const limits = [20, 1, 20, 20, 20, 20, 20, 20];

    for (const [index, payload] of invalidPayloads.entries()) {
      mockFetch(jsonResponse(payload));
      await expect(provider.search("valid query", limits[index])).rejects.toThrow(
        "Licensed catalog response is invalid",
      );
    }
  });

  it("rejects invalid and oversized declared content lengths", async () => {
    const provider = licensedProvider();
    for (const contentLength of ["65537", "-1", "1.5", "not-a-number"]) {
      mockFetch(
        jsonResponse(
          { results: [] },
          {
            headers: { "Content-Length": contentLength },
          },
        ),
      );
      await expect(provider.search("valid query")).rejects.toThrow(
        "Licensed catalog response is invalid",
      );
    }
  });

  it("cancels a response stream as soon as its actual body exceeds the byte bound", async () => {
    let cancelled = false;
    const oversizedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(64 * 1024 + 1));
      },
      cancel() {
        cancelled = true;
      },
    });
    mockFetch(
      new Response(oversizedStream, {
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(licensedProvider().search("valid query")).rejects.toThrow(
      "Licensed catalog response is invalid",
    );
    expect(cancelled).toBe(true);
  });

  it("handles split streams and rejects absent, malformed, and invalid UTF-8 bodies", async () => {
    const encoder = new TextEncoder();
    const validBytes = encoder.encode(JSON.stringify({ results: [] }));
    const splitStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(validBytes.slice(0, 5));
        controller.enqueue(validBytes.slice(5));
        controller.close();
      },
    });
    mockFetch(
      new Response(splitStream, {
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(licensedProvider().search("valid query")).resolves.toEqual([]);

    mockFetch(
      new Response(null, {
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(licensedProvider().search("valid query")).rejects.toThrow(
      "Licensed catalog response is invalid",
    );

    mockFetch(
      new Response("{", {
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(licensedProvider().search("valid query")).rejects.toThrow(
      "Licensed catalog response is invalid",
    );

    mockFetch(
      new Response(new Uint8Array([0xc3, 0x28]), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(licensedProvider().search("valid query")).rejects.toThrow(
      "Licensed catalog response is invalid",
    );
  });
});

describe("unavailable catalog provider", () => {
  it("fails closed without licensed catalog configuration", async () => {
    const provider = new UnavailableCatalogProvider();

    expect(provider.kind).toBe("licensed");
    await expect(provider.search()).rejects.toThrow(
      "Licensed catalog configuration is unavailable",
    );
  });
});
