// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BottomSlot } from "@/components/bottom-slot";

let slotHeight = 112.4;
let navHeight = 56;

class ResizeObserverHarness {
  static instances: ResizeObserverHarness[] = [];

  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    ResizeObserverHarness.instances.push(this);
  }

  notify() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function renderSlot({
  children = <button type="button">계속</button>,
  navPosition = "fixed",
  withNav = true,
}: {
  children?: React.ReactNode;
  navPosition?: "fixed" | "static";
  withNav?: boolean;
} = {}) {
  return render(
    <main className="task-shell" data-testid="shell">
      {withNav ? <nav className="primary-nav" style={{ position: navPosition }} /> : null}
      <BottomSlot>{children}</BottomSlot>
    </main>,
  );
}

function firstObserver() {
  const observer = ResizeObserverHarness.instances[0];
  if (!observer) throw new Error("BottomSlot did not create a ResizeObserver");
  return observer;
}

beforeEach(() => {
  slotHeight = 112.4;
  navHeight = 56;
  ResizeObserverHarness.instances = [];

  vi.stubGlobal("innerWidth", 412);
  vi.stubGlobal("innerHeight", 800);
  vi.stubGlobal("ResizeObserver", ResizeObserverHarness);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.classList.contains("bottom-slot")) {
      return DOMRect.fromRect({ height: slotHeight });
    }
    if (this.classList.contains("primary-nav")) {
      return DOMRect.fromRect({ height: navHeight });
    }
    return DOMRect.fromRect();
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BottomSlot", () => {
  it("fixes a short populated slot above a fixed mobile nav and reserves its measured height", async () => {
    renderSlot();

    const slot = screen.getByText("계속").parentElement;
    const shell = screen.getByTestId("shell");
    const observer = firstObserver();
    const nav = document.querySelector(".primary-nav");

    await waitFor(() => expect(slot).toHaveAttribute("data-layout", "fixed"));
    expect(shell).toHaveStyle({ "--bottom-slot-height": "113px" });
    expect(observer.observe).toHaveBeenCalledWith(slot);
    expect(observer.observe).toHaveBeenCalledWith(nav);
  });

  it("returns to flow when the fixed stack is too tall or the viewport becomes desktop-sized", async () => {
    slotHeight = 160;
    navHeight = 60;
    renderSlot();

    const slot = screen.getByText("계속").parentElement;
    const shell = screen.getByTestId("shell");
    const nav = document.querySelector<HTMLElement>(".primary-nav");

    await waitFor(() => expect(slot).toHaveAttribute("data-layout", "flow"));
    expect(shell).toHaveStyle({ "--bottom-slot-height": "0px" });

    nav?.style.setProperty("position", "static");
    act(() => firstObserver().notify());
    await waitFor(() => expect(slot).toHaveAttribute("data-layout", "fixed"));

    vi.stubGlobal("innerWidth", 1000);
    act(() => window.dispatchEvent(new Event("resize")));
    await waitFor(() => expect(slot).toHaveAttribute("data-layout", "flow"));
    expect(shell).toHaveStyle({ "--bottom-slot-height": "0px" });
  });

  it("keeps an empty slot in flow without requiring ResizeObserver or a primary nav", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    renderSlot({ children: null, withNav: false });

    const slot = document.querySelector("[data-bottom-slot='true']");
    const shell = screen.getByTestId("shell");

    await waitFor(() => expect(slot).toHaveAttribute("data-layout", "flow"));
    expect(shell).toHaveStyle({ "--bottom-slot-height": "0px" });
  });

  it("does nothing when rendered outside a task shell", () => {
    render(
      <BottomSlot>
        <button type="button">계속</button>
      </BottomSlot>,
    );

    expect(screen.getByText("계속").parentElement).toHaveAttribute("data-layout", "flow");
    expect(ResizeObserverHarness.instances).toHaveLength(0);
  });

  it("disconnects observation, removes listeners, cancels work, and clears the reserved height", async () => {
    const visualViewport = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("visualViewport", visualViewport);
    const { unmount } = renderSlot();

    const shell = screen.getByTestId("shell");
    const observer = firstObserver();
    const removeWindowListener = vi.spyOn(window, "removeEventListener");

    await waitFor(() => expect(shell.style.getPropertyValue("--bottom-slot-height")).toBe("113px"));
    unmount();

    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(shell.style.getPropertyValue("--bottom-slot-height")).toBe("");
  });
});
