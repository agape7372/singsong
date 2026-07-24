import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const finalDir = path.join(root, "final");
const referenceDir = path.join(root, "html");
const finalIds = [39, 33, 17, 13, 10, 8, 4, 1];
const finalIdSet = new Set(finalIds);
const isNumberedPng = (file) => /^\d{2}-[a-z0-9-]+\.png$/.test(file);

const rootNumbered = (await readdir(root)).filter(isNumberedPng);
if (rootNumbered.length) {
  throw new Error(`Numbered PNGs must live in final/ or html/: ${rootNumbered.join(", ")}`);
}

const finalFiles = (await readdir(finalDir)).filter(isNumberedPng).sort();
const referenceFiles = (await readdir(referenceDir)).filter(isNumberedPng).sort();

if (finalFiles.length !== 8) {
  throw new Error(`Expected 8 final PNGs, found ${finalFiles.length}`);
}
if (referenceFiles.length !== 42) {
  throw new Error(`Expected 42 reference PNGs, found ${referenceFiles.length}`);
}

const serialOf = (file) => Number(file.slice(0, 2));
const actualFinalIds = finalFiles.map(serialOf).sort((a, b) => a - b);
const expectedFinalIds = [...finalIds].sort((a, b) => a - b);
if (expectedFinalIds.some((serial, index) => serial !== actualFinalIds[index])) {
  throw new Error(`Final selection mismatch: ${actualFinalIds.join(", ")}`);
}

const expectedReferenceIds = Array.from({ length: 50 }, (_, index) => index + 1).filter(
  (serial) => !finalIdSet.has(serial),
);
const actualReferenceIds = referenceFiles.map(serialOf).sort((a, b) => a - b);
if (expectedReferenceIds.some((serial, index) => serial !== actualReferenceIds[index])) {
  throw new Error(`Reference selection mismatch: ${actualReferenceIds.join(", ")}`);
}

const assets = [
  ...finalFiles.map((file) => ({ group: "final", file, absolute: path.join(finalDir, file) })),
  ...referenceFiles.map((file) => ({ group: "reference", file, absolute: path.join(referenceDir, file) })),
];
const dimensions = new Map();
const hashes = new Set();

for (const asset of assets) {
  const data = await readFile(asset.absolute);
  if (data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${asset.group}/${asset.file} is not a PNG`);
  }

  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width !== height || width < 1024) {
    throw new Error(`${asset.group}/${asset.file} has invalid dimensions: ${width}x${height}`);
  }

  const key = `${width}x${height}`;
  dimensions.set(key, (dimensions.get(key) ?? 0) + 1);
  hashes.add(createHash("sha256").update(data).digest("hex"));
}

if (hashes.size !== 50) {
  throw new Error(`Expected 50 unique image hashes, found ${hashes.size}`);
}

console.log(`Validated ${finalFiles.length} final + ${referenceFiles.length} reference PNGs.`);
console.log(`Dimensions: ${[...dimensions].map(([size, count]) => `${size} × ${count}`).join(", ")}`);
console.log(`Unique SHA-256 hashes: ${hashes.size}`);
