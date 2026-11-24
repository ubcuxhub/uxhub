/**
 * Event reminders against the local database: who claim_event_reminders picks,
 * and how completing and releasing a claim change that. Every claim is
 * narrowed to the test's own events, so a seeded database's due reminders stay
 * put. The cron job's signing is covered in supabase/tests/event-reminders.sql.
 */
import { describe, expect, it } from "vitest";

import { createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

import {
  claimEventReminders,
  completeEventReminder,
  releaseEventReminders,
  type ReminderSchedule,
} from "./event-reminders";
import { fetchEventById } from "./events";

const db = createIntegrationClient();

const minute = 60 * 1000;
const hour = 60 * minute;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

let events = 0;
/** A published event starting `startsIn` from now, with reminders set to `schedule`. */
async function reminderEvent(fixtures: Fixtures, startsIn: number, schedule: ReminderSchedule = "1d") {
  events += 1;
  return fixtures.createEvent({
    name: `Integration reminders ${fixtures.tag} ${events}`,
    slug: `integration-reminders-${fixtures.tag}-${events}`,
    status: "active",
    starts_at: at(startsIn),
    ends_at: at(startsIn + 2 * hour),
    location_building: "Orchard Commons",
    location_room: "1001",
    reminder_schedule: schedule,
  });
}

/** A ticket for a new member, issued `issuedAgo` before now. */
async function ticketFor(fixtures: Fixtures, eventId: string, issuedAgo = 3 * 24 * hour) {
  const member = await fixtures.createUser({ first_name: "Avery" });
  const { data, error } = await db
    .from("event_tickets")
    .insert({ event_id: eventId, user_id: member.id, created_at: at(-issuedAgo) })
    .select("id")
    .single();
  if (error) throw error;
  return { member, ticketId: data.id };
}

const claim = (...eventIds: string[]) => claimEventReminders(db, 25, eventIds);
const kinds = async (...eventIds: string[]) => (await claim(...eventIds)).map((row) => row.kind).sort();

async function setSchedule(eventId: string, schedule: ReminderSchedule) {
  const { error } = await db.from("events").update({ reminder_schedule: schedule }).eq("id", eventId);
  if (error) throw error;
}

describe("claim_event_reminders", () => {
  it("claims a day-before reminder with what the email needs, once", () =>
    withFixtures(async (fixtures) => {
      const event = await reminderEvent(fixtures, 20 * hour);
      const { member, ticketId } = await ticketFor(fixtures, event.id);

      const claims = await claim(event.id);
      expect(claims).toHaveLength(1);
      expect(claims[0]).toMatchObject({
        kind: "1d",
        attempts: 1,
        ticketId,
        eventId: event.id,
        email: member.email,
        firstName: "Avery",
        eventName: event.name,
        eventSlug: event.slug,
        location: { type: "in_person", building: "Orchard Commons", room: "1001" },
      });
      expect(Date.parse(claims[0].startsAt)).toBe(Date.parse(event.starts_at!));

      // Claimed, so not claimed again while the route sends it.
      expect(await claim(event.id)).toEqual([]);
      expect(await completeEventReminder(db, claims[0].sendId, { sent: true })).toBe(1);
      expect(await claim(event.id)).toEqual([]);

      // Turning reminders off and on again doesn't send a sent one again.
      await setSchedule(event.id, "off");
      await setSchedule(event.id, "both");
      expect(await claim(event.id)).toEqual([]);
    }));

  it("sends nothing while off, and stops unsent reminders when turned off", () =>
    withFixtures(async (fixtures) => {
      const event = await reminderEvent(fixtures, 20 * hour, "off");
      await ticketFor(fixtures, event.id);
      expect(await claim(event.id)).toEqual([]);

      await setSchedule(event.id, "1d");
      await setSchedule(event.id, "off");
      expect(await claim(event.id)).toEqual([]);

      await setSchedule(event.id, "1d");
      expect(await kinds(event.id)).toEqual(["1d"]);
    }));

  it("sends the kinds the setting names, each in its window", () =>
    withFixtures(async (fixtures) => {
      // 20 hours out: the day-before reminder is due, the two-hour one isn't.
      const tomorrow = await reminderEvent(fixtures, 20 * hour, "both");
      await ticketFor(fixtures, tomorrow.id);
      expect(await kinds(tomorrow.id)).toEqual(["1d"]);

      const twoHourOnly = await reminderEvent(fixtures, 20 * hour, "2h");
      await ticketFor(fixtures, twoHourOnly.id);
      expect(await claim(twoHourOnly.id)).toEqual([]);

      // 90 minutes out: the two-hour reminder is due, and a day-before one
      // that never went out is too late ("tomorrow" would be wrong).
      const soon = await reminderEvent(fixtures, 90 * minute, "both");
      await ticketFor(fixtures, soon.id);
      expect(await kinds(soon.id)).toEqual(["2h"]);

      const dayOnly = await reminderEvent(fixtures, 90 * minute, "1d");
      await ticketFor(fixtures, dayOnly.id);
      expect(await claim(dayOnly.id)).toEqual([]);

      // Too early for either, or already started.
      const later = await reminderEvent(fixtures, 30 * hour, "both");
      await ticketFor(fixtures, later.id);
      const started = await reminderEvent(fixtures, -10 * minute, "both");
      await ticketFor(fixtures, started.id);
      expect(await claim(later.id, started.id)).toEqual([]);
    }));

  it("skips someone who registered after the send time", () =>
    withFixtures(async (fixtures) => {
      // Sent 4 hours ago (24 hours before a start 20 hours out).
      const tomorrow = await reminderEvent(fixtures, 20 * hour);
      await ticketFor(fixtures, tomorrow.id, 3 * hour);
      expect(await claim(tomorrow.id)).toEqual([]);

      // Sent 30 minutes ago (2 hours before a start 90 minutes out).
      const soon = await reminderEvent(fixtures, 90 * minute, "2h");
      const early = await ticketFor(fixtures, soon.id, hour);
      await ticketFor(fixtures, soon.id, 10 * minute);
      expect((await claim(soon.id)).map((row) => row.ticketId)).toEqual([early.ticketId]);
    }));

  it("skips drafts, canceled events, voided tickets and deleted accounts", () =>
    withFixtures(async (fixtures) => {
      const draft = await fixtures.createEvent({
        slug: `integration-reminders-draft-${fixtures.tag}`,
        status: "draft",
        starts_at: at(20 * hour),
        ends_at: at(22 * hour),
        reminder_schedule: "both",
      });
      await ticketFor(fixtures, draft.id);

      const canceled = await reminderEvent(fixtures, 20 * hour);
      await ticketFor(fixtures, canceled.id);
      const { error: cancelError } = await db
        .from("events")
        .update({ canceled_at: new Date().toISOString() })
        .eq("id", canceled.id);
      if (cancelError) throw cancelError;
      expect(await claim(draft.id, canceled.id)).toEqual([]);

      const event = await reminderEvent(fixtures, 20 * hour);
      const voided = await ticketFor(fixtures, event.id);
      const deleted = await ticketFor(fixtures, event.id);
      const kept = await ticketFor(fixtures, event.id);

      const { data: refusal, error: voidError } = await db.rpc("void_event_ticket", { p_ticket_id: voided.ticketId });
      if (voidError) throw voidError;
      expect(refusal).toBeNull();
      const { error: deleteError } = await db
        .from("user_info")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deleted.member.id);
      if (deleteError) throw deleteError;

      expect((await claim(event.id)).map((row) => row.ticketId)).toEqual([kept.ticketId]);
    }));

  it("retries a failed send, never a released one twice, and gives up after five", () =>
    withFixtures(async (fixtures) => {
      const event = await reminderEvent(fixtures, 90 * minute, "2h");
      await ticketFor(fixtures, event.id, hour);

      // Released without trying: claimable again, and no attempt counted.
      const [first] = await claim(event.id);
      expect(await releaseEventReminders(db, [first.sendId], "rate_limit_exceeded")).toBe(1);
      const [again] = await claim(event.id);
      expect(again).toMatchObject({ sendId: first.sendId, attempts: 1 });

      // Each failure hands the claim back for the next run, up to five tries.
      let attempts: number | null = null;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const [current] = attempt === 1 ? [again] : await claim(event.id);
        expect(current.attempts).toBe(attempt);
        attempts = await completeEventReminder(db, current.sendId, { sent: false, errorCode: "validation_error" });
      }
      expect(attempts).toBe(5);
      expect(await claim(event.id)).toEqual([]);

      // Completing a claim that is no longer held changes nothing.
      expect(await completeEventReminder(db, first.sendId, { sent: true })).toBeNull();
    }));
});

