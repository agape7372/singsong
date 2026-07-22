import { describe, expect, it } from "vitest";
import { TestAnalyticsSink, type AnalyticsEvent } from "@/analytics/port";

describe("privacy-safe analytics port", () => {
  it("provides a typed test sink without adding identifiers or free text", () => {
    const sink = new TestAnalyticsSink();
    const events: AnalyticsEvent[] = [
      { name: "song_added", source: "manual" },
      { name: "snapshot_created" },
      { name: "import_saved" },
    ];
    events.forEach((event) => sink.track(event));

    expect(sink.events).toEqual(events);
    expect(JSON.stringify(sink.events)).not.toMatch(/slug|title|artist|query|device|fingerprint/iu);
  });
});
