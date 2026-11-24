import type { EventRow } from "@/lib/supabase/models";
import { registrationWindow } from "./event-registration-window";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far ahead a registration close counts as soon. */
export const REGISTRATION_CLOSING_WINDOW_DAYS = 7;
/** How far ahead a decisions release counts as coming up: reviews have to be done by then. */
export const DECISIONS_RELEASE_WINDOW_DAYS = 14;

/**
 * One line in the Overview's "Needs action" panel. A `todo` is work waiting
 * on UX Hub execs; a `deadline` is a date coming up, with `at` set.
 */
export type NeedsActionItem =
  | { kind: "refund"; type: "todo"; count: number }
  | { kind: "review"; type: "todo"; count: number }
  | { kind: "decisions-release"; type: "deadline"; at: string }
  | { kind: "registration-closes"; type: "deadline"; at: string };

export interface NeedsActionInput {
  event: Pick<
    EventRow,
    | "status"
    | "requires_application"
    | "canceled_at"
    | "registration_opens_at"
    | "registration_closes_at"
  >;
  /** Submitted applications nobody has decided yet. */
  applicationsToReview: number;
  /** `event_application_settings.decisions_release_at`, when set. */
  decisionsReleaseAt: string | null;
  /** Paid tickets not fully refunded (`event_lifecycle_counts.paid_tickets`). */
  paidTickets: number;
}

function within(at: string | null, now: Date, days: number): at is string {
  if (!at) return false;
  const time = Date.parse(at);
  return time > now.getTime() && time - now.getTime() <= days * DAY_MS;
}

/**
 * What an event needs from UX Hub execs, from data that already exists:
 * to-dos first, then deadlines, soonest first. Empty when nothing does.
 *
 * - A canceled event needs its paid tickets refunded in Square, and nothing
 *   else: registration and applications have stopped.
 * - Submitted applications wait for review.
 * - Decisions release within two weeks.
 * - Open registration closes within a week.
 */
export function eventNeedsAction(input: NeedsActionInput, now: Date): NeedsActionItem[] {
  const { event } = input;

  if (event.canceled_at !== null) {
    return input.paidTickets > 0
      ? [{ kind: "refund", type: "todo", count: input.paidTickets }]
      : [];
  }

  const items: NeedsActionItem[] = [];
  if (event.requires_application && input.applicationsToReview > 0) {
    items.push({ kind: "review", type: "todo", count: input.applicationsToReview });
  }

  const deadlines: Extract<NeedsActionItem, { type: "deadline" }>[] = [];
  if (
    event.requires_application &&
    within(input.decisionsReleaseAt, now, DECISIONS_RELEASE_WINDOW_DAYS)
  ) {
    deadlines.push({ kind: "decisions-release", type: "deadline", at: input.decisionsReleaseAt });
  }
  if (
    registrationWindow(event, now) === "open" &&
    within(event.registration_closes_at, now, REGISTRATION_CLOSING_WINDOW_DAYS)
  ) {
    deadlines.push({ kind: "registration-closes", type: "deadline", at: event.registration_closes_at });
  }
  deadlines.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return [...items, ...deadlines];
}
