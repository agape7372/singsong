// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeActionDock } from "@/features/plan/home-action-dock";

afterEach(cleanup);

describe("HomeActionDock", () => {
  it("opens the search sheet from the empty search action", () => {
    const onOpenSearch = vi.fn();
    render(
      <HomeActionDock
        songCount={0}
        canIssue={false}
        onOpenPricing={vi.fn()}
        onIssue={vi.fn()}
        onOpenSearch={onOpenSearch}
      />,
    );

    const action = screen.getByRole("button", { name: "노래 찾기" });
    fireEvent.click(action);
    expect(onOpenSearch).toHaveBeenCalledOnce();
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
        onOpenSearch={vi.fn()}
      />,
    );

    const confirmAction = screen.getByRole("button", { name: "완료" });
    expect(confirmAction).toHaveClass("home-confirm-action");
    expect(screen.queryByText(/확정하는 순간/u)).not.toBeInTheDocument();
    fireEvent.click(confirmAction);
    expect(onOpenPricing).toHaveBeenCalledOnce();
    expect(onIssue).not.toHaveBeenCalled();

    view.rerender(
      <HomeActionDock
        songCount={3}
        canIssue
        onOpenPricing={onOpenPricing}
        onIssue={onIssue}
        onOpenSearch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "완료" }));
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
        onOpenSearch={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "완료" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onOpenPricing).not.toHaveBeenCalled();
  });
});
