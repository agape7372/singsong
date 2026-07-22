import withSerwistInit from "@serwist/next";
import { assertReleaseEnvironment } from "./scripts/release-gate.mjs";

const requestedProfile = process.env.APP_PROFILE;
if (!["fixture", "release", "production"].includes(requestedProfile)) {
  throw new Error(
    "APP_PROFILE must be explicitly set to fixture or release. Use pnpm dev/build for the fixture profile.",
  );
}

const releaseProfile = requestedProfile === "release" || requestedProfile === "production";
if (releaseProfile) assertReleaseEnvironment(process.env);

// The codebase historically names the trusted server behavior "production".
// The public build contract is now fixture|release; this compatibility value
// keeps every existing security boundary fail-closed during the migration.
const runtimeProfile = releaseProfile ? "production" : "fixture";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  reloadOnOnline: false,
  cacheOnNavigation: false,
  disable: process.env.NODE_ENV === "development",
  exclude: [
    /app-build-manifest\.json$/,
    /middleware-manifest\.json$/,
    /react-loadable-manifest\.json$/,
    /server\//,
    /static\/chunks\/app\/api\//,
    /static\/chunks\/app\/s\//,
    /static\/chunks\/app\/search\//,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    APP_PROFILE: runtimeProfile,
    NEXT_PUBLIC_APP_PROFILE: runtimeProfile,
  },
  experimental: {
    typedEnv: true,
  },
  webpack(config, { webpack }) {
    if (releaseProfile) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^\.\/fixture$/u, (resource) => {
          if (resource.context?.replaceAll("\\", "/").endsWith("/src/features/catalog")) {
            resource.request = "./licensed";
          }
        }),
      );
    }
    return config;
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), web-share=(self)",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/s/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/import",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default withSerwist(nextConfig);
