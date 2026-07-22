import { beforeEach, describe, expect, it, vi } from "vitest";

const readiness = vi.hoisted(() => ({
  assertRuntimeReleaseEnvironment: vi.fn(),
  assertRequiredShareKeyVersions: vi.fn(async () => undefined),
}));

vi.mock("@/server/runtime-release-environment", () => ({
  assertRuntimeReleaseEnvironment: readiness.assertRuntimeReleaseEnvironment,
}));
vi.mock("@/server/share-key-readiness", () => ({
  assertRequiredShareKeyVersions: readiness.assertRequiredShareKeyVersions,
}));

import { registerNodeRuntime } from "@/instrumentation.node";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("APP_PROFILE", "fixture");
  readiness.assertRuntimeReleaseEnvironment.mockReset();
  readiness.assertRequiredShareKeyVersions.mockReset();
  readiness.assertRequiredShareKeyVersions.mockResolvedValue(undefined);
});

describe("Node production startup readiness", () => {
  it("keeps the fixture runtime external-service free", async () => {
    await registerNodeRuntime();

    expect(readiness.assertRuntimeReleaseEnvironment).not.toHaveBeenCalled();
    expect(readiness.assertRequiredShareKeyVersions).not.toHaveBeenCalled();
  });

  it("maps the release profile to production and checks env before database keys", async () => {
    vi.stubEnv("APP_PROFILE", "release");

    await registerNodeRuntime();

    expect(readiness.assertRuntimeReleaseEnvironment).toHaveBeenCalledOnce();
    expect(readiness.assertRequiredShareKeyVersions).toHaveBeenCalledOnce();
    const environmentOrder = readiness.assertRuntimeReleaseEnvironment.mock.invocationCallOrder[0];
    const databaseOrder = readiness.assertRequiredShareKeyVersions.mock.invocationCallOrder[0];
    expect(environmentOrder).toBeDefined();
    expect(databaseOrder).toBeDefined();
    expect(environmentOrder!).toBeLessThan(databaseOrder!);
  });

  it("fails before the RPC when runtime environment validation fails", async () => {
    vi.stubEnv("APP_PROFILE", "production");
    readiness.assertRuntimeReleaseEnvironment.mockImplementationOnce(() => {
      throw new Error("BLOCK_EXTERNAL: runtime configuration invalid");
    });

    await expect(registerNodeRuntime()).rejects.toThrow("BLOCK_EXTERNAL");
    expect(readiness.assertRequiredShareKeyVersions).not.toHaveBeenCalled();
  });

  it("propagates a missing historical key failure", async () => {
    vi.stubEnv("APP_PROFILE", "production");
    readiness.assertRequiredShareKeyVersions.mockRejectedValueOnce(
      new Error("Required share slug key version is unavailable"),
    );

    await expect(registerNodeRuntime()).rejects.toThrow(
      "Required share slug key version is unavailable",
    );
  });
});
