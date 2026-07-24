import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public", "icons", "icon.svg");
const outputDirectory = path.join(root, "public", "icons");

await mkdir(outputDirectory, { recursive: true });
for (const [filename, size] of [
  ["folded-session-s-192.png", 192],
  ["folded-session-s-512.png", 512],
  ["folded-session-s-180.png", 180],
  // Keep the legacy aliases for already-installed clients while new manifests
  // use the branded filenames above to bypass stale browser icon caches.
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await sharp(source)
    .resize(size, size)
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(outputDirectory, filename));
}
