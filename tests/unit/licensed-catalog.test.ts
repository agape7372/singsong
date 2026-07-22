import { afterEach, describe, expect, it, vi } from "vitest";
import { LicensedCatalogProvider } from "@/features/catalog/licensed";

const providerUrl = "https://catalog.vendor.example/v1/search";
const providerKey = `catalog_live_${"k".repeat(32)}`;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("licensed catalog adapter", () => {
  it("uses a server-only bounded POST contract and marks validated rows licensed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: "vendor-song-1",
              title: "승인된 제목",
              artist: "승인된 가수",
              karaokeCodes: { TJ: "12345" },
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new LicensedCatalogProvider(providerUrl, providerKey);
    await expect(provider.search("  승인된 검색  ", 3)).resolves.toEqual([
      {
        id: "vendor-song-1",
        title: "승인된 제목",
        artist: "승인된 가수",
        karaokeCodes: { TJ: "12345" },
        source: "licensed",
      },
    ]);

    const [url, request] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(providerUrl);
    expect(request).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
    expect(new Headers(request.headers).get("authorization")).toBe(`Bearer ${providerKey}`);
    expect(JSON.parse(String(request.body))).toEqual({ query: "승인된 검색", limit: 3 });
  });

  it("rejects unknown response fields and oversized responses", async () => {
    const provider = new LicensedCatalogProvider(providerUrl, providerKey);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              results: [
                {
                  id: "vendor-song-1",
                  title: "제목",
                  artist: "가수",
                  karaokeCodes: {},
                  unexpected: true,
                },
              ],
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        )
        .mockResolvedValueOnce(
          new Response("{}", {
            headers: { "Content-Type": "application/json", "Content-Length": "65537" },
          }),
        ),
    );

    await expect(provider.search("검색", 1)).rejects.toThrow(
      "Licensed catalog response is invalid",
    );
    await expect(provider.search("검색", 1)).rejects.toThrow(
      "Licensed catalog response is invalid",
    );
  });

  it.each([
    ["unsupported vendor", { TJ: "123", MANANA: "456" }],
    ["non-numeric code", { TJ: "12A" }],
    ["overlong code", { KY: "1234567" }],
  ])("rejects %s", async (_label, karaokeCodes) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [{ id: "vendor-song-1", title: "제목", artist: "가수", karaokeCodes }],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      new LicensedCatalogProvider(providerUrl, providerKey).search("검색", 1),
    ).rejects.toThrow("Licensed catalog response is invalid");
  });

  it("normalizes safe display text and rejects multiline, bidi, duplicate, or surplus rows", async () => {
    const valid = {
      id: "vendor-song-1",
      title: "  Cafe\u0301  ",
      artist: " 가수 ",
      karaokeCodes: { TJ: "123" },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ results: [valid] }), {
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ results: [{ ...valid, title: "첫 줄\n둘째 줄" }] }), {
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ results: [{ ...valid, artist: "가수\u202e" }] }), {
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ results: [valid, valid] }), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );
    const provider = new LicensedCatalogProvider(providerUrl, providerKey);

    await expect(provider.search("검색", 1)).resolves.toMatchObject([
      { title: "Café", artist: "가수", source: "licensed" },
    ]);
    await expect(provider.search("검색", 1)).rejects.toThrow(
      "Licensed catalog response is invalid",
    );
    await expect(provider.search("검색", 1)).rejects.toThrow(
      "Licensed catalog response is invalid",
    );
    await expect(provider.search("검색", 1)).rejects.toThrow(
      "Licensed catalog response is invalid",
    );
  });

  it("aborts after five seconds and never reflects provider secrets or queries in errors", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: URL, request: RequestInit) => {
        return new Promise((_resolve, reject) => {
          request.signal?.addEventListener("abort", () =>
            reject(new Error(`upstream included ${providerKey} and private query`)),
          );
        });
      }),
    );
    const provider = new LicensedCatalogProvider(providerUrl, providerKey);
    const search = provider.search("private query", 1);
    const captured = search.then(
      () => null,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(5_001);

    const error = await captured;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Licensed catalog request failed");
    expect((error as Error).message).not.toContain(providerKey);
    expect((error as Error).message).not.toContain("private query");
  });
});
