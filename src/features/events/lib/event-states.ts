import type {
  CheckInRow,
  CheckInSessionRow,
  EventApplicationRow,
  EventRow,
  EventTicketRow,
} from "@/lib/supabase/models";
import { applicationWindow } from "@/features/applications/lib/application-form";
import type { DbClient } from "@/lib/supabase-helpers/types";
import { fetchUserEventApplications } from "@/lib/supabase-helpers/event-applications";
import {
  fetchEventSeatCounts,
  fetchUserEventTickets,
} from "@/lib/supabase-helpers/event-tickets";

/**
 * The event fields that decide a student's state. `requires_application`
 * picks the pipeline: `reg-*` without applications, `app-*` with them, both
 * ending in the shared ticket and past states.
 */
export type StateEvent = Pick<
  EventRow,
  | "starts_at"
  | "ends_at"
  | "registration_opens_at"
  | "registration_closes_at"
  | "requires_application"
>;

/** One check-in on the student's ticket, with the end of its session. */
export type TicketCheckIn = Pick<CheckInRow, "checked_in_at"> & {
  /** `null` when the session has no end time: it then ends with the event. */
  session: Pick<CheckInSessionRow, "end_time"> | null;
};

/** What the student has done for one event, and what's left of it. */
export interface StudentEventState {
  ticket: (Pick<EventTicketRow, "id"> & { check_ins: TicketCheckIn[] }) | null;
  application: Pick<EventApplicationRow, "status" | "offer_expires_at"> | null;
  /** Seats nobody holds; `null` when unknown, which never reads as Full. */
  seatsLeft: number | null;
}

/**
 * The one state a student is in for an event (docs/event-states.md). The badge
 * and the event page's registration panel both read it; neither decides state.
 *
 * Each variant carries only what its own copy or layout needs. Dates are ISO
 * strings, as stored, so a state passes from a server page to a client
 * component unchanged. `closesAt` is when the window closes: for `reg-open`
 * the event's `registration_closes_at`, or its `starts_at` when that's empty;
 * for `app-open` and `app-draft` the `registration_closes_at` alone, as on the
 * apply page. `null` means no close.
 */
export type EventState =
  // ── Shared: registration, ticket, past ────────────────────────────────
  | { kind: "reg-upcoming"; opensAt: string }
  | { kind: "reg-open"; closesAt: string | null }
  | { kind: "reg-full" }
  /** `closedAt`: when registration closed. */
  | { kind: "reg-closed"; closedAt: string }
  | { kind: "reg-going"; ticketId: string }
  | { kind: "reg-checked-in"; ticketId: string; checkedInAt: string }
  | { kind: "reg-past" }
  | { kind: "reg-past-attended"; ticketId: string }
  // ── Application events, before a ticket ───────────────────────────────
  | { kind: "app-upcoming"; opensAt: string }
  | { kind: "app-open"; closesAt: string | null }
  | { kind: "app-draft"; closesAt: string | null }
  | { kind: "app-in-review" }
  | { kind: "app-waitlisted" }
  /**
   * The database requires a deadline on every accepted application; `null`
   * only if one slips through, and then the copy leaves the date out.
   */
  | { kind: "app-accepted"; offerExpiresAt: string | null }
  | { kind: "app-rejected" }
  /** `closedAt`: when applications closed. */
  | { kind: "app-missed"; closedAt: string }
  | { kind: "app-draft-expired"; closedAt: string }
  /** `windowOpen`: applications are still open, so they could reapply. */
  | { kind: "app-offer-expired"; offerExpiredAt: string; windowOpen: boolean };

export type EventStateKind = EventState["kind"];

const time = (value: string) => Date.parse(value);

/**
 * The check-in that counts the student as checked in right now, if any: from
 * the scan until its session ends, or until the event ends when the session
 * has no end time. The latest scan wins when sessions overlap.
 */
function activeCheckIn(
  checkIns: TicketCheckIn[],
  eventEnd: string | null,
  now: number
): string | null {
  let latest: string | null = null;
  for (const { checked_in_at: scannedAt, session } of checkIns) {
    if (!scannedAt || time(scannedAt) > now) continue;
    const end = session?.end_time ?? eventEnd;
    if (end && now > time(end)) continue;
    if (!latest || time(scannedAt) > time(latest)) latest = scannedAt;
  }
  return latest;
}

