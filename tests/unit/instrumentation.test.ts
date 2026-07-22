import { beforeEach, describe, expect, it, vi } from "vitest";

const readiness = vi.hoisted(() => ({
  registerNodeRuntime: vi.fn(async () => undefined),
}));

vi.mock("@/instrumentation.node", () => ({
  registerNodeRuntime: readiness.registerNodeRuntime,
}));

import { register } from "@/instrumentation";

beforeEach(() => {
  vi.unstubAllEnvs();
  readiness.registerNodeRuntime.mockReset();
  readiness.registerNodeRuntime.mockResolvedValue(undefined);
});

describe("runtime-specific instrumentation", () => {
  it("does not import Node-only readiness in an edge process", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    await register();

    expect(readiness.registerNodeRuntime).not.toHaveBeenCalled();
  });

  it("delegates Node startup before serving", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    await register();

    expect(readiness.registerNodeRuntime).toHaveBeenCalledOnce();
  });

  it("propagates a Node startup failure", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    readiness.registerNodeRuntime.mockRejectedValueOnce(
      new Error("Required share slug key version is unavailable"),
    );

    await expect(register()).rejects.toThrow("Required share slug key version is unavailable");
  });
});
