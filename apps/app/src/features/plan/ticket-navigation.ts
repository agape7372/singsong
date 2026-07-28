import { assertValidPlan, type Plan } from "@singsong/domain";

export type TicketRevisionHref = `/ticket/${number}`;

/**
 * Ticket issuance always names the committed revision. This prevents a route
 * mounted from a lagging React store snapshot from freezing the prior plan.
 */
export function ticketRevisionHref(plan: Plan | null): TicketRevisionHref | null {
  if (!plan) return null;
  try {
    assertValidPlan(plan, true);
  } catch {
    return null;
  }
  return `/ticket/${plan.revision}`;
}
