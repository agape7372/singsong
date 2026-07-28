import { describe, expect, it } from "vitest";

import { createMutex } from "../src/mutex";

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("createMutex", () => {
  it("직렬화한다 — 늦게 넣은 빠른 작업이 먼저 넣은 느린 작업을 앞지르지 못한다", async () => {
    const withLock = createMutex();
    const order: string[] = [];

    // a 는 느리지만 먼저 큐에 들어갔다. b 는 즉시 끝나지만 a 뒤다.
    const a = withLock(async () => {
      await tick(20);
      order.push("a");
      return "A";
    });
    const b = withLock(async () => {
      order.push("b");
      return "B";
    });

    expect(await a).toBe("A");
    expect(await b).toBe("B");
    expect(order).toEqual(["a", "b"]);
  });

  it("앞 작업이 던져도 큐가 계속 돈다", async () => {
    const withLock = createMutex();
    const log: string[] = [];

    const first = withLock(async () => {
      log.push("a");
      throw new Error("boom");
    }).catch(() => log.push("a-caught"));
    const second = withLock(async () => {
      log.push("b");
    });

    await Promise.all([first, second]);
    // 실측 순서(crit-C-store §4): rejection 이 큐를 끊지 않는다.
    expect(log).toEqual(["a", "a-caught", "b"]);
  });

  it("작업의 반환값을 그대로 돌려준다", async () => {
    const withLock = createMutex();
    await expect(withLock(async () => 42)).resolves.toBe(42);
  });
});
