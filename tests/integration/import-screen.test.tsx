// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan, SharedSnapshot } from "@/domain/models";

const state = vi.hoisted(() => ({
  importSharedPlan: vi.fn(),
  push: vi.fn(),
  trackAnalytics: vi.fn(),
  plan: null as Plan | null,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: state.push }),
}));

vi.mock("@/features/plan/use-active-plan", () => ({
  useActivePlan: () => ({ plan: state.plan, error: null }),
}));

vi.mock("@/data/plan-database", () => ({ importSharedPlan: state.importSharedPlan }));
vi.mock("@/analytics/port", () => ({ trackAnalytics: state.trackAnalytics }));

vi.mock("@/features/ticket/ticket-card", () => ({
  TicketCard: ({ headingLevel = "h1" }: { headingLevel?: "h1" | "h2" | "h3" }) => {
    const Heading = headingLevel;
    return (
      <article aria-labelledby="import-ticket-heading">
        <Heading id="import-ticket-heading">오늘의 세션 스트립</Heading>
      </article>
    );
  },
}));

import { ImportScreen } from "@/features/import/import-screen";

const slug = `${"S".repeat(21)}A`;

const payload: SharedSnapshot = {
  schemaVersion: 1,
  artworkSeed: "AAAAAAAAAAAAAAAAAAAAAA",
  items: [
    {
      source: "manual",
      title: "밤의 체크인",
      artist: "싱송",
      karaokeCodes: [],
      order: 0,
    },
  ],
  calculation: {
    modelVersion: "fallback-v1",
    songCount: 1,
    duration: { lowSec: 165, midpointSec: 210, highSec: 255, coverageBps: 0 },
    pricing: { kind: "song", singlePriceWon: 1_000 },
    people: 2,
    derived: {
      totalLowWon: 1_000,
      totalHighWon: 1_000,
      perPersonLowWon: 500,
      perPersonHighWon: 500,
    },
  },
};

beforeEach(() => {
  state.plan = {
    id: "active-plan",
    revision: 1,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    items: [],
    people: null,
    pricing: null,
  };
  state.importSharedPlan.mockReset().mockResolvedValue({ status: "imported" });
  state.push.mockReset();
  state.trackAnalytics.mockReset();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ payload, expiresAt: "2099-07-22T00:00:00.000Z" }),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ImportScreen renewed status contract", () => {
  it("keeps the Korean preview hierarchy and reports a standalone import in Korean", async () => {
    render(<ImportScreen />);

    expect(screen.getByRole("heading", { level: 1, name: "공유 티켓 가져오기" })).toBeVisible();
    await waitFor(() => expect(screen.getByText("앱에서 실행 중")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("티켓 주소 또는 22자 코드"), {
      target: { value: slug },
    });
    fireEvent.click(screen.getByRole("button", { name: "티켓 확인" }));

    expect(
      await screen.findByRole("heading", { level: 2, name: "내용을 확인해 주세요." }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 3, name: "오늘의 세션 스트립" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("티켓 무결성을 확인했습니다.");

    fireEvent.click(screen.getByRole("button", { name: "이 브라우저에 가져오기" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "가져오기" }));

    await waitFor(() => expect(state.importSharedPlan).toHaveBeenCalledWith(1, slug, payload));
    expect(screen.getByRole("status")).toHaveTextContent("설치한 싱송에 저장했습니다.");
    expect(state.trackAnalytics).toHaveBeenCalledWith({ name: "import_saved" });
    expect(state.push).toHaveBeenCalledWith("/");
  });
});
