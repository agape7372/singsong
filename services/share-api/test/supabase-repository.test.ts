import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fingerprintSharedSnapshot,
  fixtureSnapshot,
  serializeSharedSnapshot,
} from "../src/domain.js";
import {
  requiredShareSlugKeyVersions,
  SupabaseShareRepository,
  type SupabaseShareConfig,
} from "../src/share/supabase-repository.js";
import { ShareRepositoryError, type CreateShareInput } from "../src/share/types.js";

const MAX_RPC_RESPONSE_BYTES = 128 * 1024;
const IDEMPOTENCY_KEY = "AAAAAAAAAAAAAAAAAAAAAA";
const REVOKE_TOKEN = "B".repeat(43);
const ACTIVE_KEY = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const HISTORICAL_KEY = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);

function config(overrides: Partial<SupabaseShareConfig> = {}): SupabaseShareConfig {
  return {
    url: new URL("https://project.supabase.co"),
    secretKey: "sb_secret_server-only",
    activeSlugKeyVersion: 2,
    slugKeys: new Map([
      [1, HISTORICAL_KEY],
      [2, ACTIVE_KEY],
    ]),
    ...overrides,
  };
}

function deriveSlug(idempotencyKey: string, key: Uint8Array) {
  const message = Buffer.concat([
    Buffer.from("singsong/share-slug/v1", "utf8"),
    Buffer.from([0]),
    Buffer.from(idempotencyKey, "utf8"),
  ]);
  return createHmac("sha256", key).update(message).digest().subarray(0, 16).toString("base64url");
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function databaseDigest(value: string) {
  return `\\x${digest(value)}`;
}

function jsonResponse(
  value: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

function rpcFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function createInput(): CreateShareInput {
  const payload = fixtureSnapshot();
  return {
    idempotencyKey: IDEMPOTENCY_KEY,
    revokeToken: REVOKE_TOKEN,
    payload,
    canonicalPayload: serializeSharedSnapshot(payload),
    fingerprint: fingerprintSharedSnapshot(payload),
    rateBucketHashes: {
      hour: "\\x" + "1".repeat(64),
      day: "\\x" + "2".repeat(64),
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SupabaseShareRepository", () => {
  it("executes inspect, create, get, and revoke with the hardened RPC contract", async () => {
    const input = createInput();
    const historicalSlug = deriveSlug(IDEMPOTENCY_KEY, HISTORICAL_KEY);
    const fetchMock = rpcFetch(
      jsonResponse([
        {
          outcome: "reusable",
          slug_key_version: 1,
          stored_slug_hash: databaseDigest(historicalSlug),
        },
      ]),
      jsonResponse({
        outcome: "created",
        slug_key_version: 1,
        stored_slug_hash: databaseDigest(historicalSlug),
        expires_at: "2026-08-04T00:00:00.000Z",
      }),
      jsonResponse([
        {
          available: true,
          payload_canonical: input.canonicalPayload,
          snapshot_fingerprint: `\\x${input.fingerprint.toUpperCase()}`,
          expires_at: "2026-08-04T00:00:00.000Z",
        },
      ]),
      jsonResponse({ outcome: "revoked" }),
    );
    const repository = new SupabaseShareRepository(config());

    await expect(
      repository.inspect(IDEMPOTENCY_KEY, input.fingerprint, REVOKE_TOKEN),
    ).resolves.toBe("reusable");
    await expect(repository.create(input)).resolves.toMatchObject({
      slug: historicalSlug,
      revokeToken: REVOKE_TOKEN,
      payload: input.payload,
      fingerprint: input.fingerprint,
      expiresAt: "2026-08-04T00:00:00.000Z",
      isNew: true,
    });
    await expect(repository.get(historicalSlug)).resolves.toEqual({
      slug: historicalSlug,
      payload: input.payload,
      fingerprint: input.fingerprint,
      createdAt: "",
      expiresAt: "2026-08-04T00:00:00.000Z",
    });
    await expect(
      repository.revoke(historicalSlug, REVOKE_TOKEN, input.rateBucketHashes),
    ).resolves.toBe("revoked");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const [inspectUrl, inspectInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(inspectUrl)).toBe(
      "https://project.supabase.co/rest/v1/rpc/inspect_share_snapshot_v1",
    );
    expect(inspectInit).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        apikey: "sb_secret_server-only",
        Authorization: "Bearer sb_secret_server-only",
        "Accept-Profile": "app_api",
        "Content-Profile": "app_api",
      },
    });
    expect(JSON.parse(String(inspectInit?.body))).toEqual({
      p_idempotency_hash: `\\x${digest(IDEMPOTENCY_KEY)}`,
      p_snapshot_fingerprint: `\\x${input.fingerprint}`,
      p_revoke_token_hash: `\\x${digest(REVOKE_TOKEN)}`,
    });

    const createBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(createBody).toMatchObject({
      p_slug_key_version: 2,
      p_slug_hash: `\\x${digest(deriveSlug(IDEMPOTENCY_KEY, ACTIVE_KEY))}`,
      p_payload_canonical: input.canonicalPayload,
      p_create_hour_bucket_hash: input.rateBucketHashes?.hour,
      p_create_day_bucket_hash: input.rateBucketHashes?.day,
    });
  });

  it("returns every supported inspection result and rejects forged stored slugs", async () => {
    const input = createInput();
    const activeSlug = deriveSlug(IDEMPOTENCY_KEY, ACTIVE_KEY);
    rpcFetch(
      jsonResponse({ outcome: "missing" }),
      jsonResponse([{ outcome: "conflict" }]),
      jsonResponse({
        outcome: "reusable",
        slug_key_version: 2,
        stored_slug_hash: "\\x" + "0".repeat(64),
      }),
      jsonResponse({ outcome: "unexpected" }),
      jsonResponse([]),
    );
    const repository = new SupabaseShareRepository(config());

    await expect(
      repository.inspect(IDEMPOTENCY_KEY, input.fingerprint, REVOKE_TOKEN),
    ).resolves.toBe("missing");
    await expect(
      repository.inspect(IDEMPOTENCY_KEY, input.fingerprint, REVOKE_TOKEN),
    ).resolves.toBe("conflict");
    await expect(
      repository.inspect(IDEMPOTENCY_KEY, input.fingerprint, REVOKE_TOKEN),
    ).rejects.toMatchObject({
      name: "ShareRepositoryError",
      code: "KEY_MISMATCH",
    });
    expect(databaseDigest(activeSlug)).not.toBe("\\x" + "0".repeat(64));
    await expect(
      repository.inspect(IDEMPOTENCY_KEY, input.fingerprint, REVOKE_TOKEN),
    ).rejects.toThrow("invalid outcome");
    await expect(
      repository.inspect(IDEMPOTENCY_KEY, input.fingerprint, REVOKE_TOKEN),
    ).rejects.toThrow("inspection failed");
  });

  it("maps create outcomes, preserves idempotent reuse, and requires rate buckets", async () => {
    const input = createInput();
    const activeSlug = deriveSlug(IDEMPOTENCY_KEY, ACTIVE_KEY);
    const repository = new SupabaseShareRepository(config());
    const inputWithoutRateBuckets = { ...input };
    delete inputWithoutRateBuckets.rateBucketHashes;

    await expect(repository.create(inputWithoutRateBuckets)).rejects.toThrow("rate buckets");

    rpcFetch(
      jsonResponse({ outcome: "rate_limited" }),
      jsonResponse({ outcome: "conflict" }),
      jsonResponse({ outcome: "unsupported" }),
      jsonResponse([]),
      jsonResponse({
        outcome: "reused",
        slug_key_version: 2,
        stored_slug_hash: databaseDigest(activeSlug),
        expires_at: "2026-08-05T00:00:00.000Z",
      }),
      jsonResponse({
        outcome: "created",
        slug_key_version: 2,
        stored_slug_hash: "\\x" + "f".repeat(64),
        expires_at: "2026-08-05T00:00:00.000Z",
      }),
    );

    await expect(repository.create(input)).rejects.toEqual(
      expect.objectContaining<Partial<ShareRepositoryError>>({ code: "RATE_LIMITED" }),
    );
    await expect(repository.create(input)).rejects.toEqual(
      expect.objectContaining<Partial<ShareRepositoryError>>({ code: "CONFLICT" }),
    );
    await expect(repository.create(input)).rejects.toThrow("invalid outcome");
    await expect(repository.create(input)).rejects.toThrow("rejected create");
    await expect(repository.create(input)).resolves.toMatchObject({
      slug: activeSlug,
      isNew: false,
    });
    await expect(repository.create(input)).rejects.toMatchObject({
      name: "ShareRepositoryError",
      code: "KEY_MISMATCH",
    });
  });

  it("distinguishes unavailable lookups from malformed database records", async () => {
    const input = createInput();
    const slug = deriveSlug(IDEMPOTENCY_KEY, ACTIVE_KEY);
    rpcFetch(
      jsonResponse({ available: false }),
      jsonResponse({ available: true, payload_canonical: null }),
      jsonResponse([]),
      jsonResponse({
        available: true,
        payload_canonical: "{",
        snapshot_fingerprint: input.fingerprint,
        expires_at: "2026-08-04T00:00:00.000Z",
      }),
      jsonResponse({
        available: true,
        payload_canonical: input.canonicalPayload,
        snapshot_fingerprint: "not-a-digest",
        expires_at: "2026-08-04T00:00:00.000Z",
      }),
      jsonResponse({
        available: true,
        payload_canonical: input.canonicalPayload,
        snapshot_fingerprint: null,
        expires_at: "2026-08-04T00:00:00.000Z",
      }),
    );
    const repository = new SupabaseShareRepository(config());

    await expect(repository.get(slug)).resolves.toBeNull();
    await expect(repository.get(slug)).resolves.toBeNull();
    await expect(repository.get(slug)).rejects.toThrow("lookup failed");
    await expect(repository.get(slug)).rejects.toThrow();
    await expect(repository.get(slug)).rejects.toThrow("Snapshot fingerprint is invalid");
    await expect(repository.get(slug)).rejects.toThrow("Database digest is invalid");
  });

  it("returns all revoke outcomes and rejects incomplete or unknown results", async () => {
    const repository = new SupabaseShareRepository(config());
    const buckets = createInput().rateBucketHashes;
    await expect(repository.revoke("slug", REVOKE_TOKEN)).rejects.toThrow("rate buckets");

    rpcFetch(
      jsonResponse({ outcome: "unavailable" }),
      jsonResponse([{ outcome: "rate_limited" }]),
      jsonResponse({ outcome: "invalid" }),
      jsonResponse([]),
    );
    await expect(repository.revoke("slug", REVOKE_TOKEN, buckets)).resolves.toBe("unavailable");
    await expect(repository.revoke("slug", REVOKE_TOKEN, buckets)).resolves.toBe("rate_limited");
    await expect(repository.revoke("slug", REVOKE_TOKEN, buckets)).rejects.toThrow(
      "invalid outcome",
    );
    await expect(repository.revoke("slug", REVOKE_TOKEN, buckets)).rejects.toThrow("revoke failed");
  });

  it("verifies, sorts, and enforces every database-required slug key version", async () => {
    const configured = config();
    rpcFetch(
      jsonResponse([{ slug_key_version: 2 }, { slug_key_version: 1 }], {
        headers: { "Content-Length": "100" },
      }),
    );
    await expect(requiredShareSlugKeyVersions(configured)).resolves.toEqual([1, 2]);

    rpcFetch(jsonResponse([{ slug_key_version: 3 }]));
    await expect(requiredShareSlugKeyVersions(configured)).rejects.toThrow(
      "Required share slug key version 3 is unavailable",
    );

    rpcFetch(
      jsonResponse({ slug_key_version: 1 }),
      jsonResponse([null]),
      jsonResponse([{ slug_key_version: 0 }]),
      jsonResponse([{ slug_key_version: 32_768 }]),
      jsonResponse([{ slug_key_version: 1.5 }]),
    );
    await expect(requiredShareSlugKeyVersions(configured)).rejects.toThrow("response is invalid");
    await expect(requiredShareSlugKeyVersions(configured)).rejects.toThrow("response is invalid");
    await expect(requiredShareSlugKeyVersions(configured)).rejects.toThrow(
      "invalid share slug key version",
    );
    await expect(requiredShareSlugKeyVersions(configured)).rejects.toThrow(
      "invalid share slug key version",
    );
    await expect(requiredShareSlugKeyVersions(configured)).rejects.toThrow(
      "invalid share slug key version",
    );
  });

  it("fails closed on transport, media type, body, encoding, and size violations", async () => {
    const configured = config();
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockRejectedValueOnce(new Error("network secret"));
    fetchMock.mockResolvedValueOnce(jsonResponse([], { status: 503 }));
    fetchMock.mockResolvedValueOnce(
      new Response("[]", {
        headers: { "Content-Type": "text/plain" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse([], {
        headers: { "Content-Length": String(MAX_RPC_RESPONSE_BYTES + 1) },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse([], {
        headers: { "Content-Length": "not-a-number" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse([], {
        headers: { "Content-Length": "-1" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response("{", {
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(Uint8Array.of(0xff), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array(MAX_RPC_RESPONSE_BYTES + 1), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    for (let index = 0; index < 10; index += 1) {
      await expect(requiredShareSlugKeyVersions(configured)).rejects.toThrow(
        index < 3 ? "Supabase RPC request failed" : "Supabase RPC response is invalid",
      );
    }
  });

  it("rejects malformed caller digests and unusably short configured keys before fetch", async () => {
    const repository = new SupabaseShareRepository(config());
    await expect(
      repository.inspect(IDEMPOTENCY_KEY, "not-a-fingerprint", REVOKE_TOKEN),
    ).rejects.toThrow("Snapshot fingerprint is invalid");

    const shortKeyRepository = new SupabaseShareRepository(
      config({ slugKeys: new Map([[2, new Uint8Array(31)]]) }),
    );
    await expect(shortKeyRepository.create(createInput())).rejects.toThrow(
      "Required share slug key version 2 is unavailable",
    );
  });
});
