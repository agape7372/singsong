import { readFile } from "node:fs/promises";
import path from "node:path";

const workerPath = path.join(process.cwd(), "public", "sw.js");
const worker = await readFile(workerPath, "utf8");
const manifestStart = worker.indexOf("precacheEntries:[");
const manifestEnd = worker.indexOf("]??[]", manifestStart);

if (manifestStart < 0 || manifestEnd < 0) {
  throw new Error("Could not locate the Serwist precache manifest in public/sw.js");
}

const manifestSource = worker.slice(manifestStart, manifestEnd + 1);
const entries = [...manifestSource.matchAll(/[,{]["']url["']:["']([^"']+)["']/gu)].map((match) =>
  match[1].replaceAll("\\", "/"),
);
const forbidden = entries.filter(
  (url) =>
    /^\/(?:api|s)(?:\/|$)/u.test(url) ||
    /^\/search(?:\/|$)/u.test(url) ||
    /\/_next\/static\/chunks\/app\/(?:api|s|search)\//u.test(url),
);

if (entries.length === 0) throw new Error("The generated precache manifest is empty");
if (forbidden.length > 0) {
  throw new Error(`Sensitive or network-only routes entered precache: ${forbidden.join(", ")}`);
}
if (!entries.includes("/offline.html")) {
  throw new Error("The standalone offline fallback is missing from precache");
}

console.log(
  JSON.stringify(
    {
      worker: path.relative(process.cwd(), workerPath).replaceAll("\\", "/"),
      precacheEntries: entries.length,
      forbiddenEntries: forbidden,
    },
    null,
    2,
  ),
);
