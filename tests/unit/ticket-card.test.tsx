// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SharedSnapshot } from "@/domain/models";

const motionState = vi.hoisted(() => ({
  reduced: false,
  articleProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("motion/react", async () => {
  const React = await import("react");

  return {
    motion: {
      article: React.forwardRef<HTMLElement, Record<string, unknown>>(function FakeMotionArticle(
        { initial, animate, transition, children, ...props },
        ref,
      ) {
        motionState.articleProps.push({ initial, animate, transition });
        return React.createElement("article", { ...props, ref }, children as React.ReactNode);
      }),
    },
    useReducedMotion: () => motionState.reduced,
  };
});

import { TicketCard } from "@/features/ticket/ticket-card";

const rangedPayload: SharedSnapshot = {
  schemaVersion: 1,
  artworkSeed: "seed-abcdefghijk",
  items: [
    {
      source: "manual",
      title: "직접 넣은 곡",
      artist: "",
      karaokeCodes: [],
      order: 0,
    },
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

beforeEach(() => {
  motionState.reduced = false;
  motionState.articleProps.length = 0;
});

describe("TicketCard rendering contract", () => {
  it("renders track fallbacks, codes, outward time, ranged money and fixture disclosure", () => {
    const html = renderToStaticMarkup(
      <TicketCard
        payload={rangedPayload}
        fingerprint="abcdef0123456789"
        testData
        className="export-capture"
        headingLevel="h1"
      />,
    );

    expect(html).toContain('class="ticket-card export-capture"');
    expect(html).toContain("TEST DATA · 실제 노래방 곡 목록이 아닙니다");
    // The riso poster front carries only the headline: full song list and the
    // time/per-person breakdown moved to the flip back. The stub keeps the total.
    expect(html).not.toContain("TJ 12345 · KY 54321");
    expect(html).not.toContain("5–15분");
    expect(html).not.toContain("₩334–₩667");
    expect(html).toContain("₩1,000–₩2,000");
    expect(html).toContain("ABCDEF0123");
    expect(motionState.articleProps.at(-1)).toMatchObject({
      initial: false,
      transition: { duration: 0 },
    });
  });

  it("omits duplicate range values and uses the artwork seed without a fingerprint", () => {
    const payload: SharedSnapshot = {
      ...rangedPayload,
      calculation: {
        ...rangedPayload.calculation,
        derived: {
          totalLowWon: 1_000,
          totalHighWon: 1_000,
          perPersonLowWon: 334,
          perPersonHighWon: 334,
        },
      },
    };

    const html = renderToStaticMarkup(<TicketCard payload={payload} animate headingLevel="h1" />);

    expect(html).not.toContain("TEST DATA");
    expect(html).not.toContain("₩1,000–₩1,000");
    expect(html).not.toContain("₩334–₩334");
    expect(html).toContain("seed-abcde");
    expect(motionState.articleProps.at(-1)).toMatchObject({
      initial: { opacity: 0, y: 24, rotate: -0.6 },
      transition: { duration: 0.36 },
    });
  });

  it("gives every ticket a unique accessible heading tied to the poster title", () => {
    const html = renderToStaticMarkup(
      <>
        <TicketCard payload={rangedPayload} headingLevel="h2" />
        <TicketCard payload={rangedPayload} headingLevel="h3" />
      </>,
    );
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const tickets = [...parsed.querySelectorAll("article.ticket-card")];
    const labelledBy = tickets.map((ticket) => ticket.getAttribute("aria-labelledby"));

    expect(tickets).toHaveLength(2);
    expect(new Set(labelledBy)).toHaveLength(2);
    tickets.forEach((ticket, index) => {
      const headingId = ticket.getAttribute("aria-labelledby");
      const heading = headingId ? parsed.getElementById(headingId) : null;
      expect(heading?.tagName).toBe(index === 0 ? "H2" : "H3");
      expect(heading?.textContent).toBe("오늘의 세션 스트립");
      // Poster front keeps the song count accessible even though the detailed
      // ledger lives on the flip back.
      expect(ticket.querySelector(".ticket-numberplate")).not.toBeNull();
      expect(ticket.textContent).toContain("2곡");
    });
  });

  it("reduces issue motion to opacity when the user requests reduced motion", () => {
    motionState.reduced = true;

    renderToStaticMarkup(<TicketCard payload={rangedPayload} animate headingLevel="h1" />);

    expect(motionState.articleProps.at(-1)).toMatchObject({ initial: { opacity: 0 } });
  });
});
