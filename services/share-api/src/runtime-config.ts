import type { CatalogProvider } from "./catalog.js";
import {
  FixtureCatalogProvider,
  LicensedCatalogProvider,
  UnavailableCatalogProvider,
} from "./catalog.js";
import { AllowAllRateLimiter, ServerlessRateLimiter, type RateLimiter } from "./rate-limit.js";
import { LocalShareRepository } from "./share/local-repository.js";
import { SupabaseShareRepository, type SupabaseShareConfig } from "./share/supabase-repository.js";
import type { ShareRepository } from "./share/types.js";

export type RuntimeProfile = "fixture" | "production";

export type AssociationConfig = {
  assetLinksJson: string;
  appleAppSiteAssociationJson: string;
};

export type AppRuntime = {
  profile: RuntimeProfile;
  siteOrigin: URL;
  repository: ShareRepository;
  catalog: CatalogProvider;
  rateLimiter: RateLimiter;
  rateBucketSecret?: Uint8Array;
  associations: AssociationConfig;
};

type Environment = Readonly<Record<string, string | undefined>>;

function decodeBase64UrlSecret(value: string | undefined, label: string) {
  if (!value || !/^[A-Za-z0-9_-]{43,}$/u.test(value)) {
    throw new Error(`${label} is unavailable`);
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.byteLength < 32) throw new Error(`${label} is unavailable`);
  return Uint8Array.from(bytes);
}

function httpsUrl(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} is unavailable`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is unavailable`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname.includes(".") ||
    url.hostname === "localhost"
  ) {
    throw new Error(`${label} is unavailable`);
  }
  return url;
}

function siteOrigin(environment: Environment, production: boolean) {
  const raw =
    environment.SITE_ORIGIN ??
    environment.NEXT_PUBLIC_SITE_URL ??
    (production ? undefined : "http://127.0.0.1:8787");
  if (!raw) throw new Error("SITE_ORIGIN is unavailable");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("SITE_ORIGIN is unavailable");
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (production && url.protocol !== "https:") ||
    (!production && url.protocol !== "http:" && url.protocol !== "https:")
  ) {
    throw new Error("SITE_ORIGIN is unavailable");
  }
  return url;
}

function associationConfig(environment: Environment, production: boolean): AssociationConfig {
  const rawFingerprints = environment.ANDROID_APP_SHA256_CERT_FINGERPRINTS ?? "";
  const fingerprints = rawFingerprints
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const fingerprintPattern = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/u;
  if (
    production &&
    (fingerprints.length === 0 || fingerprints.some((v) => !fingerprintPattern.test(v)))
  ) {
    throw new Error("Android app association is unavailable");
  }
  const iosAppId = environment.IOS_APP_ID?.trim() ?? "";
  if (production && !/^[A-Z0-9]{10}\.com\.singsong\.app$/u.test(iosAppId)) {
    throw new Error("Apple app association is unavailable");
  }
  return {
    assetLinksJson: JSON.stringify(
      fingerprints.length === 0
        ? []
        : [
            {
              relation: ["delegate_permission/common.handle_all_urls"],
              target: {
                namespace: "android_app",
                package_name: "com.singsong.app",
                sha256_cert_fingerprints: fingerprints,
              },
            },
          ],
    ),
    appleAppSiteAssociationJson: JSON.stringify({
      applinks: {
        apps: [],
        details: iosAppId
          ? [
              {
                appID: iosAppId,
                components: [{ "/": "/s/*", comment: "SingSong shared tickets" }],
              },
            ]
          : [],
      },
    }),
  };
}

function supabaseConfig(environment: Environment): SupabaseShareConfig {
  const secretKey = environment.SUPABASE_SECRET_KEY ?? "";
  if (!secretKey.startsWith("sb_secret_")) {
    throw new Error("A current server-only Supabase secret key is required");
  }
  const activeSlugKeyVersion = Number(environment.SHARE_SLUG_ACTIVE_KEY_VERSION);
  if (
    !Number.isSafeInteger(activeSlugKeyVersion) ||
    activeSlugKeyVersion < 1 ||
    activeSlugKeyVersion > 32_767
  ) {
    throw new Error("SHARE_SLUG_ACTIVE_KEY_VERSION is invalid");
  }
  const slugKeys = new Map<number, Uint8Array>();
  for (const [key, value] of Object.entries(environment)) {
    const match = /^SHARE_SLUG_HMAC_KEY_V(\d+)$/u.exec(key);
    if (!match || !value) continue;
    const version = Number(match[1]);
    if (Number.isSafeInteger(version) && version >= 1 && version <= 32_767) {
      slugKeys.set(version, decodeBase64UrlSecret(value, key));
    }
  }
  if (!slugKeys.has(activeSlugKeyVersion)) {
    throw new Error(`SHARE_SLUG_HMAC_KEY_V${activeSlugKeyVersion} is unavailable`);
  }
  return {
    url: httpsUrl(environment.SUPABASE_URL, "SUPABASE_URL"),
    secretKey,
    activeSlugKeyVersion,
    slugKeys,
  };
}

function productionCatalog(environment: Environment): CatalogProvider {
  const apiKey = environment.CATALOG_PROVIDER_API_KEY;
  if (!apiKey || apiKey.length < 16) return new UnavailableCatalogProvider();
  try {
    return new LicensedCatalogProvider({
      url: httpsUrl(environment.CATALOG_PROVIDER_URL, "CATALOG_PROVIDER_URL"),
      apiKey,
    });
  } catch {
    return new UnavailableCatalogProvider();
  }
}

export function runtimeProfile(environment: Environment = process.env): RuntimeProfile {
  const profile = environment.APP_PROFILE;
  if (profile === "release" || profile === "production") return "production";
  if (profile === "fixture") return "fixture";
  throw new Error("APP_PROFILE must be fixture, release, or production");
}

export function createRuntime(environment: Environment = process.env): AppRuntime {
  const profile = runtimeProfile(environment);
  if (profile === "fixture") {
    return {
      profile,
      siteOrigin: siteOrigin(environment, false),
      repository: new LocalShareRepository(),
      catalog: new FixtureCatalogProvider(),
      rateLimiter: new AllowAllRateLimiter(),
      associations: associationConfig(environment, false),
    };
  }
  const ipHmacKey = decodeBase64UrlSecret(
    environment.RATE_LIMIT_IP_HMAC_KEY_V1,
    "RATE_LIMIT_IP_HMAC_KEY_V1",
  );
  const redisToken = environment.RATE_LIMIT_REDIS_TOKEN ?? "";
  if (redisToken.length < 16) throw new Error("RATE_LIMIT_REDIS_TOKEN is unavailable");
  return {
    profile,
    siteOrigin: siteOrigin(environment, true),
    repository: new SupabaseShareRepository(supabaseConfig(environment)),
    catalog: productionCatalog(environment),
    rateLimiter: new ServerlessRateLimiter({
      redisUrl: httpsUrl(environment.RATE_LIMIT_REDIS_URL, "RATE_LIMIT_REDIS_URL"),
      redisToken,
      ipHmacKey,
    }),
    rateBucketSecret: ipHmacKey,
    associations: associationConfig(environment, true),
  };
}
