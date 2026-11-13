import type { EventBadge } from "@/features/events/types";
import { formatEventDate } from "@/lib/date";

import type { EventState } from "./event-states";

/** "Oct 20", in Pacific time. */
const shortDate = (value: string | null) =>
  (value && formatEventDate(value, { month: "short", year: undefined })) ?? undefined;

/**
 * The badge for a student's event state (docs/event-states.md, "Students:
 * event states"). It only names the state: `eventStateFor` decides it.
 */
export function eventBadgeFor(state: EventState): EventBadge {
  switch (state.kind) {
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
    case "app-offer-expired":
      return { status: state.windowOpen ? "applications_open" : "applications_closed" };
    default:
      return assertNever(state);
  }
}

function assertNever(state: never): never {
  throw new Error(`Unhandled event state: ${JSON.stringify(state)}`);
}
