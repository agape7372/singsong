// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomSlot } from "@/components/bottom-slot";
import { HomeActionDock } from "@/features/plan/home-action-dock";

afterEach(cleanup);

describe("HomeActionDock", () => {
  it("renders the empty search action inside the shared bottom slot", () => {
    const { container } = render(
      <BottomSlot>
        <HomeActionDock songCount={0} canIssue={false} onOpenPricing={vi.fn()} onIssue={vi.fn()} />
      </BottomSlot>,
    );

    expect(container.querySelector("[data-bottom-slot='true']")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "노래 찾기" })).toHaveAttribute("href", "/search");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("routes invalid and valid plans to their single next action", () => {
    const onOpenPricing = vi.fn();
    const onIssue = vi.fn();
    const view = render(
      <HomeActionDock
        songCount={2}
        canIssue={false}
        onOpenPricing={onOpenPricing}
        onIssue={onIssue}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "요금과 인원 입력하기" }));
    expect(onOpenPricing).toHaveBeenCalledOnce();
    expect(onIssue).not.toHaveBeenCalled();

    view.rerender(
      <HomeActionDock songCount={3} canIssue onOpenPricing={onOpenPricing} onIssue={onIssue} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "3곡 티켓 만들기" }));
    expect(onIssue).toHaveBeenCalledOnce();
  });

  it("keeps the current action inert while persistence is busy", () => {
    const onOpenPricing = vi.fn();
    render(
      <HomeActionDock
        songCount={1}
        canIssue={false}
        disabled
        onOpenPricing={onOpenPricing}
        onIssue={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "요금과 인원 입력하기" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onOpenPricing).not.toHaveBeenCalled();
  });
});
