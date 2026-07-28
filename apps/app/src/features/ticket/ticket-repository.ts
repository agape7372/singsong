import {
  createTicketSnapshot,
  type DomainPorts,
  type Plan,
  type TicketSnapshot,
} from "@singsong/domain";
import { claimTicketMotion, getTicket, saveTicket, type PlanStore } from "@singsong/store";

export type TicketResolution =
  | {
      readonly status: "ready";
      readonly ticket: TicketSnapshot;
      readonly issued: boolean;
      readonly animateIssue: boolean;
    }
  | {
      readonly status: "missing";
      readonly revision: number;
    };

/**
 * The ticket route owns issuance. A plan screen only navigates here; this
 * function freezes and CAS-saves the current revision, while an older `?r=`
 * revision is load-only.
 */
export async function issueOrLoadTicket({
  store,
  plan,
  requestedRevision,
  ports,
}: {
  store: PlanStore;
  plan: Plan;
  requestedRevision?: number;
  ports: DomainPorts;
}): Promise<TicketResolution> {
  const revision = requestedRevision ?? plan.revision;
  let ticket = await getTicket(store, plan.id, revision);
  let issued = false;

  if (!ticket && revision === plan.revision) {
    const candidate = await createTicketSnapshot(plan, ports);
    ticket = await saveTicket(store, candidate);
    issued = ticket.fingerprint === candidate.fingerprint;
  }

  if (!ticket) return { status: "missing", revision };

  let animateIssue = false;
  if (revision === plan.revision) {
    try {
      animateIssue = await claimTicketMotion(store, ticket.planId, ticket.revision);
    } catch {
      // A failed one-shot motion claim must never hide an otherwise valid,
      // frozen ticket. The next visit can safely retry the atomic claim.
    }
  }

  return { status: "ready", ticket, issued, animateIssue };
}

export function parseTicketRevision(value: string | string[] | undefined) {
  if (value === undefined) return { valid: true as const, revision: undefined };
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || !/^(?:0|[1-9]\d*)$/u.test(raw)) {
    return { valid: false as const, revision: undefined };
  }
  const revision = Number(raw);
  if (!Number.isSafeInteger(revision)) {
    return { valid: false as const, revision: undefined };
  }
  return { valid: true as const, revision };
}
