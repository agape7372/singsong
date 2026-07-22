import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const port = 3_200;
const runtimeProfile = process.env.APP_PROFILE === "production" ? "production" : "fixture";
const releaseBaseUrl = process.env.RELEASE_BASE_URL;
if (runtimeProfile === "production" && !releaseBaseUrl) {
  throw new Error("RELEASE_BASE_URL is required for release browser verification");
}
const baseURL = releaseBaseUrl ?? `http://127.0.0.1:${port}`;
const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
const artifactRoot =
  process.env.PLAYWRIGHT_ARTIFACT_ROOT ??
  path.join(os.tmpdir(), "singsong-playwright", "production-pwa");

export default defineConfig({
  testDir: "./tests/pwa",
  outputDir: `${artifactRoot}/results`,
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  expect: { timeout: 20_000 },
  timeout: 90_000,
  reporter: [["list"], ["html", { outputFolder: `${artifactRoot}/report`, open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer:
    runtimeProfile === "fixture"
      ? {
          command: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`,
          env: {
            ...inheritedEnvironment,
            APP_PROFILE: runtimeProfile,
            NEXT_PUBLIC_APP_PROFILE: runtimeProfile,
            NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
          },
          url: `http://127.0.0.1:${port}`,
          reuseExistingServer: false,
          timeout: 120_000,
        }
      : undefined,
  projects: [{ name: "chromium-production-pwa", use: { ...devices["Desktop Chrome"] } }],
});
