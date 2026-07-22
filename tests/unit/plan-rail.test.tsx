// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Plan, Track } from "@/domain/models";

vi.mock("next/link", () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children: ReactNode;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { PlanRail } from "@/features/plan/plan-rail";

const track: Track = {
  id: "track-1",
  source: "manual",
  catalogSongId: null,
  title: "밤의 체크인",
  artist: "싱송",
  karaokeCodes: [],
  order: 0,
};

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "active-plan",
    revision: 1,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    items: [],
    people: null,
    pricing: null,
    ...overrides,
  };
}

afterEach(cleanup);

describe("PlanRail", () => {
  it("keeps an empty or partially configured plan honest", () => {
    const view = render(<PlanRail plan={plan()} />);
    const rail = screen.getByRole("complementary", { name: "현재 플랜 요약" });

    expect(within(rail).getByText("0곡")).toBeVisible();
    expect(within(rail).getByText("계산 전")).toBeVisible();
    expect(within(rail).getByText("요금 미입력")).toBeVisible();
    expect(within(rail).getByRole("link", { name: "플랜 보기" })).toHaveAttribute("href", "/");

    view.rerender(<PlanRail plan={plan({ items: [track] })} />);
    expect(within(rail).getByText("1곡")).toBeVisible();
    expect(within(rail).getByText("약 0–5분")).toBeVisible();
    expect(within(rail).getByText("요금 미입력")).toBeVisible();
  });

  it("uses the domain calculation for the available duration and cost range", () => {
    const items = Array.from({ length: 3 }, (_, order) => ({
      ...track,
      id: `track-${order + 1}`,
      order,
    }));
    render(
      <PlanRail
        plan={plan({
          items,
          people: 2,
          pricing: { kind: "time", blockSeconds: 300, blockPriceWon: 1_000 },
        })}
      />,
    );

    const rail = screen.getByRole("complementary", { name: "현재 플랜 요약" });
    expect(within(rail).getByText("3곡")).toBeVisible();
    expect(within(rail).getByText("약 5–15분")).toBeVisible();
    expect(within(rail).getByText("₩2,000–₩3,000")).toBeVisible();
  });
});
