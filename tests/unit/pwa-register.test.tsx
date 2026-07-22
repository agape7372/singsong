// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  getActivePlan: vi.fn(async () => ({ revision: 7 })),
}));

vi.mock("@/data/plan-database", () => database);

import { PwaRegister } from "@/components/pwa-register";

function serviceWorkerHarness() {
  const postMessage = vi.fn();
  const waiting = { postMessage, scriptURL: "https://example.test/sw.js", state: "installed" };
  const registration = Object.assign(new EventTarget(), {
    active: null,
    installing: null,
    waiting,
    scope: "https://example.test/",
    unregister: vi.fn(async () => true),
    update: vi.fn(async () => undefined),
    navigationPreload: {},
    pushManager: {},
    sync: {},
    periodicSync: {},
    backgroundFetch: {},
    cookies: {},
  });
  const serviceWorkers = Object.assign(new EventTarget(), {
    controller: { scriptURL: "https://example.test/sw.js" },
    ready: Promise.resolve(registration),
    register: vi.fn(async () => registration),
    getRegistration: vi.fn(async () => registration),
    getRegistrations: vi.fn(async () => [registration]),
    startMessages: vi.fn(),
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorkers,
  });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0),
  );

  return { postMessage, serviceWorkers };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_PWA_ENABLED", "true");
  database.getActivePlan.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("PWA waiting-worker consent", () => {
  it("dismisses an update without activating the waiting worker", async () => {
    const { postMessage } = serviceWorkerHarness();
    render(<PwaRegister />);

    fireEvent.click(await screen.findByRole("button", { name: "나중에" }));

    expect(screen.queryByText(/새 버전이 준비됐습니다/)).not.toBeInTheDocument();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("checks a stable persisted revision before explicit activation", async () => {
    const { postMessage } = serviceWorkerHarness();
    render(<PwaRegister />);

    fireEvent.click(await screen.findByRole("button", { name: "업데이트" }));

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" }));
    expect(database.getActivePlan).toHaveBeenCalledTimes(2);
  });
});
