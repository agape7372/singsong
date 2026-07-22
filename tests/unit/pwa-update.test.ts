import { describe, expect, it, vi } from "vitest";
import { unregisterSingSongPwa, waitForStablePlanRevision } from "@/pwa/update-safety";

describe("controlled PWA updates", () => {
  it("waits until two consecutive reads observe the same persisted revision", async () => {
    const revisions = [3, 4, 4];
    const read = vi.fn(async () => ({ revision: revisions.shift() ?? 4 }));
    const yieldTurn = vi.fn(async () => undefined);

    await expect(waitForStablePlanRevision(read, yieldTurn)).resolves.toBe(4);
    expect(read).toHaveBeenCalledTimes(3);
    expect(yieldTurn).toHaveBeenCalledTimes(2);
  });

  it("refuses activation while writes keep changing the revision", async () => {
    let revision = 0;
    await expect(
      waitForStablePlanRevision(
        async () => ({ revision: revision++ }),
        async () => undefined,
        4,
      ),
    ).rejects.toThrow("did not settle");
  });

  it("the kill switch removes only SingSong workers and caches", async () => {
    const unregisterSingSong = vi.fn(async () => true);
    const unregisterOther = vi.fn(async () => true);
    const deleteCache = vi.fn(async () => true);
    const serviceWorkers = {
      getRegistrations: vi.fn(async () => [
        {
          active: { scriptURL: "https://example.test/sw.js" },
          installing: null,
          waiting: null,
          unregister: unregisterSingSong,
        },
        {
          active: { scriptURL: "https://example.test/other.js" },
          installing: null,
          waiting: null,
          unregister: unregisterOther,
        },
      ]),
    };
    const cacheStorage = {
      keys: vi.fn(async () => ["singsong-static-v1", "other-app-v1"]),
      delete: deleteCache,
    };

    await expect(unregisterSingSongPwa(serviceWorkers, cacheStorage)).resolves.toEqual({
      unregistered: 1,
      removedCaches: 1,
    });
    expect(unregisterSingSong).toHaveBeenCalledOnce();
    expect(unregisterOther).not.toHaveBeenCalled();
    expect(deleteCache).toHaveBeenCalledWith("singsong-static-v1");
  });
});
