import type {
  EventApplicationRow,
  EventApplicationStatus,
} from "@/lib/supabase/models";

/**
 * What admins see for an application (docs/event-states.md, "Admin:
 * application"). `accepted` splits three ways by its deadline and ticket.
 */
export type ApplicationReviewState =
  | "submitted"
  | "waitlisted"
  | "accepted"
  | "registered"
  | "offer_expired"
  | "rejected";

export const APPLICATION_REVIEW_STATE_LABELS: Record<
  ApplicationReviewState,
  string
> = {
  submitted: "Submitted",
  waitlisted: "Waitlisted",
  accepted: "Accepted",
  registered: "Registered",
  offer_expired: "Offer expired",
  rejected: "Rejected",
};

export function getApplicationReviewState(
  application: Pick<EventApplicationRow, "status" | "offer_expires_at">,
  hasTicket: boolean,
  now: Date = new Date()
): ApplicationReviewState {
  if (application.status !== "accepted") return application.status;
  if (hasTicket) return "registered";

  const expiresAt = application.offer_expires_at
    ? Date.parse(application.offer_expires_at)
    : Number.NaN;
  return expiresAt > now.getTime() ? "accepted" : "offer_expired";
}

/** A decision an admin can make from a given state. */
export type ApplicationDecision = "accept" | "waitlist" | "reject";

/**
 * The decisions the database allows from each state. Accepting an accepted or
 * expired offer sets a new deadline; rejecting one takes it back, which the
 * database refuses once the person has a ticket.
 */
export function getApplicationDecisions(
  state: ApplicationReviewState
): ApplicationDecision[] {
  switch (state) {
    case "submitted":
      return ["accept", "waitlist", "reject"];
    case "waitlisted":
    case "accepted":
    case "offer_expired":
      return ["accept", "reject"];
    case "registered":
    case "rejected":
      return [];
  }
}

const DECISION_STATUS: Record<ApplicationDecision, EventApplicationStatus> = {
  accept: "accepted",
  waitlist: "waitlisted",
  reject: "rejected",
};

/**
 * Turns a decision into the row update, or explains why it is invalid. An
 * acceptance needs a future `offerExpiresAt` with a timezone; any other
 * decision clears the deadline.
 */
export function buildApplicationDecisionUpdate(
  decision: ApplicationDecision,
  offerExpiresAt: string | null,
  now: Date = new Date()
):
  | { ok: true; update: Pick<EventApplicationRow, "status" | "offer_expires_at"> }
  | { ok: false; error: string } {
  if (!Object.hasOwn(DECISION_STATUS, decision)) {
    return { ok: false, error: "Invalid application decision." };
  }

  if (decision !== "accept") {
    return {
      ok: true,
      update: { status: DECISION_STATUS[decision], offer_expires_at: null },
    };
  }

  if (
    !offerExpiresAt ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(offerExpiresAt) ||
    !Number.isFinite(Date.parse(offerExpiresAt))
  ) {
    return { ok: false, error: "Accepting an application needs an offer deadline." };
  }

  if (Date.parse(offerExpiresAt) <= now.getTime()) {
    return { ok: false, error: "The offer deadline must be in the future." };
  }

  return {
    ok: true,
    update: { status: "accepted", offer_expires_at: offerExpiresAt },
  };
}
