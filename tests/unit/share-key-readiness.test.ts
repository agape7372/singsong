import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertConfiguredShareKeyVersions,
  assertRequiredShareKeyVersions,
} from "@/server/share-key-readiness";

const key = (byte: number) => Buffer.alloc(32, byte).toString("base64url");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("share slug key startup readiness", () => {
  it("requires both the active key and every historical database version", () => {
    const environment: Record<string, string | undefined> = {
      SHARE_SLUG_ACTIVE_KEY_VERSION: "2",
      SHARE_SLUG_HMAC_KEY_V1: key(1),
      SHARE_SLUG_HMAC_KEY_V2: key(2),
    };

    expect(() =>
      assertConfiguredShareKeyVersions([{ slug_key_version: 1 }], environment),
    ).not.toThrow();
    delete environment.SHARE_SLUG_HMAC_KEY_V1;
    expect(() => assertConfiguredShareKeyVersions([{ slug_key_version: 1 }], environment)).toThrow(
      "Required share slug key version 1 is unavailable",
    );
  });

  it("rejects invalid active, database and short key versions", () => {
    expect(() => assertConfiguredShareKeyVersions([], {})).toThrow(
      "Active share slug key version is invalid",
    );
    expect(() =>
      assertConfiguredShareKeyVersions([{ slug_key_version: 0 }], {
        SHARE_SLUG_ACTIVE_KEY_VERSION: "1",
        SHARE_SLUG_HMAC_KEY_V1: key(1),
      }),
    ).toThrow("Database returned an invalid share slug key version");
    expect(() =>
      assertConfiguredShareKeyVersions([], {
        SHARE_SLUG_ACTIVE_KEY_VERSION: "1",
        SHARE_SLUG_HMAC_KEY_V1: "too-short",
      }),
    ).toThrow("Required share slug key version 1 is unavailable");
  });

  it("calls the private RPC without exposing credentials and validates its rows", async () => {
    vi.stubEnv("SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", `sb_secret_${"s".repeat(32)}`);
    vi.stubEnv("SHARE_SLUG_ACTIVE_KEY_VERSION", "2");
    vi.stubEnv("SHARE_SLUG_HMAC_KEY_V1", key(1));
    vi.stubEnv("SHARE_SLUG_HMAC_KEY_V2", key(2));
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify([{ slug_key_version: 1 }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(assertRequiredShareKeyVersions()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://project-ref.supabase.co/rest/v1/rpc/required_share_slug_key_versions_v1"),
      expect.objectContaining({ method: "POST", cache: "no-store", body: "{}" }),
    );
  });

  it("fails closed on unavailable infrastructure or malformed rows", async () => {
    await expect(assertRequiredShareKeyVersions()).rejects.toThrow(
      "Production share-key readiness URL is invalid",
    );

    vi.stubEnv("SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", `sb_secret_${"s".repeat(32)}`);
    vi.stubEnv("SHARE_SLUG_ACTIVE_KEY_VERSION", "1");
    vi.stubEnv("SHARE_SLUG_HMAC_KEY_V1", key(1));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not-json", { status: 200 })),
    );
    await expect(assertRequiredShareKeyVersions()).rejects.toThrow(
      "Required share key version response is invalid",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { status: 503 })),
    );
    await expect(assertRequiredShareKeyVersions()).rejects.toThrow(
      "Unable to inspect required share key versions",
    );
  });
});
