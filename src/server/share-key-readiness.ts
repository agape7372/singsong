import "server-only";

type RequiredKeyRow = { slug_key_version?: unknown };

function decodedSecretBytes(value: string) {
  if (!/^[A-Za-z0-9_-]{43,}$/u.test(value)) return 0;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    return atob(padded).length;
  } catch {
    return 0;
  }
}

export function assertConfiguredShareKeyVersions(
  rows: readonly RequiredKeyRow[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const activeVersion = Number(environment.SHARE_SLUG_ACTIVE_KEY_VERSION);
  if (!Number.isSafeInteger(activeVersion) || activeVersion < 1 || activeVersion > 32_767) {
    throw new Error("Active share slug key version is invalid");
  }

  const requiredVersions = new Set([activeVersion]);
  for (const row of rows) {
    const version = Number(row.slug_key_version);
    if (!Number.isSafeInteger(version) || version < 1 || version > 32_767) {
      throw new Error("Database returned an invalid share slug key version");
    }
    requiredVersions.add(version);
  }

  for (const version of requiredVersions) {
    const value = environment[`SHARE_SLUG_HMAC_KEY_V${version}`];
    if (!value || decodedSecretBytes(value) < 32) {
      throw new Error(`Required share slug key version ${version} is unavailable`);
    }
  }
}

export async function assertRequiredShareKeyVersions() {
  const baseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  let endpoint: URL;
  try {
    const parsed = new URL(baseUrl ?? "");
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
    endpoint = new URL("/rest/v1/rpc/required_share_slug_key_versions_v1", parsed);
  } catch {
    throw new Error("Production share-key readiness URL is invalid");
  }
  if (!secretKey?.startsWith("sb_secret_")) {
    throw new Error("A current server-only Supabase secret key is required for readiness");
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        "Accept-Profile": "app_api",
        "Content-Profile": "app_api",
        "X-Client-Info": "singsong-readiness/1",
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error("Unable to inspect required share key versions");
  }
  if (!response.ok) throw new Error("Unable to inspect required share key versions");

  try {
    const body = await response.text();
    if (body.length > 64 * 1024) throw new Error();
    const rows = JSON.parse(body) as unknown;
    if (!Array.isArray(rows)) throw new Error();
    assertConfiguredShareKeyVersions(rows as RequiredKeyRow[]);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Required share slug key version")) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("share slug key version")) throw error;
    throw new Error("Required share key version response is invalid");
  }
}
