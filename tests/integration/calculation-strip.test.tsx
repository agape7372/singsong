// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Plan, Track } from "@/domain/models";

const analytics = vi.hoisted(() => ({ trackAnalytics: vi.fn() }));
vi.mock("@/analytics/port", () => analytics);

import { CalculationStrip, type CalculationStripHandle } from "@/features/plan/calculation-strip";

afterEach(() => {
  cleanup();
  analytics.trackAnalytics.mockReset();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

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
    items: [track],
    people: 2,
    pricing: { kind: "song", singlePriceWon: 1_000 },
    ...overrides,
  };
}

function tracks(count: number): Track[] {
  return Array.from({ length: count }, (_, order) => ({
    ...track,
    id: `track-${order + 1}`,
    title: `노래 ${order + 1}`,
    order,
  }));
}

function submitPricing() {
  const button = screen.getByRole("button", { name: "계산에 적용" });
  fireEvent.submit(button.closest("form")!);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("CalculationStrip authoritative form state", () => {
  it("resets imported pricing while preserving an in-progress edit across unrelated revisions", async () => {
    const props = {
      disabled: false,
      onApply: vi.fn(async () => true),
    };
    const view = render(<CalculationStrip plan={plan()} {...props} />);

    const people = screen.getByLabelText("나눌 인원");
    expect(screen.getByRole("radio", { name: "곡 요금" })).toBeChecked();
    expect(people).toHaveValue(2);
    expect(screen.getByLabelText("낱곡 가격 (원)")).toHaveValue(1_000);

    fireEvent.change(people, { target: { value: "9" } });
    view.rerender(<CalculationStrip plan={plan({ revision: 2 })} {...props} />);
    expect(screen.getByLabelText("나눌 인원")).toHaveValue(9);

    view.rerender(
      <CalculationStrip
        plan={plan({
          revision: 3,
          people: 4,
          pricing: { kind: "time", blockSeconds: 1_800, blockPriceWon: 15_000 },
        })}
        {...props}
      />,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: "시간 요금" })).toBeChecked());
    expect(screen.getByLabelText("나눌 인원")).toHaveValue(4);
    expect(screen.getByLabelText("시간 단위 (분)")).toHaveValue(30);
    expect(screen.getByLabelText("단위 가격 (원)")).toHaveValue(15_000);

    view.rerender(
      <CalculationStrip plan={plan({ revision: 4, people: null, pricing: null })} {...props} />,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: "곡 요금" })).toBeChecked());
    expect(screen.getByLabelText("나눌 인원")).toHaveValue(null);
    expect(screen.getByLabelText("낱곡 가격 (원)")).toHaveValue(null);
  });

  it("validates every song-pricing boundary and applies a complete bundle once", async () => {
    const onApply = vi.fn(async () => true);
    render(
      <CalculationStrip plan={plan({ items: tracks(3) })} disabled={false} onApply={onApply} />,
    );

    fireEvent.change(screen.getByLabelText("나눌 인원"), { target: { value: "" } });
    submitPricing();
    expect(screen.getByRole("alert")).toHaveTextContent("1명부터 30명");

    fireEvent.change(screen.getByLabelText("나눌 인원"), { target: { value: "31" } });
    submitPricing();
    expect(screen.getByRole("alert")).toHaveTextContent("1명부터 30명");

    fireEvent.change(screen.getByLabelText("나눌 인원"), { target: { value: "1.5" } });
    submitPricing();
    expect(screen.getByRole("alert")).toHaveTextContent("1명부터 30명");

    fireEvent.change(screen.getByLabelText("나눌 인원"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("낱곡 가격 (원)"), { target: { value: "" } });
    submitPricing();
    expect(screen.getByRole("alert")).toHaveTextContent("낱곡 가격");

    fireEvent.change(screen.getByLabelText("낱곡 가격 (원)"), {
      target: { value: "10000001" },
    });
    submitPricing();
    expect(screen.getByRole("alert")).toHaveTextContent("낱곡 가격");

    fireEvent.change(screen.getByLabelText("낱곡 가격 (원)"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("묶음 곡 수 (선택)"), { target: { value: "3" } });
    submitPricing();
    expect(screen.getByRole("alert")).toHaveTextContent("함께 입력");

    fireEvent.change(screen.getByLabelText("묶음 가격 (원)"), { target: { value: "2500" } });
    fireEvent.change(screen.getByLabelText("묶음 곡 수 (선택)"), { target: { value: "101" } });
    submitPricing();
    expect(screen.getByRole("alert")).toHaveTextContent("묶음 값의 범위");

    fireEvent.change(screen.getByLabelText("묶음 곡 수 (선택)"), { target: { value: "3" } });
    submitPricing();
    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith(3, {
        kind: "song",
        singlePriceWon: 1_000,
        bundle: { songs: 3, priceWon: 2_500 },
      }),
    );
    expect(analytics.trackAnalytics).toHaveBeenCalledWith({ name: "plan_activated" });

    submitPricing();
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(2));
    expect(analytics.trackAnalytics).toHaveBeenCalledTimes(1);
  });

  it("applies an intentionally unbundled song price", async () => {
    const onApply = vi.fn(async () => true);
    render(<CalculationStrip plan={plan()} disabled={false} onApply={onApply} />);

    submitPricing();

    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith(2, { kind: "song", singlePriceWon: 1_000 }),
    );
  });

  it("validates and converts time pricing while exposing a failed CAS recovery", async () => {
    const onApply = vi
      .fn<(people: number, pricing: Plan["pricing"]) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    render(<CalculationStrip plan={plan()} disabled={false} onApply={onApply} />);

    fireEvent.click(screen.getByRole("radio", { name: "시간 요금" }));
    submitPricing();
    expect(screen.getByRole("alert")).toHaveTextContent("시간 단위");

    fireEvent.change(screen.getByLabelText("시간 단위 (분)"), { target: { value: "1441" } });
    fireEvent.change(screen.getByLabelText("단위 가격 (원)"), { target: { value: "1000" } });
    submitPricing();
    expect(screen.getByRole("alert")).toHaveTextContent("1–1,440분");

    fireEvent.change(screen.getByLabelText("시간 단위 (분)"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("단위 가격 (원)"), { target: { value: "15000" } });
    submitPricing();
    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith(2, {
        kind: "time",
        blockSeconds: 1_800,
        blockPriceWon: 15_000,
      }),
    );

    submitPricing();
    expect(await screen.findByRole("alert")).toHaveTextContent("다른 탭의 변경");
  });

  it("does not attach an older async apply failure to newly imported settings", async () => {
    const pending = deferred<boolean>();
    const view = render(
      <CalculationStrip plan={plan()} disabled={false} onApply={vi.fn(() => pending.promise)} />,
    );

    submitPricing();
    view.rerender(
      <CalculationStrip
        plan={plan({
          revision: 2,
          people: 4,
          pricing: { kind: "time", blockSeconds: 1_800, blockPriceWon: 15_000 },
        })}
        disabled={false}
        onApply={vi.fn(async () => true)}
      />,
    );
    await act(async () => pending.resolve(false));

    await waitFor(() => expect(screen.getByRole("radio", { name: "시간 요금" })).toBeChecked());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders a compact result and keeps reverse calculations in a disclosure", async () => {
    const view = render(
      <CalculationStrip
        plan={plan({
          items: tracks(3),
          people: 3,
          pricing: {
            kind: "song",
            singlePriceWon: 1_000,
            bundle: { songs: 3, priceWon: 2_500 },
          },
        })}
        disabled={false}
        onApply={vi.fn(async () => true)}
      />,
    );

    const summary = screen.getByText("계산 결과").closest(".calculation-summary");
    expect(summary).toHaveTextContent("3곡");
    expect(screen.getByText("₩2,500")).toBeVisible();
    const budgetDisclosure = screen.getByText("예산 안에 몇 곡인지 계산하기").closest("details");
    expect(budgetDisclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("예산 안에 몇 곡인지 계산하기"));
    expect(budgetDisclosure).toHaveAttribute("open");
    fireEvent.change(screen.getByLabelText("예산 (원)"), {
      target: { value: "2000" },
    });
    expect(screen.getByText(/2곡까지 가능합니다/u)).toBeVisible();
    expect(screen.queryByRole("button", { name: /티켓/u })).not.toBeInTheDocument();

    view.rerender(
      <CalculationStrip
        plan={plan({
          revision: 2,
          items: tracks(3),
          people: 2,
          pricing: { kind: "time", blockSeconds: 300, blockPriceWon: 1_000 },
        })}
        disabled={false}
        onApply={vi.fn(async () => true)}
      />,
    );
    fireEvent.change(screen.getByLabelText("예산 (원)"), {
      target: { value: "15000" },
    });
    expect(screen.getByText("₩2,000–₩3,000")).toBeVisible();
    expect(screen.getByText("₩1,000–₩1,500")).toBeVisible();
    expect(screen.getByText(/확실히/u)).toBeVisible();

    for (const invalidBudget of ["text", "-1", "100000001"]) {
      fireEvent.change(screen.getByLabelText("예산 (원)"), {
        target: { value: invalidBudget },
      });
      expect(screen.queryByText(/확실히/u)).not.toBeInTheDocument();
    }
  });

  it("opens pricing and focuses the first invalid field through its narrow handle", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    const ref = createRef<CalculationStripHandle>();
    const view = render(
      <CalculationStrip
        ref={ref}
        plan={plan({ people: null, pricing: null })}
        disabled={false}
        onApply={vi.fn(async () => true)}
      />,
    );

    const pricingDisclosure = screen.getByText("요금과 인원 설정").closest("details");
    expect(pricingDisclosure).not.toHaveAttribute("open");
    act(() => ref.current?.openPricingAndFocusFirstInvalid());
    expect(pricingDisclosure).toHaveAttribute("open");
    expect(screen.getByLabelText("나눌 인원")).toHaveFocus();

    view.rerender(
      <CalculationStrip
        ref={ref}
        plan={plan({ items: [] })}
        disabled={true}
        onApply={vi.fn(async () => true)}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "요금과 인원을 입력하면 바로 계산해요." }),
    ).toBeVisible();
    expect(screen.queryByText("세션 티켓 발급")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계산에 적용" })).toBeDisabled();
  });
});