/**
 * The student's state for one event. The first rule that matches wins
 * (docs/event-states.md, "When more than one applies"):
 *
 * 1. The event has ended: past, attended if they had a ticket.
 * 2. They have a ticket: checked in while a check-in is active, else going.
 * 3. An application event: a decided or submitted application's state, then
 *    upcoming, then a draft's or the window's state.
 * 4. Otherwise: upcoming, then closed, then full, then open.
 *
 * A boundary instant belongs to the earlier side, as in the database: open
 * at `registration_opens_at` and still open at the close; ended only after
 * `ends_at`; an offer lapses at `offer_expires_at`.
 */
export function eventStateFor(
  event: StateEvent,
  { ticket, application, seatsLeft }: StudentEventState,
  now: Date
): EventState {
  const t = now.getTime();

  // An event without an end ends when it starts.
  const eventEnd = event.ends_at ?? event.starts_at;
  if (eventEnd && t > time(eventEnd)) {
    return ticket
      ? { kind: "reg-past-attended", ticketId: ticket.id }
      : { kind: "reg-past" };
  }

  if (ticket) {
    const checkedInAt = activeCheckIn(ticket.check_ins, eventEnd, t);
    return checkedInAt
      ? { kind: "reg-checked-in", ticketId: ticket.id, checkedInAt }
      : { kind: "reg-going", ticketId: ticket.id };
  }

  return event.requires_application
    ? applicationStateFor(event, application, t)
    : registrationStateFor(event, seatsLeft, t);
}

/**
 * An application event's state before a ticket. The window is the apply
 * page's own (`applicationWindow`), so the two always agree on when
 * applications are open: with no close date they stay open until the event
 * ends. Decisions come first and outlast the window, which only gates
 * applying; seats are never checked, so an application event is never Full.
 */
function applicationStateFor(
  event: StateEvent,
  application: StudentEventState["application"],
  t: number
): EventState {
  const window = applicationWindow(event, t);
  const closesAt = event.registration_closes_at;

  switch (application?.status) {
    case "submitted":
      return { kind: "app-in-review" };
    case "waitlisted":
      return { kind: "app-waitlisted" };
    case "rejected":
      return { kind: "app-rejected" };
    case "accepted": {
      const offerExpiresAt = application.offer_expires_at;
      return !offerExpiresAt || t < time(offerExpiresAt)
        ? { kind: "app-accepted", offerExpiresAt }
        : { kind: "app-offer-expired", offerExpiredAt: offerExpiresAt, windowOpen: window === "open" };
    }
  }

  // Not applied yet, or a draft: both depend on the window.
  if (window === "not_open") {
    return { kind: "app-upcoming", opensAt: event.registration_opens_at! };
  }
  if (application?.status === "draft") {
    return window === "open"
      ? { kind: "app-draft", closesAt }
      : { kind: "app-draft-expired", closedAt: closesAt! };
  }
  // The window only closes once `registration_closes_at` has passed, so it's set here.
  return window === "open"
    ? { kind: "app-open", closesAt }
    : { kind: "app-missed", closedAt: closesAt! };
}

/**
 * An event without applications, before a ticket. Without a close date,
 * registration stays open until the event starts (a UI rule: the database
 * treats an empty close as no limit). Closed beats Full: a closed event can't
 * reopen when an offer expires.
 */
function registrationStateFor(
  event: StateEvent,
  seatsLeft: number | null,
  t: number
): EventState {
  const opensAt = event.registration_opens_at;
  if (opensAt && t < time(opensAt)) return { kind: "reg-upcoming", opensAt };

  const closesAt = event.registration_closes_at ?? event.starts_at;
  if (closesAt && t > time(closesAt)) return { kind: "reg-closed", closedAt: closesAt };
  if (seatsLeft !== null && seatsLeft <= 0) return { kind: "reg-full" };
  return { kind: "reg-open", closesAt };
}

/**
 * Each event's state for one student, keyed by event id: their tickets,
 * applications and the seats left, fetched in one round trip each, then
 * `eventStateFor`. A plain object, so a server page can pass it to a client
 * component.
 */
export async function loadEventStates(
  supabase: DbClient,
  userId: string,
  events: (StateEvent & Pick<EventRow, "id">)[],
  now = new Date()
): Promise<Record<string, EventState>> {
  const eventIds = events.map((event) => event.id);
  const [tickets, applications, seats] = await Promise.all([
    fetchUserEventTickets(supabase, userId, eventIds),
    fetchUserEventApplications(supabase, userId, eventIds),
    fetchEventSeatCounts(supabase, eventIds),
  ]);

  return Object.fromEntries(
    events.map((event) => [
      event.id,
      eventStateFor(
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
