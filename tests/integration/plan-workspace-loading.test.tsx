// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicStub() {
      return null;
    },
}));

vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

vi.mock("@/features/plan/use-active-plan", () => ({
  useActivePlan: () => ({
    plan: null,
    error: null,
    notice: null,
    isSaving: false,
    mutate: vi.fn(),
    dismissError: vi.fn(),
    announce: vi.fn(),
  }),
}));

import { PlanWorkspace } from "@/features/plan/plan-workspace";

afterEach(cleanup);

describe("PlanWorkspace loading shell", () => {
  it("keeps the Korean route heading and a hidden ledger skeleton while the plan opens", () => {
    const view = render(<PlanWorkspace view="plan" />);

    const shell = screen.getByRole("region", { name: "오늘의 플랜" });
    expect(shell).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("heading", { level: 2, name: "오늘의 순서를 여는 중" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "이 기기에 저장된 순서를 불러오고 있어요.",
    );
    const planSkeleton = shell.querySelector(".loading-track-list");
    expect(planSkeleton).toHaveAttribute("aria-hidden", "true");
    expect(planSkeleton?.querySelectorAll("li")).toHaveLength(3);

    view.rerender(<PlanWorkspace view="search" />);

    const searchShell = screen.getByRole("region", { name: "곡 찾기" });
    expect(searchShell).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("저장된 플랜을 확인하는 중…");
    const searchSkeleton = searchShell.querySelector(".search-ledger-loading");
    expect(searchSkeleton).toHaveAttribute("aria-hidden", "true");
    expect(searchSkeleton?.querySelectorAll(".search-result-row")).toHaveLength(3);
  });
});
