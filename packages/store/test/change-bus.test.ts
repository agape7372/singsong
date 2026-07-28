import { describe, expect, it } from "vitest";

import { createChangeBus } from "../src/change-bus";

describe("createChangeBus", () => {
  it("구독자는 같은 topic 의 emit 을 받는다", () => {
    const bus = createChangeBus();
    let count = 0;
    bus.subscribe("plan", () => (count += 1));
    bus.emit("plan");
    bus.emit("plan");
    expect(count).toBe(2);
  });

  it("topic 이 격리된다 — 다른 topic 의 emit 은 받지 않는다", () => {
    const bus = createChangeBus();
    let plan = 0;
    let profile = 0;
    bus.subscribe("plan", () => (plan += 1));
    bus.subscribe("profile", () => (profile += 1));
    bus.emit("plan");
    expect(plan).toBe(1);
    expect(profile).toBe(0);
  });

  it("해지하면 더 받지 않는다", () => {
    const bus = createChangeBus();
    let count = 0;
    const stop = bus.subscribe("ticket", () => (count += 1));
    bus.emit("ticket");
    stop();
    bus.emit("ticket");
    expect(count).toBe(1);
  });

  it("통지 안에서 스스로 해지해도 순회가 깨지지 않는다", () => {
    const bus = createChangeBus();
    const seen: string[] = [];
    const stop = bus.subscribe("managed-share", () => {
      seen.push("self");
      stop(); // 통지 도중 자기 자신 제거
    });
    bus.subscribe("managed-share", () => seen.push("other"));
    expect(() => bus.emit("managed-share")).not.toThrow();
    expect(seen).toEqual(["self", "other"]);
    // 첫 emit 에서 self 가 해지됐으므로 두 번째는 other 만.
    bus.emit("managed-share");
    expect(seen).toEqual(["self", "other", "other"]);
  });

  it("구독자 없는 topic 의 emit 은 무해하다", () => {
    const bus = createChangeBus();
    expect(() => bus.emit("imported-share")).not.toThrow();
  });
});
