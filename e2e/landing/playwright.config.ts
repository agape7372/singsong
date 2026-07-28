import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const port = 4_317;
const origin = `http://127.0.0.1:${port}`;
const repositoryRoot = path.resolve(__dirname, "../..");
const artifactRoot =
  process.env.PLAYWRIGHT_ARTIFACT_ROOT ??
  path.join(os.tmpdir(), "singsong-playwright", "share-landing");

export default defineConfig({
  testDir: ".",
  testMatch: "landing.spec.ts",
  outputDir: path.join(artifactRoot, "results"),
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(artifactRoot, "report"), open: "never" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: origin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run share-api:build && cross-env APP_PROFILE=fixture SITE_ORIGIN=${origin} PORT=${port} node e2e/landing/fixture-server.mjs`,
    cwd: repositoryRoot,
    url: `${origin}/.well-known/assetlinks.json`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium-share-landing", use: { ...devices["Desktop Chrome"] } }],
});
