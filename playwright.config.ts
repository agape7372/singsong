import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const port = 3100;
const artifactRoot =
  process.env.PLAYWRIGHT_ARTIFACT_ROOT ?? path.join(os.tmpdir(), "singsong-playwright", "e2e");

export default defineConfig({
  testDir: "./tests/e2e",
  // Keep reports outside the source/build tree and serialize tests that share
  // the fixture server's in-memory rate-limit/share repository.
  outputDir: `${artifactRoot}/playwright`,
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 1,
  expect: { timeout: 20_000 },
  timeout: 90_000,
  reporter: [["list"], ["html", { outputFolder: `${artifactRoot}/report`, open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`,
    env: {
      APP_PROFILE: "fixture",
      NEXT_PUBLIC_APP_PROFILE: "fixture",
      NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
    },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
