/**
 * Application emails against the local database: what claim_application_emails
 * picks, and how completing and releasing a claim change that. Every claim is
 * narrowed to the test's own event, so a seeded database's due emails stay
 * put. The backfill and reminders, which need a backdated send, are covered
 * in supabase/tests/application-emails.sql.
 */
import { describe, expect, it } from "vitest";

import { createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

import {
  claimApplicationEmails,
  completeApplicationEmail,
  releaseApplicationEmails,
} from "./application-emails";
import { decideEventApplication } from "./event-applications";

const db = createIntegrationClient();

const hour = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

/** A published event taking applications, with decisions released at `releaseAt`. */
let events = 0;
async function applicationEvent(fixtures: Fixtures, releaseAt: string | null = at(-hour)) {
  events += 1;
  const event = await fixtures.createEvent({
    name: `Integration emails ${fixtures.tag} ${events}`,
    slug: `integration-emails-${fixtures.tag}-${events}`,
    status: "active",
    requires_application: true,
    starts_at: at(10 * 24 * hour),
    ends_at: at(10 * 24 * hour + 2 * hour),
    registration_opens_at: at(-2 * 24 * hour),
    registration_closes_at: at(-hour),
  });
  const { error: questionError } = await db
    .from("event_application_questions")
    .insert({ event_id: event.id, question: "Why?", response_type: "long_text", is_required: true });
  if (questionError) throw questionError;
  if (releaseAt) {
    const { error } = await db
      .from("event_application_settings")
      .insert({ event_id: event.id, decisions_release_at: releaseAt });
    if (error) throw error;
  }
  return event;
}

async function applyAs(
  fixtures: Fixtures,
  eventId: string,
  status: "submitted" | "accepted" | "waitlisted" | "rejected",
  offerExpiresAt: string | null = status === "accepted" ? at(5 * 24 * hour) : null
) {
  const member = await fixtures.createUser({ first_name: "Avery" });
  const { data, error } = await db
    .from("event_applications")
    .insert({
      event_id: eventId,
      user_id: member.id,
      status,
      offer_expires_at: offerExpiresAt,
      submitted_at: at(-3 * 24 * hour),
    })
    .select("id")
    .single();
  if (error) throw error;
  return { member, applicationId: data.id };
}

const claim = (eventId: string) => claimApplicationEmails(db, 25, [eventId]);

describe("claim_application_emails", () => {
  it("claims released decisions only, with what the email needs", () =>
    withFixtures(async (fixtures) => {
      const hidden = await applicationEvent(fixtures, at(24 * hour));
      await applyAs(fixtures, hidden.id, "accepted", at(3 * 24 * hour));
      expect(await claim(hidden.id)).toEqual([]);

      const event = await applicationEvent(fixtures);
      const accepted = await applyAs(fixtures, event.id, "accepted");
      await applyAs(fixtures, event.id, "submitted");

      const claims = await claim(event.id);
      expect(claims).toHaveLength(1);
      expect(claims[0]).toMatchObject({
        kind: "accepted",
        attempts: 1,
        applicationId: accepted.applicationId,
        eventId: event.id,
        email: accepted.member.email,
        firstName: "Avery",
        eventName: event.name,
        eventSlug: event.slug,
      });
      expect(claims[0].offerExpiresAt).not.toBeNull();

      // Claimed, so not claimed again while the route sends it.
      expect(await claim(event.id)).toEqual([]);

      // Releasing the hidden event's decisions makes them due.
      const { error } = await db
        .from("event_application_settings")
        .update({ decisions_release_at: at(-60_000) })
        .eq("event_id", hidden.id);
      if (error) throw error;
      expect((await claim(hidden.id)).map((row) => row.kind)).toEqual(["accepted"]);
    }));

  it("sends again when the decision changes, and never twice for one", () =>
    withFixtures(async (fixtures) => {
      const event = await applicationEvent(fixtures);
      const { applicationId } = await applyAs(fixtures, event.id, "waitlisted");

      const [waitlisted] = await claim(event.id);
      expect(waitlisted.kind).toBe("waitlisted");
      await completeApplicationEmail(db, waitlisted.deliveryId, { sent: true });
      expect(await claim(event.id)).toEqual([]);

      const offered = await decideEventApplication(db, {
        applicationId,
        decision: "accept",
        offerExpiresAt: at(5 * 24 * hour),
      });
      expect(offered.ok).toBe(true);
      const [accepted] = await claim(event.id);
      expect(accepted.kind).toBe("accepted");
      await completeApplicationEmail(db, accepted.deliveryId, { sent: true });

      // A new deadline on the same offer isn't a new decision.
      const moved = await decideEventApplication(db, {
        applicationId,
        decision: "accept",
        offerExpiresAt: at(6 * 24 * hour),
      });
      expect(moved.ok).toBe(true);
      expect(await claim(event.id)).toEqual([]);

      const taken = await decideEventApplication(db, { applicationId, decision: "reject", offerExpiresAt: null });
      expect(taken.ok).toBe(true);
      const [rejected] = await claim(event.id);
      expect(rejected.kind).toBe("rejected");
      await completeApplicationEmail(db, rejected.deliveryId, { sent: true });
      expect(await claim(event.id)).toEqual([]);
    }));

  it("skips canceled and unpublished events, deleted applicants and ticket holders", () =>
    withFixtures(async (fixtures) => {
      const canceled = await applicationEvent(fixtures);
      await applyAs(fixtures, canceled.id, "rejected");
      const { error: cancelError } = await db
        .from("events")
        .update({ canceled_at: new Date().toISOString() })
        .eq("id", canceled.id);
      if (cancelError) throw cancelError;
      expect(await claim(canceled.id)).toEqual([]);

      const unpublished = await applicationEvent(fixtures);
      await applyAs(fixtures, unpublished.id, "waitlisted");
      const { error: draftError } = await db
        .from("events")
        .update({ status: "draft" })
        .eq("id", unpublished.id);
      if (draftError) throw draftError;
      expect(await claim(unpublished.id)).toEqual([]);

      const event = await applicationEvent(fixtures);
      const deleted = await applyAs(fixtures, event.id, "rejected");
      const { error: deleteError } = await db
        .from("user_info")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deleted.member.id);
      if (deleteError) throw deleteError;
      const registered = await applyAs(fixtures, event.id, "accepted");
      const { error: ticketError } = await db
        .from("event_tickets")
        .insert({ event_id: event.id, user_id: registered.member.id });
      if (ticketError) throw ticketError;
      expect(await claim(event.id)).toEqual([]);
    }));

  it("never claims an email recorded as sent, as the backfill records them", () =>
    withFixtures(async (fixtures) => {
      const event = await applicationEvent(fixtures);
      await applyAs(fixtures, event.id, "rejected");

      const [first] = await claim(event.id);
      expect(await completeApplicationEmail(db, first.deliveryId, { sent: true })).toBe(1);
      expect(await claim(event.id)).toEqual([]);
      // Completing again is a no-op, not a second send.
      expect(await completeApplicationEmail(db, first.deliveryId, { sent: false, errorCode: "X" })).toBeNull();
      expect(await claim(event.id)).toEqual([]);
    }));

  it("retries a failure up to five attempts, and a release doesn't count", () =>
    withFixtures(async (fixtures) => {
      const event = await applicationEvent(fixtures);
      await applyAs(fixtures, event.id, "waitlisted");

      const [paused] = await claim(event.id);
      expect(await releaseApplicationEmails(db, [paused.deliveryId], "rate_limit_exceeded")).toBe(1);

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const [row] = await claim(event.id);
        expect(row).toMatchObject({ deliveryId: paused.deliveryId, attempts: attempt });
        expect(
          await completeApplicationEmail(db, row.deliveryId, { sent: false, errorCode: "validation_error" })
        ).toBe(attempt);
      }
      expect(await claim(event.id)).toEqual([]);
    }));
});
