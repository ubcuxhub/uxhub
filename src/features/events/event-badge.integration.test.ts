/**
 * The student's event badges against the local database: the batch ticket and
 * application helpers, and `loadEventBadges`, run as the student under RLS the
 * way the portal pages call them. See docs/event-states.md for the rules.
 */
import { describe, expect, it } from "vitest";

import { loadEventBadges } from "@/features/events/lib/event-badge";
import type { Database } from "@/lib/supabase/database.types";
import { formatEventDate } from "@/lib/date";
import { fetchUserEventApplications } from "@/lib/supabase-helpers/event-applications";
import { fetchUserEventTickets } from "@/lib/supabase-helpers/event-tickets";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

const db = createIntegrationClient();

type EventInsert = Partial<Database["public"]["Tables"]["events"]["Insert"]>;

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

/** Registration open now; the event is a week out. */
function openEvent(fixtures: Fixtures, slug: string, overrides: EventInsert = {}) {
  return fixtures.createEvent({
    slug: `${slug}-${fixtures.tag}`,
    status: "active",
    starts_at: at(7 * day),
    ends_at: at(7 * day + 2 * hour),
    registration_opens_at: at(-hour),
    registration_closes_at: at(6 * day),
    ...overrides,
  });
}

async function giveTicket(eventId: string, userId: string) {
  const { data, error } = await db
    .from("event_tickets")
    .insert({ event_id: eventId, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function checkIn(eventId: string, ticketId: string) {
  const { data: session, error } = await db
    .from("check_in_sessions")
    .insert({ event_id: eventId, name: "Doors" })
    .select()
    .single();
  if (error) throw error;
  const inserted = await db
    .from("check_ins")
    .insert({ ticket_id: ticketId, check_in_session_id: session.id });
  if (inserted.error) throw inserted.error;
}

async function apply(
  eventId: string,
  userId: string,
  decision: {
    status: Database["public"]["Enums"]["event_application_status"];
    offer_expires_at?: string;
  }
) {
  const { data, error } = await db
    .from("event_applications")
    .insert({ event_id: eventId, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  const updated = await db.from("event_applications").update(decision).eq("id", data.id);
  if (updated.error) throw updated.error;
}

describe("fetchUserEventTickets", () => {
  it("returns the user's tickets to the given events, with their check-ins", () =>
    withFixtures(async (fixtures) => {
      const [scanned, unscanned, unasked] = await Promise.all([
        openEvent(fixtures, "scanned"),
        openEvent(fixtures, "unscanned"),
        openEvent(fixtures, "unasked"),
      ]);
      const student = await fixtures.createUser();
      const other = await fixtures.createUser();

      const ticket = await giveTicket(scanned.id, student.id);
      await checkIn(scanned.id, ticket.id);
      await giveTicket(unscanned.id, student.id);
      await giveTicket(unasked.id, student.id);
      const otherTicket = await giveTicket(unscanned.id, other.id);
      await checkIn(unscanned.id, otherTicket.id);

      const tickets = await fetchUserEventTickets(clientAs(student), student.id, [
        scanned.id,
        unscanned.id,
      ]);

      expect([...tickets.keys()].sort()).toEqual([scanned.id, unscanned.id].sort());
      expect(tickets.get(scanned.id)?.check_ins).toHaveLength(1);
      // Another student's check-in on the same event isn't theirs.
      expect(tickets.get(unscanned.id)?.check_ins).toEqual([]);
    }));

  it("shows a student nobody else's tickets, whatever id they ask for", () =>
    withFixtures(async (fixtures) => {
      const event = await openEvent(fixtures, "event");
      const student = await fixtures.createUser();
      const other = await fixtures.createUser();
      await giveTicket(event.id, other.id);

      const tickets = await fetchUserEventTickets(clientAs(student), other.id, [event.id]);
      expect(tickets.size).toBe(0);
    }));

  it("returns nothing for no events", async () => {
    expect((await fetchUserEventTickets(db, "unused", [])).size).toBe(0);
  });
});

describe("fetchUserEventApplications", () => {
  it("returns the user's applications to the given events only", () =>
    withFixtures(async (fixtures) => {
      const [applied, unasked] = await Promise.all([
        openEvent(fixtures, "applied", { requires_application: true }),
        openEvent(fixtures, "unasked", { requires_application: true }),
      ]);
      const student = await fixtures.createUser();
      const other = await fixtures.createUser();
      await apply(applied.id, student.id, { status: "waitlisted" });
      await apply(unasked.id, student.id, { status: "rejected" });
      await apply(applied.id, other.id, { status: "rejected" });

      const applications = await fetchUserEventApplications(
        clientAs(student),
        student.id,
        [applied.id]
      );

      expect([...applications.keys()]).toEqual([applied.id]);
      expect(applications.get(applied.id)?.status).toBe("waitlisted");
    }));
});

describe("loadEventBadges", () => {
  it("gives each event the student's badge, as the student sees it", () =>
    withFixtures(async (fixtures) => {
      const student = await fixtures.createUser();
      const other = await fixtures.createUser();
      const deadline = at(3 * day);

      const [checkedIn, going, offered, full, open, opensLater, past] = await Promise.all([
        openEvent(fixtures, "checked-in"),
        openEvent(fixtures, "going", { max_capacity: 1 }),
        openEvent(fixtures, "offered", { requires_application: true }),
        openEvent(fixtures, "full", { max_capacity: 1 }),
        openEvent(fixtures, "open"),
        openEvent(fixtures, "opens-later", { registration_opens_at: at(2 * day) }),
        openEvent(fixtures, "past", {
          starts_at: at(-2 * day),
          ends_at: at(-2 * day + 2 * hour),
        }),
      ]);

      const scannedTicket = await giveTicket(checkedIn.id, student.id);
      await checkIn(checkedIn.id, scannedTicket.id);
      // Their own ticket fills the only seat: still Going, not Full.
      await giveTicket(going.id, student.id);
      await apply(offered.id, student.id, { status: "accepted", offer_expires_at: deadline });
      // Somebody else's ticket fills the only seat.
      await giveTicket(full.id, other.id);

      const events = [checkedIn, going, offered, full, open, opensLater, past];
      const badges = await loadEventBadges(clientAs(student), student.id, events);
      const short = (value: string) =>
        formatEventDate(value, { month: "short", year: undefined });

      expect(badges).toEqual({
        [checkedIn.id]: { status: "checked_in" },
        [going.id]: { status: "going" },
        [offered.id]: { status: "register_by", date: short(deadline) },
        [full.id]: { status: "full" },
        [open.id]: { status: "registration_open" },
        [opensLater.id]: { status: "opens", date: short(opensLater.registration_opens_at!) },
        [past.id]: { status: "past" },
      });
    }));
});
