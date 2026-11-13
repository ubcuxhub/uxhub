import { describe, expect, it } from "vitest";
import { withFixtures, clientAs, type Fixtures } from "@/test/integration";
import { emptyLocation, type EventDateLocationDraft, type EventDateDraft } from "./lib/event-date-location";
import { fetchEventDateLocationSettings } from "@/lib/supabase-helpers/event-date-locations";
import type { Json } from "@/lib/supabase/database.types";

const config = (): EventDateLocationDraft & { dates: (EventDateDraft & { start_time: string; end_time: string })[] } => ({ automatic: true, audience: "going", location: { ...emptyLocation(), building: "Secret venue", room: "Secret room", address: "Secret address", map_url: "https://example.com/private-map", public_summary: "Vancouver" }, dates: [{ key: "first", session_id: null as string | null, date: "2099-08-01", start: "09:00", end: "17:00", label: "Opening", location: null, start_time: "2099-08-01T16:00:00Z", end_time: "2099-08-02T00:00:00Z" }] });
async function save(f: Fixtures, document = config(), id?: string, revision = 0, status: "draft" | "active" = "draft") {
  return f.supabase.rpc("save_admin_event_atomically", {
    p_event_id: id ?? null!, p_slug: `dates-${f.tag}`, p_expected_image_url: null!,
    p_event: { name: `Dates ${f.tag}`, description: "Test", status, event_type: "regular", max_capacity: 10, regular_price: 0, member_price: 0, _date_location: document, _date_revision: revision } as unknown as Json,
    p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [],
  });
}

