"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { log } from "@/lib/log";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatTimestamp } from "@/lib/date";
import {
  decideEventApplication,
  fetchEventApplicationById,
  type ApplicationDecisionFailure,
  type DecisionSeats,
} from "@/lib/supabase-helpers/event-applications";
import type { SubmittedApplicationRow } from "@/lib/supabase/models";
import {
  buildApplicationDecisionUpdate,
  type ApplicationDecision,
} from "./lib/application-review";

/** What a review decision came to. A refusal says why, in words an admin can act on. */
export type ApplicationDecisionActionResult =
  | { ok: true; application: SubmittedApplicationRow; overCapacity: boolean }
  | { ok: false; reason: "OVER_CAPACITY"; error: string; seats: DecisionSeats }
  | { ok: false; reason: Exclude<ApplicationDecisionFailure, "OVER_CAPACITY">; error: string };

function decisionRefusal(reason: ApplicationDecisionFailure, decisionsReleaseAt: string | null): string {
  switch (reason) {
    case "NOT_FOUND":
      return "This application no longer exists.";
    case "NOT_SUBMITTED":
      return "A draft application cannot be decided.";
    case "INVALID_DECISION":
      return "Invalid application decision.";
    case "DEADLINE_REQUIRED":
      return "Accepting an application needs an offer deadline.";
    case "DEADLINE_TOO_EARLY":
      return decisionsReleaseAt && Date.parse(decisionsReleaseAt) > Date.now()
        ? `Pick a deadline after decisions are released (${formatTimestamp(decisionsReleaseAt)}).`
        : "The offer deadline must be in the future.";
    case "HAS_TICKET":
      return "This applicant already registered, so the offer can’t be changed.";
    case "NOT_ALLOWED":
      return "This decision can’t be made any more. Reload to see the latest.";
    case "OVER_CAPACITY":
      return "The event is full.";
  }
}

/**
 * Records a review decision through `decide_event_application`
 * (docs/event-states.md, "Admin: application"). Accepting needs a future
 * `offerExpiresAt`, after the decision release; an accept that would take a
 * seat the event doesn't have comes back as OVER_CAPACITY, with the counts,
 * unless `allowOverCapacity`. Malformed input throws; refusals return.
 */
export async function updateApplicationDecisionAction(
  applicationId: string,
  decision: ApplicationDecision,
  offerExpiresAt: string | null,
  options: { allowOverCapacity?: boolean } = {}
): Promise<ApplicationDecisionActionResult> {
  await requireAdmin();

  const result = buildApplicationDecisionUpdate(decision, offerExpiresAt);
  if (!result.ok) throw new Error(result.error);

  const allowOverCapacity = options.allowOverCapacity === true;
  const decided = await decideEventApplication(supabaseAdmin, {
    applicationId,
    decision,
    offerExpiresAt: result.update.offer_expires_at,
    allowOverCapacity,
  });

  if (!decided.ok) {
    log.warn("application.decision_refused", { applicationId, eventId: decided.eventId, decision, reason: decided.reason });
    const error = decisionRefusal(decided.reason, decided.decisionsReleaseAt);
    return decided.reason === "OVER_CAPACITY"
      ? { ok: false, reason: "OVER_CAPACITY", error, seats: decided.seats }
      : { ok: false, reason: decided.reason, error };
  }

  log.info("application.decided", {
    applicationId,
    eventId: decided.eventId,
    decision,
    previousStatus: decided.previousStatus,
    status: decided.status,
    overCapacity: decided.overCapacity,
  });
  if (decided.overCapacity) {
    log.warn("application.accepted_over_capacity", {
      applicationId,
      eventId: decided.eventId,
      tickets: decided.seats.tickets,
      heldOffers: decided.seats.heldOffers,
      capacity: decided.seats.capacity,
    });
  }

  // The database refuses to decide a draft, so the row is a submitted one.
  const updated = await fetchEventApplicationById(supabaseAdmin, applicationId);
  if (!updated || updated.status === "draft") {
    throw new Error("The decided application could not be read back.");
  }
  return { ok: true, application: { ...updated, status: updated.status }, overCapacity: decided.overCapacity };
}
