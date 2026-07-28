import process from "node:process";

if (process.env.EAS_BUILD_PROFILE === "production") {
  await import("./release-preflight.mjs");
} else {
  console.log(
    `Native release preflight: SKIP (${process.env.EAS_BUILD_PROFILE ?? "local"} profile)`,
  );
}
