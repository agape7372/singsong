import { rm } from "node:fs/promises";
import path from "node:path";

for (const target of [".next", "coverage", "playwright-report"]) {
  await rm(path.join(process.cwd(), target), { recursive: true, force: true });
}
