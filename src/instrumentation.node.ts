import { assertRuntimeReleaseEnvironment } from "@/server/runtime-release-environment";
import { assertRequiredShareKeyVersions } from "@/server/share-key-readiness";

export async function registerNodeRuntime() {
  if (process.env.APP_PROFILE === "fixture") return;
  assertRuntimeReleaseEnvironment();
  await assertRequiredShareKeyVersions();
}
