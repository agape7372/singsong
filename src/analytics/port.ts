export type AnalyticsEvent =
  | { name: "song_added"; source: "catalog" | "manual" }
  | { name: "plan_activated" }
  | { name: "ticket_rendered" }
  | { name: "snapshot_created" }
  | { name: "share_invoked" }
  | { name: "share_sheet_resolved" }
  | { name: "link_copy_succeeded" }
  | { name: "image_save_succeeded" }
  | { name: "import_saved" };

export interface AnalyticsPort {
  track(event: AnalyticsEvent): void;
}

class NoopAnalyticsPort implements AnalyticsPort {
  track() {
    // Provider and budget are intentionally undecided for P0. Never fall back
    // to console output because event payloads must not leak into local logs.
  }
}

export class TestAnalyticsSink implements AnalyticsPort {
  readonly events: AnalyticsEvent[] = [];

  track(event: AnalyticsEvent) {
    this.events.push(structuredClone(event));
  }
}

const productionPort: AnalyticsPort = new NoopAnalyticsPort();

export function trackAnalytics(event: AnalyticsEvent) {
  try {
    productionPort.track(event);
  } catch {
    // Product behavior must not depend on an optional analytics provider.
  }
}
