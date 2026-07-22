import "server-only";
import {
  RELEASE_REQUIRED_ENV,
  assertReleaseEnvironment as assertReleaseGate,
} from "../../scripts/release-gate.mjs";

export type RuntimeProfile = "fixture" | "production";

export function getRuntimeProfile(): RuntimeProfile {
  const profile = process.env.APP_PROFILE;
  if (profile === "release") return "production";
  if (profile !== "fixture" && profile !== "production") {
    throw new Error("APP_PROFILE is not explicit");
  }
  return profile;
}

export function assertProductionEnvironment() {
  if (getRuntimeProfile() !== "production") return;
  const missing = RELEASE_REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  }
  assertReleaseGate(process.env);
}

export const assertReleaseEnvironment = assertProductionEnvironment;
