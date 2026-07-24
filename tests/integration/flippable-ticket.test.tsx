// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SharedSnapshot } from "@/domain/models";

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    motion: {
      article: React.forwardRef<HTMLElement, Record<string, unknown>>(function FakeMotionArticle(
        { initial, animate, transition, children, ...props },
        ref,
      ) {
        void initial;
        void animate;
        void transition;
        return React.createElement("article", { ...props, ref }, children as React.ReactNode);
      }),
    },
    useReducedMotion: () => false,
  };
});

import { FlippableTicket } from "@/features/ticket/flippable-ticket";

const payload: SharedSnapshot = {
  schemaVersion: 1,
  artworkSeed: "seed-abcdefghijk",
  items: [
    { source: "manual", title: "직접 넣은 곡", artist: "", karaokeCodes: [], order: 0 },
    {
      source: "catalog",
      title: "검색한 곡",
      artist: "가수",
      karaokeCodes: [
        { vendor: "TJ", code: "12345" },
        { vendor: "KY", code: "54321" },
      ],
      order: 1,
    },
  ],
  calculation: {
    modelVersion: "fallback-v1",
    songCount: 2,
    duration: { lowSec: 350, midpointSec: 500, highSec: 700, coverageBps: 0 },
    pricing: { kind: "time", blockSeconds: 600, blockPriceWon: 1_000 },
    people: 3,
    derived: {
      totalLowWon: 1_000,
      totalHighWon: 2_000,
      perPersonLowWon: 334,
      perPersonHighWon: 667,
    },
  },
};

afterEach(cleanup);

describe("FlippableTicket", () => {
  it("flips between the summary front and the detailed back", () => {
    render(<FlippableTicket payload={payload} fingerprint="abcdef0123456789" headingLevel="h2" />);

    const toggle = screen.getByRole("button", { name: "티켓 뒷면 상세 보기" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    // Back holds the full song ledger the front omits.
    const back = document.querySelector<HTMLElement>(".ticket-back");
    expect(back).not.toBeNull();
    const list = back!.querySelector("ol.ticket-back-list");
    expect(list).not.toBeNull();
    expect(list!.querySelectorAll("li")).toHaveLength(2);
    expect(back!).toHaveTextContent("TJ 12345 · KY 54321");
    expect(back!.querySelector("dl.ticket-back-summary")).not.toBeNull();

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "티켓 앞면 보기" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("티켓 뒷면 · 상세");
  });

  it("flips with the keyboard (Enter/Space)", () => {
    render(<FlippableTicket payload={payload} headingLevel="h2" />);
    const toggle = screen.getByRole("button", { name: "티켓 뒷면 상세 보기" });

    fireEvent.keyDown(toggle, { key: "Enter" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(toggle, { key: " " });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("renders a static front with no toggle when non-interactive", () => {
    render(<FlippableTicket payload={payload} headingLevel="h2" interactive={false} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.querySelector(".flip-scene")).toBeNull();
    expect(document.querySelector("article.ticket-card")).not.toBeNull();
  });
});
