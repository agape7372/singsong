import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const script = resolve(process.cwd(), "scripts/verify-release-artifact.mjs");
const temporaryDirectories: string[] = [];
const secret = `sb_secret_${"s".repeat(40)}`;

function artifact(clientContent: string) {
  const directory = mkdtempSync(join(tmpdir(), "singsong-release-artifact-"));
  temporaryDirectories.push(directory);
  const build = join(directory, ".next");
  const chunks = join(build, "static", "chunks");
  const rendered = join(build, "server", "app");
  const publicDirectory = join(directory, "public");
  mkdirSync(chunks, { recursive: true });
  mkdirSync(rendered, { recursive: true });
  mkdirSync(publicDirectory, { recursive: true });
  writeFileSync(
    join(build, "required-server-files.json"),
    JSON.stringify({
      config: { env: { APP_PROFILE: "production", NEXT_PUBLIC_APP_PROFILE: "production" } },
    }),
  );
  writeFileSync(join(chunks, "app.js"), clientContent);
  writeFileSync(join(rendered, "page.rsc"), "safe rendered payload");
  writeFileSync(join(publicDirectory, "sw.js"), "safe service worker");
  return directory;
}

function verify(directory: string) {
  return spawnSync(process.execPath, [script], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, SUPABASE_SECRET_KEY: secret },
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("release client artifact boundary", () => {
  it("accepts a production artifact without fixture or server-only material", () => {
    const result = verify(artifact('console.log("public client")'));

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("profile/fixture/secret/client-boundary scan: PASS");
  });

  it("blocks an exact configured secret without printing its value", () => {
    const result = verify(artifact(`const leaked = ${JSON.stringify(secret)}`));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("configured server secret SUPABASE_SECRET_KEY");
    expect(result.stderr).not.toContain(secret);
  });

  it.each([
    [".next/server/app/page.rsc", "rendered RSC"],
    ["public/sw.js", "service worker"],
  ])("blocks an exact configured secret in a browser-delivered %s artifact", (path) => {
    const directory = artifact('console.log("safe")');
    writeFileSync(join(directory, path), secret);
    const result = verify(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("configured server secret SUPABASE_SECRET_KEY");
    expect(result.stderr).not.toContain(secret);
  });

  it("blocks fixture markers in a public service worker", () => {
    const directory = artifact('console.log("safe")');
    writeFileSync(join(directory, "public", "sw.js"), 'const notice = "TEST DATA"');
    const result = verify(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fixture marker found in browser-visible artifact");
  });

  it("blocks server-only import and environment markers even without a configured value", () => {
    const result = verify(artifact('const key = process.env["TURNSTILE_SECRET_KEY"]'));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("server-only boundary marker");
    expect(result.stderr).not.toContain(secret);
  });

  it.each(["RATE_LIMIT_REDIS_URL", "RATE_LIMIT_REDIS_TOKEN", "OBSERVABILITY_DSN"])(
    "blocks the optional server-only %s value",
    (key) => {
      const value = `${key.toLowerCase()}-${"q".repeat(40)}`;
      const directory = artifact(`const leaked = ${JSON.stringify(value)}`);
      const result = spawnSync(process.execPath, [script], {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, [key]: value },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`configured server secret ${key}`);
      expect(result.stderr).not.toContain(value);
    },
  );
});