describe("event date/location save", () => {
  it("allows publishing and scheduling location settings while attendee views remain deferred", () => withFixtures(async f => {
    const document = config();
    document.dates[0].location = { ...emptyLocation(), type: "online", meeting_url: "https://example.com/workshop", public_summary: "Online" };
    const created = await save(f, document, undefined, 0, "active");
    if (created.error) throw created.error;
    const id = (created.data as { id: string }).id; f.track("events", id);
    const { data: event } = await f.supabase.from("events").select("status").eq("id", id).single();
    expect(event?.status).toBe("active");
    expect((await f.supabase.from("events").update({ status: "draft", publish_at: "2098-08-01T00:00:00Z" }).eq("id", id)).error).toBeNull();
    expect((await fetchEventDateLocationSettings(f.supabase, id))?.document.dates[0].location?.meeting_url).toBe("https://example.com/workshop");
  }));

  it("preserves session and attendance identity, derives the envelope, and rejects stale saves", () => withFixtures(async f => {
    const created = await save(f);
    expect(created.error).toBeNull();
    const result = created.data as { id: string; check_in_session_ids: string[]; date_location_revision: number };
    f.track("events", result.id);
    const sessionId = result.check_in_session_ids[0];
    const user = await f.createUser();
    const { data: ticket, error } = await f.supabase.from("event_tickets").insert({ event_id: result.id, user_id: user.id }).select("id").single();
    if (error) throw error;
    const { data: attendance, error: attendanceError } = await f.supabase.from("check_ins").insert({ ticket_id: ticket.id, check_in_session_id: sessionId }).select("id").single();
    if (attendanceError) throw attendanceError;
    const edited = config(); edited.dates[0].session_id = sessionId; edited.dates[0].end_time = "2099-08-02T01:00:00Z"; edited.dates[0].end = "18:00";
    const updated = await save(f, edited, result.id, 1);
    expect(updated.error).toBeNull();
    expect((updated.data as { check_in_session_ids: string[] }).check_in_session_ids).toEqual([sessionId]);
    expect((await f.supabase.from("check_ins").select("id").eq("id", attendance.id)).data).toHaveLength(1);
    const { data: event } = await f.supabase.from("events").select("starts_at,ends_at,location_building,location_room,location_address,location_address_url").eq("id", result.id).single();
    expect(new Date(event!.ends_at!).toISOString()).toBe("2099-08-02T01:00:00.000Z");
    expect(event).toMatchObject({ location_building: "Vancouver", location_room: null, location_address: null, location_address_url: null });
    expect((await save(f, edited, result.id, 1)).error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
    const admin = await f.createUser({ role_access: "admin" });
    const settings = await fetchEventDateLocationSettings(clientAs(admin), result.id);
    expect(settings?.document.location.room).toBe("Secret room");
    expect(settings?.document.dates[0].session_id).toBe(sessionId);
  }));

  it("keeps editor/private data out of anonymous, member, applicant and ticket-holder reads while admitting staff", () => withFixtures(async f => {
    const created = await save(f); if (created.error) throw created.error;
    const id = (created.data as { id: string }).id; f.track("events", id);
    const basic = await f.createUser(); const applicant = await f.createUser(); const accepted = await f.createUser(); const going = await f.createUser();
    await f.supabase.from("event_applications").insert([{ event_id: id, user_id: applicant.id, status: "submitted" }, { event_id: id, user_id: accepted.id, status: "accepted", offer_expires_at: "2099-08-01T00:00:00Z" }]).throwOnError();
    await f.supabase.from("event_tickets").insert({ event_id: id, user_id: going.id }).throwOnError();
    for (const user of [null, basic, applicant, accepted, going]) {
      const { data, error } = await clientAs(user).from("event_date_location_settings").select("*").eq("event_id", id);
      expect(error === null ? data : []).toEqual([]);
    }
    for (const role of ["admin", "manager"] as const) {
      const staff = await f.createUser({ role_access: role });
      expect(await fetchEventDateLocationSettings(clientAs(staff), id)).not.toBeNull();
      const { error } = await clientAs(staff).from("event_date_location_settings").update({ revision: 99 }).eq("event_id", id);
      expect(error).not.toBeNull();
    }
  }));

  it("enforces mode and committed-capacity locks through direct event writes", () => withFixtures(async f => {
    const event = await f.createEvent({ max_capacity: 10 });
    const ticketHolder = await f.createUser(); const offer = await f.createUser();
    await f.supabase.from("event_tickets").insert({ event_id: event.id, user_id: ticketHolder.id }).throwOnError();
    await f.supabase.from("event_applications").insert({ event_id: event.id, user_id: offer.id, status: "accepted", offer_expires_at: "2099-08-01T00:00:00Z" }).throwOnError();
    expect((await f.supabase.from("events").update({ max_capacity: 1 }).eq("id", event.id)).error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
    expect((await f.supabase.from("events").update({ max_capacity: 2 }).eq("id", event.id)).error).toBeNull();
    expect((await f.supabase.from("events").update({ requires_application: !event.requires_application }).eq("id", event.id)).error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
    expect((await f.supabase.from("events").update({ registration_opens_at: "2099-08-02T00:00:00Z", registration_closes_at: "2099-08-01T00:00:00Z" }).eq("id", event.id)).error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
  }));
  it("persists, edits and resets a whole per-date exception without changing inherited dates", () => withFixtures(async f => {
    const document = config();
    document.dates.push({ ...document.dates[0], key: "second", date: "2099-08-02", start_time: "2099-08-02T16:00:00Z", end_time: "2099-08-03T00:00:00Z", location: { ...emptyLocation(), type: "online", meeting_url: "https://example.com/workshop", public_summary: "Online" } });
    const created = await save(f, document); if (created.error) throw created.error;
    const result = created.data as { id: string; check_in_session_ids: string[] }; f.track("events", result.id);
    document.dates.forEach((row, index) => { row.session_id = result.check_in_session_ids[index]; });
    document.location.building = "Changed default";
    expect((await save(f, document, result.id, 1)).error).toBeNull();
    const stored = await fetchEventDateLocationSettings(f.supabase, result.id);
    expect(stored?.document.dates[0].location).toBeNull();
    expect(stored?.document.dates[1].location?.meeting_url).toBe("https://example.com/workshop");
    document.dates[1].location = null;
    expect((await save(f, document, result.id, 2)).error).toBeNull();
    expect((await fetchEventDateLocationSettings(f.supabase, result.id))?.document.dates[1].location).toBeNull();
    document.dates.pop();
    expect((await save(f, document, result.id, 3)).error).toBeNull();
    expect((await f.supabase.from("check_in_sessions").select("id").eq("event_id", result.id)).data?.map(row => row.id)).toEqual([result.check_in_session_ids[0]]);
  }));

  it("refuses removal of a started date and rolls back the entire edit", () => withFixtures(async f => {
    const document = config();
    document.dates[0] = { ...document.dates[0], date: "2020-08-01", start_time: "2020-08-01T16:00:00Z", end_time: "2020-08-02T00:00:00Z" };
    document.dates.push({ ...document.dates[0], key: "future", date: "2099-08-02", start_time: "2099-08-02T16:00:00Z", end_time: "2099-08-03T00:00:00Z" });
    const created = await save(f, document); if (created.error) throw created.error;
    const result = created.data as { id: string; check_in_session_ids: string[] }; f.track("events", result.id);
    document.dates = [{ ...document.dates[1], session_id: result.check_in_session_ids[1] }];
    const refused = await save(f, document, result.id, 1);
    expect(refused.error?.message).toMatch(/started event date/);
    expect((await fetchEventDateLocationSettings(f.supabase, result.id))?.revision).toBe(1);
    expect((await f.supabase.from("check_in_sessions").select("id").eq("event_id", result.id)).data).toHaveLength(2);
  }));

  it("serializes capacity reduction with reservation and releases expired held offers", () => withFixtures(async f => {
    const event = await f.createEvent({ max_capacity: 2, status: "active", regular_price: 0, member_price: 0 });
    const user = await f.createUser(); const second = await f.createUser(); const held = await f.createUser();
    await f.supabase.from("event_applications").insert({ event_id: event.id, user_id: held.id, status: "accepted", offer_expires_at: "2020-01-01T00:00:00Z" }).throwOnError();
    const [edit, reservation, secondReservation] = await Promise.all([
      f.supabase.from("events").update({ max_capacity: 1 }).eq("id", event.id),
      f.supabase.rpc("reserve_event_ticket", { p_event_id: event.id, p_user_id: user.id }),
      f.supabase.rpc("reserve_event_ticket", { p_event_id: event.id, p_user_id: second.id }),
    ]);
    expect(edit.error === null || edit.error.hint === "EVENT_SETTINGS_CONFLICT").toBe(true);
    expect(reservation.error).toBeNull(); expect(secondReservation.error).toBeNull();
    const { data: counts } = await f.supabase.rpc("event_seat_counts", { p_event_ids: [event.id] });
    const current = await f.supabase.from("events").select("max_capacity").eq("id", event.id).single();
    expect(counts?.[0].held_offers).toBe(0);
    expect(counts?.[0].tickets).toBeGreaterThan(0);
    expect(counts![0].tickets).toBeLessThanOrEqual(current.data!.max_capacity!);
  }));

});
