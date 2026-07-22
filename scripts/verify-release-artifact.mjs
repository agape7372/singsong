import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const buildDirectory = resolve(process.cwd(), ".next");
const clientDirectory = join(buildDirectory, "static");
const publicDirectory = resolve(process.cwd(), "public");
const textExtensions = new Set([".html", ".js", ".json", ".rsc", ".txt"]);
const forbiddenMarkers = ["TEST DATA", '"id":"fx-001"', 'id:"fx-001"'];
const forbiddenClientMarkers = [
  "SUPABASE_SECRET_KEY",
  "SHARE_SLUG_HMAC_KEY_",
  "RATE_LIMIT_IP_HMAC_KEY",
  "TURNSTILE_SECRET_KEY",
  "CATALOG_PROVIDER_API_KEY",
  "RATE_LIMIT_REDIS_URL",
  "RATE_LIMIT_REDIS_TOKEN",
  "OBSERVABILITY_DSN",
  "supabase-repository.server",
];
const serverSecretKeys = [
  "SUPABASE_SECRET_KEY",
  "RATE_LIMIT_IP_HMAC_KEY_V1",
  "TURNSTILE_SECRET_KEY",
  "CATALOG_PROVIDER_API_KEY",
  "RATE_LIMIT_REDIS_URL",
  "RATE_LIMIT_REDIS_TOKEN",
  "OBSERVABILITY_DSN",
  ...Object.keys(process.env).filter((key) => /^SHARE_SLUG_HMAC_KEY_V\d+$/u.test(key)),
];

function fail(reason) {
  throw new Error(`RELEASE_ARTIFACT_BLOCKED: ${reason}`);
}

function filesBelow(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesBelow(path));
    else if (entry.isFile() && textExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function allFilesBelow(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...allFilesBelow(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

try {
  if (!statSync(buildDirectory).isDirectory()) fail(".next build directory is unavailable");
} catch {
  fail(".next build directory is unavailable");
}

let requiredServerFiles;
try {
  requiredServerFiles = JSON.parse(
    readFileSync(join(buildDirectory, "required-server-files.json"), "utf8"),
  );
} catch {
  fail("required-server-files.json is unavailable or invalid");
}

if (
  requiredServerFiles?.config?.env?.APP_PROFILE !== "production" ||
  requiredServerFiles?.config?.env?.NEXT_PUBLIC_APP_PROFILE !== "production"
) {
  fail("compiled runtime profile is not production");
}

for (const file of filesBelow(buildDirectory)) {
  const stats = statSync(file);
  if (stats.size > 16 * 1024 * 1024) fail("unexpectedly large text artifact");
  const content = readFileSync(file, "utf8");
  const marker = forbiddenMarkers.find((candidate) => content.includes(candidate));
  if (marker) fail(`fixture marker found in ${file.slice(buildDirectory.length + 1)}`);
}

let staticClientFiles;
try {
  staticClientFiles = allFilesBelow(clientDirectory);
} catch {
  fail(".next/static client artifact directory is unavailable");
}

function existingFilesBelow(directory, extensions) {
  try {
    return allFilesBelow(directory).filter((file) => extensions.has(extname(file)));
  } catch {
    return [];
  }
}

const renderedExtensions = new Set([".html", ".rsc", ".body"]);
const browserVisibleFiles = [
  ...staticClientFiles,
  ...existingFilesBelow(join(buildDirectory, "server", "app"), renderedExtensions),
  ...existingFilesBelow(join(buildDirectory, "server", "pages"), new Set([".html"])),
  ...allFilesBelow(publicDirectory),
];

const configuredSecrets = [...new Set(serverSecretKeys)]
  .map((key) => [key, process.env[key]])
  .filter((entry) => typeof entry[1] === "string" && entry[1].length > 0);

for (const file of [...new Set(browserVisibleFiles)]) {
  const stats = statSync(file);
  if (stats.size > 32 * 1024 * 1024) fail("unexpectedly large client artifact");
  const bytes = readFileSync(file);
  for (const [key, value] of configuredSecrets) {
    if (bytes.includes(Buffer.from(value, "utf8"))) {
      fail(
        `configured server secret ${key} found in browser-visible artifact ${relative(process.cwd(), file)}`,
      );
    }
  }
  const content = bytes.toString("utf8");
  const fixtureMarker = forbiddenMarkers.find((candidate) => content.includes(candidate));
  if (fixtureMarker) {
    fail(`fixture marker found in browser-visible artifact ${relative(process.cwd(), file)}`);
  }
  const boundaryMarker = forbiddenClientMarkers.find((candidate) => content.includes(candidate));
  if (boundaryMarker) {
    fail(
      `server-only boundary marker found in browser-visible artifact ${relative(process.cwd(), file)}`,
    );
  }
}

process.stdout.write("release artifact profile/fixture/secret/client-boundary scan: PASS\n");
