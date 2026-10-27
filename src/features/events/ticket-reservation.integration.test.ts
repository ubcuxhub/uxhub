/**
 * The event_tickets / event_applications schema against the local database:
 * the legacy column sync, reserve_event_ticket, seat counts, application
 * transitions and their RLS. See docs/event-states.md for the rules.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

const db = createIntegrationClient();

type EventInsert = Partial<Database["public"]["Tables"]["events"]["Insert"]>;

const hour = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function openEvent(fixtures: Fixtures, overrides: EventInsert = {}) {
  return fixtures.createEvent({
    status: "active",
    registration_start_time: at(-hour),
    registration_end_time: at(hour),
    ...overrides,
  });
}

async function reserve(eventId: string, userId: string, purchaseId?: string) {
  const { data, error } = await db.rpc("reserve_event_ticket", {
    p_event_id: eventId,
    p_user_id: userId,
    p_purchase_id: purchaseId,
  });
  if (error) throw error;
  return data[0];
}

async function seats(eventId: string) {
  const { data, error } = await db.rpc("event_seat_counts_unfiltered", {
    p_event_ids: [eventId],
  });
  if (error) throw error;
  return data[0];
}

async function apply(
  eventId: string,
  userId: string,
  decision?: { status: Database["public"]["Enums"]["event_application_status"]; offer_expires_at?: string }
) {
  const { data, error } = await db
    .from("event_applications")
    .insert({ event_id: eventId, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  if (!decision) return data;
  const updated = await db
    .from("event_applications")
    .update(decision)
    .eq("id", data.id)
    .select()
    .single();
  if (updated.error) throw updated.error;
  return updated.data;
}

describe("legacy event column sync", () => {
  it("derives the new columns from the legacy ones the deployed code writes", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({
        start_date: "2026-07-02",
        start_time: "18:00:00",
        end_date: null,
        end_time: null,
        registration_start_time: "2026-06-20T07:00:00.000Z",
        registration_end_time: "2026-07-01T07:00:00.000Z",
        applications_enabled: true,
      });

      // 18:00 and end of day in Vancouver (PDT, UTC-7).
      expect(new Date(event.starts_at!).toISOString()).toBe("2026-07-03T01:00:00.000Z");
      expect(new Date(event.ends_at!).toISOString()).toBe("2026-07-03T06:59:59.000Z");
      expect(new Date(event.registration_opens_at!).toISOString()).toBe("2026-06-20T07:00:00.000Z");
      expect(new Date(event.registration_closes_at!).toISOString()).toBe("2026-07-01T07:00:00.000Z");
      expect(event.requires_application).toBe(true);

      const { data: moved } = await db
        .from("events")
        .update({ start_time: "10:00:00", end_time: "12:00:00", applications_enabled: false })
        .eq("id", event.id)
        .select()
        .single();
      expect(new Date(moved!.starts_at!).toISOString()).toBe("2026-07-02T17:00:00.000Z");
      expect(new Date(moved!.ends_at!).toISOString()).toBe("2026-07-02T19:00:00.000Z");
      expect(moved!.requires_application).toBe(false);

      // A writer of the new columns wins over the unchanged legacy ones.
      const { data: direct } = await db
        .from("events")
        .update({ starts_at: "2026-07-05T17:00:00.000Z", ends_at: "2026-07-05T19:00:00.000Z" })
        .eq("id", event.id)
        .select()
        .single();
      expect(new Date(direct!.starts_at!).toISOString()).toBe("2026-07-05T17:00:00.000Z");
    }));
});

describe("reserve_event_ticket", () => {
  it("issues one ticket per person and returns the same one for a retried purchase", () =>
    withFixtures(async (fixtures) => {
      const event = await openEvent(fixtures);
      const user = await fixtures.createUser();
      const { data: purchase, error } = await db
        .from("purchases")
        .insert({
          user_id: user.id,
          kind: "event_ticket",
          status: "pending",
          amount_cents: 1000,
          currency: "CAD",
          event_id: event.id,
          idempotency_key: randomUUID(),
        })
        .select()
        .single();
      if (error) throw error;

      const first = await reserve(event.id, user.id, purchase.id);
      expect(first.failure_reason).toBeNull();
      expect(await reserve(event.id, user.id, purchase.id)).toEqual(first);
      expect(await reserve(event.id, user.id)).toEqual({
        ticket_id: first.ticket_id,
        failure_reason: "ALREADY_REGISTERED",
      });

      const { data: ticket } = await db
        .from("event_tickets")
        .select("qr_token, purchase_id")
        .eq("id", first.ticket_id!)
        .single();
      expect(ticket).toMatchObject({ purchase_id: purchase.id });
      expect(ticket!.qr_token).toMatch(/^[0-9a-f]{32}$/);
    }));

  it("enforces the registration window and capacity", () =>
    withFixtures(async (fixtures) => {
      const [a, b] = [await fixtures.createUser(), await fixtures.createUser()];

      const early = await openEvent(fixtures, {
        slug: `early-${fixtures.tag}`,
        registration_start_time: at(hour),
        registration_end_time: at(2 * hour),
      });
      expect((await reserve(early.id, a.id)).failure_reason).toBe("REGISTRATION_NOT_OPEN");

      const late = await openEvent(fixtures, {
        slug: `late-${fixtures.tag}`,
        registration_start_time: at(-2 * hour),
        registration_end_time: at(-hour),
      });
      expect((await reserve(late.id, a.id)).failure_reason).toBe("REGISTRATION_CLOSED");

      const small = await openEvent(fixtures, { slug: `small-${fixtures.tag}`, max_capacity: 1 });
      expect((await reserve(small.id, a.id)).failure_reason).toBeNull();
      expect((await reserve(small.id, b.id)).failure_reason).toBe("SOLD_OUT");
    }));

  it("keeps drafts and scheduled events for admins and managers", () =>
    withFixtures(async (fixtures) => {
      const member = await fixtures.createUser();
      const manager = await fixtures.createUser({ role_access: "manager" });
      const admin = await fixtures.createUser({ role_access: "admin" });

      const draft = await openEvent(fixtures, { slug: `draft-${fixtures.tag}`, status: "draft" });
      const scheduled = await openEvent(fixtures, {
        slug: `scheduled-${fixtures.tag}`,
        status: "draft",
        publish_at: at(hour),
      });

      for (const event of [draft, scheduled]) {
        expect((await reserve(event.id, member.id)).failure_reason).toBe("EVENT_NOT_ACTIVE");
        expect((await reserve(event.id, manager.id)).failure_reason).toBeNull();
        expect((await reserve(event.id, admin.id)).failure_reason).toBeNull();
      }
    }));

  it("requires an accepted, unexpired offer, whose seat is already held", () =>
    withFixtures(async (fixtures) => {
      const event = await openEvent(fixtures, { applications_enabled: true, max_capacity: 1 });
      const [none, waiting, offered, lapsed] = [
        await fixtures.createUser(),
        await fixtures.createUser(),
        await fixtures.createUser(),
        await fixtures.createUser(),
      ];

      await apply(event.id, waiting.id, { status: "waitlisted" });
      await apply(event.id, offered.id, { status: "accepted", offer_expires_at: at(hour) });
      await apply(event.id, lapsed.id, { status: "accepted", offer_expires_at: at(-hour) });

      expect(await seats(event.id)).toMatchObject({ tickets: 0, held_offers: 1, seats_left: 0 });
      expect((await reserve(event.id, none.id)).failure_reason).toBe("APPLICATION_REQUIRED");
      expect((await reserve(event.id, waiting.id)).failure_reason).toBe("APPLICATION_REQUIRED");
      expect((await reserve(event.id, lapsed.id)).failure_reason).toBe("OFFER_EXPIRED");
      // The one seat is this offer's, so a full event still lets them in.
      expect((await reserve(event.id, offered.id)).failure_reason).toBeNull();
      expect(await seats(event.id)).toMatchObject({ tickets: 1, held_offers: 0, seats_left: 0 });
    }));
});

describe("event_seat_counts", () => {
  it("counts everyone's seats for members, but only on events they can see", () =>
    withFixtures(async (fixtures) => {
      const [member, other] = [await fixtures.createUser(), await fixtures.createUser()];
      const event = await openEvent(fixtures, { max_capacity: 5 });
      const draft = await openEvent(fixtures, { slug: `draft-${fixtures.tag}`, status: "draft" });
      await reserve(event.id, other.id);

      const { data, error } = await clientAs(member).rpc("event_seat_counts", {
        p_event_ids: [event.id, draft.id],
      });
      expect(error).toBeNull();
      expect(data).toEqual([{ event_id: event.id, tickets: 1, held_offers: 0, seats_left: 4 }]);

      const anon = await clientAs(null).rpc("event_seat_counts", { p_event_ids: [draft.id] });
      expect(anon.data).toEqual([]);
    }));
});

describe("event_applications", () => {
  it("allows only the moves in the event states doc", () =>
    withFixtures(async (fixtures) => {
      const event = await openEvent(fixtures, { applications_enabled: true });
      const [a, b, c] = [
        await fixtures.createUser(),
        await fixtures.createUser(),
        await fixtures.createUser(),
      ];
      const move = (id: string, status: Database["public"]["Enums"]["event_application_status"]) =>
        db.from("event_applications").update({ status }).eq("id", id);

      const rejected = await apply(event.id, a.id, { status: "rejected" });
      expect((await move(rejected.id, "accepted")).error?.message).toContain("cannot go from rejected");

      const waitlisted = await apply(event.id, b.id, { status: "waitlisted" });
      expect((await move(waitlisted.id, "submitted")).error).toBeTruthy();

      const accepted = await apply(event.id, c.id, { status: "accepted", offer_expires_at: at(hour) });
      await reserve(event.id, c.id);
      expect((await move(accepted.id, "rejected")).error?.message).toContain("already has a ticket");

      const noDeadline = await db
        .from("event_applications")
        .update({ status: "accepted", offer_expires_at: null })
        .eq("id", waitlisted.id);
      expect(noDeadline.error).toBeTruthy();
    }));

  it("lets members apply only for themselves, to open application events", () =>
    withFixtures(async (fixtures) => {
      const [member, other] = [await fixtures.createUser(), await fixtures.createUser()];
      const event = await openEvent(fixtures, { applications_enabled: true });
      const plain = await openEvent(fixtures, { slug: `plain-${fixtures.tag}` });
      const closed = await openEvent(fixtures, {
        slug: `closed-${fixtures.tag}`,
        applications_enabled: true,
        registration_start_time: at(-2 * hour),
        registration_end_time: at(-hour),
      });
      const client = clientAs(member);
      const insert = (eventId: string, userId = member.id) =>
        client.from("event_applications").insert({ event_id: eventId, user_id: userId });

      expect((await insert(plain.id)).error).toBeTruthy();
      expect((await insert(closed.id)).error).toBeTruthy();
      expect((await insert(event.id, other.id)).error).toBeTruthy();
      expect(
        (await client
          .from("event_applications")
          .insert({ event_id: event.id, user_id: member.id, status: "accepted" })).error
      ).toBeTruthy();
      expect((await insert(event.id)).error).toBeNull();

      const { data: own } = await client.from("event_applications").select("status");
      expect(own).toEqual([{ status: "submitted" }]);
      const decided = await client
        .from("event_applications")
        .update({ status: "accepted", offer_expires_at: at(hour) })
        .eq("user_id", member.id)
        .select();
      expect(decided.data).toEqual([]);
    }));

  it("shows members only their own tickets", () =>
    withFixtures(async (fixtures) => {
      const [member, other] = [await fixtures.createUser(), await fixtures.createUser()];
      const event = await openEvent(fixtures);
      await reserve(event.id, member.id);
      await reserve(event.id, other.id);

      const { data } = await clientAs(member).from("event_tickets").select("user_id").eq("event_id", event.id);
      expect(data).toEqual([{ user_id: member.id }]);
      const anon = await clientAs(null).from("event_tickets").select("id").eq("event_id", event.id);
      expect(anon.data ?? []).toEqual([]);
    }));
});
