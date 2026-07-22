import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

const profile = process.env.APP_PROFILE;
if (profile !== "fixture" && profile !== "production") {
  throw new Error("APP_PROFILE must be fixture or production");
}

const port = Number(process.env.SMOKE_PORT ?? "3300");
if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) {
  throw new Error("SMOKE_PORT must be an unprivileged TCP port");
}

const origin = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

let output = "";
const remember = (chunk) => {
  output = `${output}${chunk.toString("utf8")}`.slice(-20_000);
};
child.stdout.on("data", remember);
child.stderr.on("data", remember);

async function waitUntilReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited early\n${output}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The server is still binding or compiling its first request.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`next start did not become ready\n${output}`);
}

function requireHeader(response, name) {
  const value = response.headers.get(name);
  if (!value) throw new Error(`${response.url} did not send ${name}`);
  return value;
}

async function smoke() {
  await waitUntilReady();
  const [home, ticket, og] = await Promise.all([
    fetch(origin),
    fetch(`${origin}/ticket`),
    fetch(`${origin}/api/og/AAAAAAAAAAAAAAAAAAAAAA`),
  ]);
  if (!home.ok || !ticket.ok || !og.ok) {
    throw new Error(
      `HTTP smoke failed: home=${home.status} ticket=${ticket.status} og=${og.status}`,
    );
  }

  const homeCsp = requireHeader(home, "content-security-policy");
  const ticketCsp = requireHeader(ticket, "content-security-policy");
  if (homeCsp.includes("challenges.cloudflare.com")) {
    throw new Error("Home CSP unnecessarily allows the Turnstile origin");
  }
  if (profile === "production" && !ticketCsp.includes("challenges.cloudflare.com")) {
    throw new Error("Production ticket CSP does not allow the Turnstile origin");
  }
  if (profile === "fixture" && ticketCsp.includes("challenges.cloudflare.com")) {
    throw new Error("Fixture ticket CSP unexpectedly allows the Turnstile origin");
  }
  if (requireHeader(home, "x-frame-options") !== "DENY") {
    throw new Error("Frame denial header is missing");
  }
  const homeHtml = await home.text();
  const initialScripts = new Set(
    Array.from(
      homeHtml.matchAll(/<script(?![^>]*\bnomodule\b)[^>]+src="(\/_next\/static\/[^"]+\.js)"/giu),
      (match) => match[1].replace("/_next/", ""),
    ),
  );
  if (initialScripts.size === 0)
    throw new Error("Home did not reference initial JavaScript chunks");
  let homeInitialJsGzipBytes = 0;
  const initialScriptSizes = [];
  for (const script of initialScripts) {
    const bytes = await readFile(path.join(process.cwd(), ".next", script));
    const gzipBytes = gzipSync(bytes, { level: 9 }).byteLength;
    homeInitialJsGzipBytes += gzipBytes;
    initialScriptSizes.push({ script, gzipBytes });
  }
  if (homeInitialJsGzipBytes > 170 * 1024) {
    initialScriptSizes.sort((left, right) => right.gzipBytes - left.gzipBytes);
    throw new Error(
      `Home modern initial JavaScript exceeds 170 KiB gzip: ${homeInitialJsGzipBytes}\n${JSON.stringify(initialScriptSizes)}`,
    );
  }
  if (!requireHeader(og, "content-type").includes("image/png")) {
    throw new Error("OG endpoint did not return PNG");
  }
  if (!requireHeader(og, "cache-control").includes("no-store")) {
    throw new Error("OG endpoint is cacheable");
  }
  const png = new Uint8Array(await og.arrayBuffer());
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((byte, index) => png[index] === byte)) {
    throw new Error("OG response does not have a PNG signature");
  }

  process.stdout.write(
    `${JSON.stringify({ profile, home: home.status, ticket: ticket.status, og: og.status, ogBytes: png.byteLength, homeInitialJsGzipBytes })}\n`,
  );
}

try {
  await smoke();
} finally {
  if (child.exitCode === null) child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}
