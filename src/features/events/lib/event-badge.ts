import type { EventBadge } from "@/features/events/types";
import { formatEventDate } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";

import type { EventState } from "./event-states";
import { isDraftEvent } from "./event-visibility";

/**
 * The badge on an unpublished event, which only admins and managers see. It
 * says "Draft event" rather than "Draft", which already names a student's
 * unsubmitted application.
 */
export const DRAFT_EVENT_BADGE: EventBadge = { status: "draft", label: "Draft event" };

/**
 * The badge on an event's timeline card: "Draft event" for an unpublished
 * event, so staff never mistake it for a live one, else the viewer's state.
 */
export function timelineBadgeFor(
  event: Pick<EventRow, "status">,
  state: EventState
): EventBadge {
  return isDraftEvent(event) ? DRAFT_EVENT_BADGE : eventBadgeFor(state);
}

/** "Oct 20", in Pacific time. */
const shortDate = (value: string | null) =>
  (value && formatEventDate(value, { month: "short", year: undefined })) ?? undefined;

/**
 * The badge for a student's event state (docs/event-states.md, "Students:
 * event states"). It only names the state: `eventStateFor` decides it.
 */
export function eventBadgeFor(state: EventState): EventBadge {
  switch (state.kind) {
    case "canceled":
      return { status: "canceled" };
    case "reg-upcoming":
    case "app-upcoming":
      return { status: "opens", date: shortDate(state.opensAt) };
    case "reg-open":
      return { status: "registration_open" };
    case "reg-full":
      return { status: "full" };
    case "reg-closed":
      return { status: "registration_closed" };
    case "reg-going":
      return { status: "going" };
    case "reg-checked-in":
      return { status: "checked_in" };
    case "reg-past":
    case "reg-past-attended":
      return { status: "past" };
    case "app-open":
      return { status: "applications_open" };
    case "app-draft":
      return { status: "draft" };
    case "app-in-review":
      return { status: "pending" };
    case "app-waitlisted":
      return { status: "waitlisted" };
    case "app-accepted":
      return { status: "register_by", date: shortDate(state.offerExpiresAt) };
    case "app-rejected":
      return { status: "not_selected" };
    case "app-missed":
    case "app-draft-expired":
      return { status: "applications_closed" };
    // Not "Applications open" even while the window is: an accepted
    // application can't be resubmitted, so there's nothing to apply for.
    case "app-offer-expired":
      return { status: "offer_expired" };
    default:
      return assertNever(state);
  }
}

function assertNever(state: never): never {
  throw new Error(`Unhandled event state: ${JSON.stringify(state)}`);
}
