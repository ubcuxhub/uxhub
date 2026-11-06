import type { EventBadge } from "@/features/events/types";
import { formatEventDate } from "@/lib/date";
import type { EventApplicationRow, EventRow } from "@/lib/supabase/models";
import type { DbClient } from "@/lib/supabase-helpers/types";
import { fetchUserEventApplications } from "@/lib/supabase-helpers/event-applications";
import {
  fetchEventSeatCounts,
  fetchUserEventTickets,
  type EventTicketWithCheckIns,
} from "@/lib/supabase-helpers/event-tickets";

type BadgeEvent = Pick<
  EventRow,
  "starts_at" | "ends_at" | "registration_opens_at" | "registration_closes_at"
>;

/** What the student has done for one event, and what's left of it. */
export interface StudentEventState {
  ticket: Pick<EventTicketWithCheckIns, "check_ins"> | null;
  application: Pick<EventApplicationRow, "status" | "offer_expires_at"> | null;
  /** Seats nobody holds; `null` when unknown, which never reads as Full. */
  seatsLeft: number | null;
}

/** "Oct 20", in Pacific time. */
const shortDate = (value: string) =>
  formatEventDate(value, { month: "short", year: undefined }) ?? undefined;

const isBefore = (value: string, now: Date) => Date.parse(value) < now.getTime();

/**
 * The one badge a student sees for an event (docs/event-states.md, "When more
 * than one applies"). The first rule that matches wins:
 *
 * 1. The event has ended: Checked in if they attended, otherwise Past.
 * 2. They have a ticket: Checked in or Going.
 * 3. They have an application: its badge.
 * 4. Otherwise: the event's availability.
 */
export function eventBadgeFor(
  event: BadgeEvent,
  { ticket, application, seatsLeft }: StudentEventState,
  now: Date
): EventBadge {
  const checkedIn = (ticket?.check_ins.length ?? 0) > 0;

  // Ended, as on the timeline: once it ends, or once it starts if it has no end.
  const end = event.ends_at ?? event.starts_at;
  if (end && isBefore(end, now)) {
    return { status: checkedIn ? "checked_in" : "past" };
  }

  if (ticket) return { status: checkedIn ? "checked_in" : "going" };

  if (application) {
    switch (application.status) {
      case "submitted":
        return { status: "under_review" };
      case "waitlisted":
        return { status: "waitlisted" };
      case "rejected":
        return { status: "not_selected" };
      case "accepted": {
        const deadline = application.offer_expires_at;
        // The database requires a deadline on every accepted application.
        if (!deadline) return { status: "register_by" };
        return isBefore(deadline, now)
          ? { status: "offer_expired" }
          : { status: "register_by", date: shortDate(deadline) };
      }
    }
  }

  if (event.registration_opens_at && now.getTime() < Date.parse(event.registration_opens_at)) {
    return { status: "opens", date: shortDate(event.registration_opens_at) };
  }
  // Closed beats Full: a closed event can't reopen when an offer expires.
  if (event.registration_closes_at && isBefore(event.registration_closes_at, now)) {
    return { status: "registration_closed" };
  }
  if (seatsLeft !== null && seatsLeft <= 0) return { status: "full" };
  return { status: "registration_open" };
}

/**
 * Each event's badge for one student, keyed by event id: their tickets,
 * applications and the seats left, fetched in one round trip each, then
 * `eventBadgeFor`. A plain object, so a server page can pass it to a client
 * component.
 */
export async function loadEventBadges(
  supabase: DbClient,
  userId: string,
  events: (BadgeEvent & Pick<EventRow, "id">)[],
  now = new Date()
): Promise<Record<string, EventBadge>> {
  const eventIds = events.map((event) => event.id);
  const [tickets, applications, seats] = await Promise.all([
    fetchUserEventTickets(supabase, userId, eventIds),
    fetchUserEventApplications(supabase, userId, eventIds),
    fetchEventSeatCounts(supabase, eventIds),
  ]);

  return Object.fromEntries(
    events.map((event) => [
      event.id,
      eventBadgeFor(
        event,
        {
          ticket: tickets.get(event.id) ?? null,
          application: applications.get(event.id) ?? null,
          seatsLeft: seats.get(event.id)?.seatsLeft ?? null,
        },
        now
      ),
    ])
  );
}
