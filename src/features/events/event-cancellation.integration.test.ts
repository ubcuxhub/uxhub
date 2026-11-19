/**
 * The unpublish guard and event cancellation against the local database
 * (docs/event-states.md, "Unpublishing" and "Canceled events").
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { clientAs, withFixtures, type Fixtures } from "@/test/integration";
import type { EventRow } from "@/lib/supabase/models";
import { mutateItemCheckIn } from "@/lib/supabase-helpers/item-check-in";
import { createTeam, joinTeam } from "@/lib/supabase-helpers/teams";
import { cancelEvent, fetchEventLifecycleCounts } from "@/lib/supabase-helpers/event-lifecycle";

const day = 24 * 60 * 60 * 1000;
const at = (offset: number) => new Date(Date.now() + offset).toISOString();
const upcoming = { status: "active" as const, starts_at: at(7 * day), ends_at: at(7 * day + 2 * 60 * 60 * 1000) };

function revert(f: Fixtures, event: EventRow) {
  return f.supabase.rpc("update_admin_event_schedule", {
    p_event_id: event.id,
    p_patch: { status: "draft", starts_at: event.starts_at, ends_at: event.ends_at },
  });
}

function cancel(f: Fixtures, eventId: string, note: string | null = null, operationId = randomUUID()) {
  f.track("admin_event_mutations", operationId);
  return f.supabase.rpc("cancel_admin_event", { p_event_id: eventId, p_note: note ?? "", p_operation_id: operationId });
}

async function ticket(f: Fixtures, eventId: string, userId: string) {
  const { data, error } = await f.supabase.from("event_tickets").insert({ event_id: eventId, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}

describe("reverting to draft", () => {
  it("is refused while a member holds a ticket, through every write path", () => withFixtures(async f => {
    const event = await f.createEvent(upcoming);
    const member = await f.createUser();
    await ticket(f, event.id, member.id);

    const overview = await revert(f, event);
    expect(overview.error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
    expect(overview.error?.message).toBe("1 person is registered. Cancel the event instead.");
    const admin = await f.createUser({ role_access: "admin" });
    const direct = await clientAs(admin).from("events").update({ status: "draft" }).eq("id", event.id);
    expect(direct.error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
    expect((await f.supabase.from("events").update({ status: "draft" }).eq("id", event.id)).error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
    expect((await f.supabase.from("events").select("status").eq("id", event.id).single()).data?.status).toBe("active");
  }));

  it("counts held offers and payments in flight as registered", () => withFixtures(async f => {
    const offered = await f.createEvent({ ...upcoming, requires_application: true, slug: `offer-${f.tag}` });
    const paying = await f.createEvent({ ...upcoming, slug: `paying-${f.tag}` });
    const member = await f.createUser();
    expect((await f.supabase.from("event_applications").insert({ event_id: offered.id, user_id: member.id, status: "accepted", offer_expires_at: at(day) })).error).toBeNull();
    expect((await f.supabase.from("purchases").insert({ event_id: paying.id, user_id: member.id, kind: "event_ticket", status: "pending", amount_cents: 1000, currency: "CAD", idempotency_key: `${f.tag}-pending` })).error).toBeNull();
    for (const event of [offered, paying]) expect((await revert(f, event)).error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
  }));

  it("is allowed with staff test tickets only, and counts the applications that lose access", () => withFixtures(async f => {
    const event = await f.createEvent({ ...upcoming, requires_application: true });
    const staff = await f.createUser({ role_access: "manager" });
    await ticket(f, event.id, staff.id);
    for (const status of ["draft", "submitted", "waitlisted", "rejected"] as const) {
      const applicant = await f.createUser();
      expect((await f.supabase.from("event_applications").insert({ event_id: event.id, user_id: applicant.id, status })).error).toBeNull();
    }
    expect(await fetchEventLifecycleCounts(f.supabase, event.id)).toEqual({ registered: 0, memberApplications: 3, paidTickets: 0 });
    const reverted = await revert(f, event);
    expect(reverted.error).toBeNull();
    expect((await f.supabase.from("events").select("status").eq("id", event.id).single()).data?.status).toBe("draft");
  }));
});

describe("canceling", () => {
  it("is refused on a draft, an ended event or a canceled one", () => withFixtures(async f => {
    const draft = await f.createEvent({ status: "draft", slug: `draft-${f.tag}` });
    const ended = await f.createEvent({ status: "active", starts_at: at(-2 * day), ends_at: at(-day), slug: `ended-${f.tag}` });
    expect((await cancel(f, draft.id)).error?.hint).toBe("EVENT_CANCEL_REFUSED");
    expect((await cancel(f, ended.id)).error?.hint).toBe("EVENT_CANCEL_REFUSED");
    const live = await f.createEvent({ ...upcoming, slug: `live-${f.tag}` });
    expect((await cancel(f, live.id)).error).toBeNull();
    expect((await cancel(f, live.id)).error?.message).toBe("This event is already canceled.");
  }));

  it("is staff-only and returns the first result on a retry", () => withFixtures(async f => {
    const event = await f.createEvent(upcoming);
    const operation = randomUUID();
    f.track("admin_event_mutations", operation);
    for (const client of [clientAs(null), clientAs(await f.createUser()), clientAs(await f.createUser({ role_access: "admin" }))]) {
      expect((await client.rpc("cancel_admin_event", { p_event_id: event.id, p_note: "", p_operation_id: operation })).error?.code).toBe("42501");
    }
    const first = await cancelEvent(f.supabase, event.id, "  Moved to January. ", operation);
    expect(first).toMatchObject({ cancellation_note: "Moved to January.", status: "active" });
    expect(first.canceled_at).toBeTruthy();
    expect(await cancelEvent(f.supabase, event.id, "Moved to January.", operation)).toEqual(first);
  }));

  it("keeps tickets and purchases, and the page stays visible to the ticket holder", () => withFixtures(async f => {
    const event = await f.createEvent(upcoming);
    const member = await f.createUser();
    const purchase = await f.supabase.from("purchases").insert({ event_id: event.id, user_id: member.id, kind: "event_ticket", status: "completed", amount_cents: 1000, currency: "CAD", idempotency_key: `${f.tag}-paid` }).select().single();
    expect(purchase.error).toBeNull();
    expect((await f.supabase.from("event_tickets").insert({ event_id: event.id, user_id: member.id, purchase_id: purchase.data!.id })).error).toBeNull();
    expect((await fetchEventLifecycleCounts(f.supabase, event.id)).paidTickets).toBe(1);
    expect((await cancel(f, event.id, "Sorry.")).error).toBeNull();

    const asMember = clientAs(member);
    const page = await asMember.from("events").select("id, canceled_at, cancellation_note").eq("id", event.id).maybeSingle();
    expect(page.data).toMatchObject({ id: event.id, cancellation_note: "Sorry." });
    expect(page.data?.canceled_at).toBeTruthy();
    expect((await asMember.from("event_tickets").select("id").eq("event_id", event.id)).data).toHaveLength(1);
    expect((await asMember.from("purchases").select("refunded_cents").eq("id", purchase.data!.id).single()).data?.refunded_cents).toBe(0);
    // It can't be reverted either: the member keeps their ticket's page.
    expect((await revert(f, event)).error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
  }));

  it("can't be undone, even by reverting an event nobody registered for", () => withFixtures(async f => {
    const event = await f.createEvent(upcoming);
    expect((await cancel(f, event.id)).error).toBeNull();
    expect((await revert(f, event)).error?.hint).toBe("EVENT_HISTORY_LOCKED");
    expect((await f.supabase.from("events").update({ canceled_at: null }).eq("id", event.id)).error?.hint).toBe("EVENT_HISTORY_LOCKED");
  }));

  it("refuses registration, applications, team changes and check-in afterwards", () => withFixtures(async f => {
    const event = await f.createEvent({ ...upcoming, teams_enabled: true, max_team_size: 4, team_deadline: at(5 * day) });
    const owner = await f.createUser();
    const joiner = await f.createUser();
    const newcomer = await f.createUser();
    const ownerTicket = await ticket(f, event.id, owner.id);
    await ticket(f, event.id, joiner.id);
    const team = await createTeam(f.supabase, { eventId: event.id, userId: owner.id });
    expect(team.failureReason).toBeNull();
    const { data: teamRow } = await f.supabase.from("teams").select("invite_code").eq("id", team.teamId!).single();
    const staff = clientAs(await f.createUser({ role_access: "admin" }));
    const agendaDay = await f.supabase.from("event_agenda_days").insert({ event_id: event.id, date: "2026-11-24", title: "Day" }).select().single();
    expect(agendaDay.error).toBeNull();
    const item = await f.supabase.from("event_agenda_items").insert({ event_agenda_day_id: agendaDay.data!.id, title: "Door", check_in: true, start_time: "10:00", end_time: "11:00", starts_at: "2026-11-24T18:00:00Z", ends_at: "2026-11-24T19:00:00Z" }).select().single();
    expect(item.error).toBeNull();
    const session = await f.supabase.from("check_in_sessions").insert({ event_id: event.id, agenda_item_id: item.data!.id, name: "Door", start_time: at(-day), end_time: at(day) }).select().single();
    expect(session.error).toBeNull();

    const applicationEvent = await f.createEvent({ ...upcoming, requires_application: true, slug: `apply-${f.tag}` });
    const application = await f.supabase.from("event_applications").insert({ event_id: applicationEvent.id, user_id: newcomer.id, status: "draft" }).select().single();
    expect(application.error).toBeNull();

    expect((await cancel(f, event.id)).error).toBeNull();
    expect((await cancel(f, applicationEvent.id)).error).toBeNull();

    const reserved = await f.supabase.rpc("reserve_event_ticket", { p_event_id: event.id, p_user_id: newcomer.id });
    expect(reserved.data?.[0]).toEqual({ ticket_id: null, failure_reason: "EVENT_CANCELED" });
    const submitted = await clientAs(newcomer).rpc("submit_event_application", { p_application_id: application.data!.id });
    expect(submitted.data?.[0]?.status).toBe("NOT_ACCEPTING_APPLICATIONS");
    expect((await joinTeam(f.supabase, { inviteCode: teamRow!.invite_code, userId: joiner.id })).failureReason).toBe("TEAMS_LOCKED");
    expect((await createTeam(f.supabase, { eventId: event.id, userId: joiner.id })).failureReason).toBe("TEAMS_LOCKED");
    for (const input of [{ ticketId: ownerTicket.id }, { code: ownerTicket.qr_token }]) {
      expect(await mutateItemCheckIn(staff, { eventId: event.id, itemId: item.data!.id, ...input })).toEqual({ status: "rejected", reason: "event_canceled" });
    }
    expect((await f.supabase.from("check_ins").select("id").eq("check_in_session_id", session.data!.id)).data).toEqual([]);
  }));

  it("locks the builder but keeps links and resources editable", () => withFixtures(async f => {
    const event = await f.createEvent(upcoming);
    expect((await cancel(f, event.id)).error).toBeNull();
    const { data: saved } = await f.supabase.from("events").select("*").eq("id", event.id).single();
    const operation = f.track("admin_event_mutations", randomUUID());
    const builder = await f.supabase.rpc("save_admin_event_builder", {
      p_event_id: event.id, p_draft_id: null!, p_draft_revision: 0,
      p_event: { name: "Renamed", status: "active", starts_at: saved!.starts_at, ends_at: saved!.ends_at, _operation_id: operation, _expected_revision: saved!.revision },
      p_slug: null!, p_expected_image_url: null!, p_expected_header_image_url: null!, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [],
    });
    expect(builder.error?.hint).toBe("EVENT_HISTORY_LOCKED");
    const admin = await f.createUser({ role_access: "admin" });
    expect((await clientAs(admin).from("events").update({ name: "Forged" }).eq("id", event.id)).error?.hint).toBe("EVENT_HISTORY_LOCKED");
    expect((await clientAs(admin).from("check_in_sessions").insert({ event_id: event.id, name: "Forged", start_time: saved!.starts_at!, end_time: saved!.ends_at! })).error).not.toBeNull();

    const link = { id: randomUUID(), type: "other", label: "Update", url: "https://example.test/update", visibility: "everyone" };
    const resources = await f.supabase.rpc("save_past_event_resources", {
      p_event_id: event.id, p_revision: saved!.revision, p_links: [link], p_operation_id: f.track("admin_event_mutations", randomUUID()),
    });
    expect(resources.error).toBeNull();
    expect((await f.supabase.from("event_links").select("id").eq("event_id", event.id)).data).toHaveLength(1);
  }));
});
