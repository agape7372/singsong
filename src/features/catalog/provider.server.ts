import "server-only";
import { FixtureCatalogProvider } from "./fixture";
import { LicensedCatalogProvider } from "./licensed";
import type { CatalogProvider } from "./types";
import { assertProductionEnvironment, getRuntimeProfile } from "@/server/runtime-profile";

export function getCatalogProvider(): CatalogProvider {
  if (getRuntimeProfile() === "fixture") return new FixtureCatalogProvider();
  assertProductionEnvironment();
  return new LicensedCatalogProvider();
}
