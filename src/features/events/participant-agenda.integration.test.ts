import { describe, expect, it } from "vitest";
import { withFixtures, clientAs, type Fixtures } from "@/test/integration";
import { emptyAgendaDay, emptyAgendaItem, emptyLocation, type EventDateLocationDraft } from "@/features/admin/lib/event-date-location";
import { fetchEventParticipantContent } from "@/lib/supabase-helpers/event-agenda";
import type { Json } from "@/lib/supabase/database.types";

async function eventWithAgenda(f: Fixtures, audience: "going" | "everyone" = "going", past = false) {
  const date = past ? "2025-02-01" : "2099-08-01";
  const location = { ...emptyLocation(), type: "hybrid" as const, building: "PRIVATE building", room: "PRIVATE room", address: "PRIVATE address", map_url: "https://example.test/PRIVATE-map", meeting_url: "https://example.test/PRIVATE-meeting", meeting_id: "PRIVATE ID", meeting_passcode: "PRIVATE passcode", public_summary: "Vancouver and online" };
  const day = { ...emptyAgendaDay(), date, label: "Studio day", location };
  day.items = [
    { ...emptyAgendaItem(date), label: "Welcome", start: "09:00", end: "10:00", description: "Bring a laptop", check_in: true },
    { ...emptyAgendaItem(date), label: "Physical breakout", start: "10:00", end: "11:00", location: { ...location, type: "in_person" as const, room: "PRIVATE breakout", public_summary: "Campus breakout" } },
    { ...emptyAgendaItem(date), label: "Remote studio", start: "23:00", end_date: past ? "2025-02-02" : "2099-08-02", end: "01:00", location: { ...location, type: "online" as const, public_summary: "Online studio" } },
  ];
  const config: EventDateLocationDraft = { version: 2, automatic: true, audience, location, dates: [day] };
  const saved = await f.supabase.rpc("save_admin_event_atomically", {
    p_event_id: null!, p_slug: `participant-${f.tag}`, p_expected_image_url: null!,
    p_event: { name: f.tag, description: "Test", short_description: "Test", status: "active", agenda_enabled: true, event_type: "regular", max_capacity: 20, regular_price: 0, member_price: 0, _date_location: config, _date_revision: 0 } as unknown as Json,
    p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [],
  });
  if (saved.error) throw saved.error;
  const id = (saved.data as { id: string }).id; f.track("events", id);
  return { id, config };
}

describe("participant agenda viewer projection", () => {
  it.each([false, true])("protects direct responses for every audience, past=%s", past => withFixtures(async f => {
    const { id } = await eventWithAgenda(f, "going", past);
    const outsider = await f.createUser();
    const applicant = await f.createUser();
    const accepted = await f.createUser();
    const holder = await f.createUser();
    const checked = await f.createUser();
    const admin = await f.createUser({ role_access: "admin" });
    const manager = await f.createUser({ role_access: "manager" });
    for (const [user,status] of [[applicant,"submitted"], [accepted,"accepted"]] as const) {
      const result = await f.supabase.from("event_applications").insert({ event_id: id, user_id: user.id, status, offer_expires_at: status === "accepted" ? "2099-09-01T00:00:00Z" : null });
      if (result.error) throw result.error;
    }
    for (const user of [holder, checked]) {
      const ticket = await f.supabase.from("event_tickets").insert({ event_id: id, user_id: user.id }).select("id").single();
      if (ticket.error) throw ticket.error;
      if (user === checked) {
        const session = await f.supabase.from("check_in_sessions").select("id").eq("event_id",id).single();
        if (session.error) throw session.error;
        const attendance = await f.supabase.from("check_ins").insert({ ticket_id: ticket.data.id, check_in_session_id: session.data.id });
        if (attendance.error) throw attendance.error;
      }
    }
    // Deliberately plant unrelated private content in the editor document. The
    // RPC must whitelist fields even for Going viewers, not return the document.
    const settings = await f.supabase.from("event_date_location_settings").select("document").eq("event_id",id).single();
    if (settings.error) throw settings.error;
    const updated = await f.supabase.from("event_date_location_settings").update({ document: { ...settings.data.document as object, staff_notes: "STAFF-ONLY-NOTE", volunteer_url: "https://example.test/STAFF-ONLY-URL" } }).eq("event_id",id);
    if (updated.error) throw updated.error;
    for (const user of [null, outsider, applicant, accepted, holder, checked, admin, manager]) {
      const viewer = clientAs(user);
      const content = await fetchEventParticipantContent(viewer,id);
      const serialized = JSON.stringify(content);
      expect(serialized).not.toContain("STAFF-ONLY");
      const permitted = [holder, checked, admin, manager].includes(user!);
      expect(serialized.includes("PRIVATE")).toBe(permitted);
      expect(content.agenda[0].items.map(item => item.title)).toEqual(["Welcome", "Physical breakout", "Remote studio"]);
      expect(content.agenda[0].items[0].description).toBe("Bring a laptop");
      expect(content.agenda[0].items[0].check_in).toBe(true);
      expect(content.agenda[0].items[2].location?.building).toBeUndefined(); // inactive physical data
      expect(content.agenda[0].items[1].location?.meeting_url).toBeUndefined(); // inactive online data
      if (permitted) {
        expect(content.location?.building).toBe("PRIVATE building");
        expect(content.agenda[0].items[0].location).toEqual(content.location);
        expect(content.agenda[0].items[2].location?.meeting_passcode).toBe("PRIVATE passcode");
      } else {
        expect(content.location).toEqual({ type: "hybrid", restricted: true, public_summary: "Vancouver and online" });
        const raw = await viewer.from("event_agenda_days").select("*,items:event_agenda_items(*)").eq("event_id",id);
        expect(raw.error).toBeNull(); expect(JSON.stringify(raw.data)).not.toContain("PRIVATE");
        const editor = await viewer.from("event_date_location_settings").select("*").eq("event_id",id);
        expect(editor.error ? [] : editor.data).toEqual([]);
      }
    }
    // An eligible read cannot contaminate a subsequent anonymous response.
    expect(JSON.stringify(await fetchEventParticipantContent(clientAs(null),id))).not.toContain("PRIVATE");
  }));

  it("shows everyone locations, projects active types, and restores saved agenda after off/on", () => withFixtures(async f => {
    const { id } = await eventWithAgenda(f,"everyone");
    const publicClient = clientAs(null);
    const before = await fetchEventParticipantContent(publicClient,id);
    expect(before.location?.meeting_url).toContain("PRIVATE-meeting");
    expect(before.agenda[0].items[2].location?.building).toBeUndefined();
    const off = await f.supabase.from("events").update({ agenda_enabled: false }).eq("id",id);
    if (off.error) throw off.error;
    const hidden = await fetchEventParticipantContent(publicClient,id);
    expect(hidden.agenda).toEqual([]); expect(hidden.location).toEqual(before.location);
    expect((await publicClient.from("event_agenda_days").select("id").eq("event_id",id)).data).toEqual([]);
    const staff = await f.createUser({ role_access: "manager" });
    expect((await clientAs(staff).from("event_agenda_days").select("id").eq("event_id",id)).data).toHaveLength(1);
    const on = await f.supabase.from("events").update({ agenda_enabled: true }).eq("id",id);
    if (on.error) throw on.error;
    expect(await fetchEventParticipantContent(publicClient,id)).toEqual(before);
    const draft = await f.supabase.from("events").update({ status: "draft" }).eq("id",id);
    if (draft.error) throw draft.error;
    expect(await fetchEventParticipantContent(publicClient,id)).toEqual({ location: null, agenda: [] });
  }));
});