describe("save_admin_event_builder and reminder_schedule", () => {
  const save = (eventId: string, event: Record<string, unknown>, expectedRevision?: number) =>
    db.rpc("save_admin_event_builder", {
      p_event_id: eventId,
      p_event: {
        ...event,
        _operation_id: crypto.randomUUID(),
        ...(expectedRevision === undefined ? {} : { _expected_revision: expectedRevision }),
      },
      p_draft_id: null!,
      p_draft_revision: 0,
      p_slug: null!,
      p_expected_image_url: null!,
      p_expected_header_image_url: null!,
      p_check_in_sessions: [],
      p_application_questions: [],
      p_mentors: [],
      p_sponsors: [],
    });

  it("defaults existing and new rows to off", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "draft" });
      expect(event.reminder_schedule).toBe("off");
    }));

  it("saves the setting in the builder's own write, and leaves it alone when the key is absent", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ status: "draft" });

      const saved = await save(event.id, { reminder_schedule: "both" }, event.revision);
      expect(saved.error).toBeNull();
      const row = await fetchEventById(db, event.id);
      expect(row?.reminder_schedule).toBe("both");
      // One write, so the revision the builder gets back is the row's.
      expect((saved.data as { revision?: number }).revision).toBe(row?.revision);

      // Code that doesn't know the field (the deployed builder) keeps it.
      const untouched = await save(event.id, { name: `Renamed ${fixtures.tag}` }, row?.revision);
      expect(untouched.error).toBeNull();
      expect((await fetchEventById(db, event.id))?.reminder_schedule).toBe("both");

      const refused = await save(event.id, { reminder_schedule: "weekly" });
      expect(refused.error?.code).toBe("23514");
      expect((await fetchEventById(db, event.id))?.reminder_schedule).toBe("both");
    }));
});
