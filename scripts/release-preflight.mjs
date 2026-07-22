import { assertReleaseEnvironment } from "./release-gate.mjs";

try {
  assertReleaseEnvironment();
  process.stdout.write("release preflight: PASS\n");
} catch (error) {
  const message =
    error && typeof error === "object" && "code" in error && error.code === "BLOCK_EXTERNAL"
      ? error.message
      : "BLOCK_EXTERNAL: release preflight failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
