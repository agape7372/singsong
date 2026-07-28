import { describe, expect, it } from "vitest";

import type { Plan } from "@singsong/domain";

import { redirectSystemPath } from "../src/app/+native-intent";
import { ticketRevisionHref } from "../src/features/plan/ticket-navigation";
import { LABEL_OFF_FONT_SCALE, tabBarMetrics } from "../src/lib/tab-bar-metrics";
import { PRIMARY_NAV_CONTENT_HEIGHT } from "../src/theme/tokens";

const VALID_SLUG = `${"A".repeat(21)}A`;

describe("native deep-link normalization", () => {
  it.each([
    [`singsong://s/${VALID_SLUG}`, `/import?slug=${VALID_SLUG}`],
    [`singsong://app/s/${VALID_SLUG}`, `/import?slug=${VALID_SLUG}`],
    [`https://share.singsong.test/s/${VALID_SLUG}`, `/import?slug=${VALID_SLUG}`],
    [`/s/${VALID_SLUG}`, `/import?slug=${VALID_SLUG}`],
  ])("normalizes %s to the single import entry point", (path, expected) => {
    expect(redirectSystemPath({ path, initial: true })).toBe(expected);
  });

  it.each([
    "",
    "not a URL",
    "singsong://s/not-a-slug",
    `singsong://s/${VALID_SLUG}/extra`,
    `https://share.singsong.test/s/${VALID_SLUG}/extra`,
    `https://share.singsong.test/import?slug=${VALID_SLUG}`,
  ])("fails malformed or non-share input closed: %s", (path) => {
    expect(redirectSystemPath({ path, initial: false })).toBe("/");
  });
});

describe("tab bar metrics", () => {
  it("keeps labels below the 1.6 font-scale cutoff and grows for the safe area", () => {
    const metrics = tabBarMetrics(1.5, 24);
    expect(metrics.showLabel).toBe(true);
    expect(metrics.iconSize).toBe(22);
    expect(metrics.paddingBottom).toBe(24);
    expect(metrics.height).toBeGreaterThan(PRIMARY_NAV_CONTENT_HEIGHT + 24);
  });

  it("switches to icon-only metrics at the documented cutoff", () => {
    const metrics = tabBarMetrics(LABEL_OFF_FONT_SCALE, 18);
    expect(metrics).toMatchObject({
      showLabel: false,
      iconSize: 26,
      paddingBottom: 18,
      height: PRIMARY_NAV_CONTENT_HEIGHT + 18,
    });
  });

  it("normalizes invalid runtime measurements", () => {
    expect(tabBarMetrics(Number.NaN, -10)).toMatchObject({
      showLabel: true,
      iconSize: 22,
      paddingBottom: 0,
      height: PRIMARY_NAV_CONTENT_HEIGHT,
    });
  });
});

describe("ticket revision navigation", () => {
  const readyPlan: Plan = {
    id: "active",
    revision: 7,
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:01.000Z",
    items: [
      {
        id: "track-1",
        source: "manual",
        catalogSongId: null,
        title: "테스트 곡",
        artist: "테스트 가수",
        karaokeCodes: [],
        order: 0,
      },
    ],
    people: 2,
    pricing: { kind: "song", singlePriceWon: 1_000 },
  };

  it("routes to the exact committed revision", () => {
    expect(ticketRevisionHref(readyPlan)).toBe("/ticket/7");
  });

  it("does not route an absent or ticket-incomplete plan", () => {
    expect(ticketRevisionHref(null)).toBeNull();
    expect(ticketRevisionHref({ ...readyPlan, people: null })).toBeNull();
    expect(ticketRevisionHref({ ...readyPlan, items: [] })).toBeNull();
  });
});
