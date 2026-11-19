import { randomUUID } from "node:crypto";
import { saveEventDraft, fetchEventDraft } from "@/lib/supabase-helpers/event-drafts";
import { defaultFormState } from "./components/event-form/event-form-schema";
import type { EventWorkingDocument } from "./lib/event-working-document";
import { describe, expect, it } from "vitest";
import { withFixtures, clientAs, type Fixtures } from "@/test/integration";
import { emptyAgendaDay, emptyAgendaItem, emptyLocation, type EventDateLocationDraft } from "./lib/event-date-location";
import { fetchEventDateLocationSettings } from "@/lib/supabase-helpers/event-date-locations";
import type { Json } from "@/lib/supabase/database.types";

const config = (checkIn = false): EventDateLocationDraft => {
  const day = { ...emptyAgendaDay(), date: "2099-08-01", label: "Workshop day", location: { ...emptyLocation(), building: "Secret venue", address: "Secret address", room: "Secret room", public_summary: "Vancouver" } };
  day.items = [{ ...emptyAgendaItem(day.date), label: "Overnight sprint", start: "23:00", end_date: "2099-08-02", end: "02:00", description: "Bring a laptop", check_in: checkIn }];
  return { version: 2, automatic: true, audience: "going", location: day.location, dates: [day] };
};
async function save(f: Fixtures, document: EventDateLocationDraft, id?: string, revision = 0) {
  return f.supabase.rpc("save_admin_event_atomically", {
    p_event_id: id ?? null!, p_slug: `agenda-${f.tag}`, p_expected_image_url: null!,
    p_event: { name: `Agenda ${f.tag}`, description: "Test", short_description: "Agenda test", status: "active", event_type: "regular", max_capacity: 10, regular_price: 0, member_price: 0, _date_location: document, _date_revision: revision } as unknown as Json,
    p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [],
  });
}

describe("unified agenda atomic save", () => {
  it("publishes nonconsecutive days and overnight items with no check-in, and protects location projections", () => withFixtures(async f => {
    const document = config();
    const extra = { ...emptyAgendaDay(), date: "2099-08-23", label: "Closing", location: { ...document.location }, items: [{ ...emptyAgendaItem("2099-08-23"), label: "Wrap up", start: "09:00", end: "10:00" }] };
    document.dates.push(extra);
    const created = await save(f,document);
    if (created.error) throw created.error;
    const id = (created.data as { id: string }).id; f.track("events",id);
    const event = await f.supabase.from("events").select("starts_at,ends_at,location_building,location_room").eq("id",id).single();
    expect(event.data).toMatchObject({ starts_at: "2099-08-02T06:00:00+00:00", ends_at: "2099-08-23T17:00:00+00:00", location_building: "Vancouver", location_room: null });
    expect((await f.supabase.from("check_in_sessions").select("id").eq("event_id",id)).data).toEqual([]);
    const publicAgenda = await clientAs(null).from("event_agenda_days").select("*,items:event_agenda_items(*)").eq("event_id",id);
    expect(publicAgenda.error).toBeNull();
    expect(JSON.stringify(publicAgenda.data)).not.toContain("Secret");
    const privateRead = await clientAs(null).from("event_date_location_settings").select("*").eq("event_id",id);
    expect(privateRead.error ? [] : privateRead.data).toEqual([]);
    const saved = await fetchEventDateLocationSettings(f.supabase,id);
    expect(saved?.document.dates[0].items![0].end_date).toBe("2099-08-02");
    expect((await save(f,document,id,0)).error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
    const direct = await f.supabase.from("events").update({ starts_at: "2099-08-01T00:00:00Z" }).eq("id",id);
    expect(direct.error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
  }));

  it("preserves attendance identity on edits and guards removal/disable through saves and direct parent writes", () => withFixtures(async f => {
    const document = config(true);
    const created = await save(f,document); if (created.error) throw created.error;
    const result = created.data as { id: string; check_in_session_ids: string[] };
    f.track("events",result.id);
    expect((await f.supabase.from("check_in_sessions").update({ agenda_item_id: null }).eq("id",result.check_in_session_ids[0])).error?.hint).toBe("CHECK_IN_SESSIONS_CONFLICT");
    const user = await f.createUser();
    const ticket = await f.supabase.from("event_tickets").insert({ event_id: result.id, user_id: user.id }).select("id").single();
    if (ticket.error) throw ticket.error;
    const attendance = await f.supabase.from("check_ins").insert({ ticket_id: ticket.data.id, check_in_session_id: result.check_in_session_ids[0] }).select("*").single();
    if (attendance.error) throw attendance.error;
    const item = document.dates[0].items![0]; item.session_id = result.check_in_session_ids[0]; item.label = "Renamed"; item.end = "03:00";
    const updated = await save(f,document,result.id,1); if (updated.error) throw updated.error;
    expect((updated.data as { check_in_session_ids: string[] }).check_in_session_ids).toEqual(result.check_in_session_ids);
    expect((await f.supabase.from("check_ins").select("*").eq("id",attendance.data.id).single()).data).toEqual(attendance.data);
    expect((await fetchEventDateLocationSettings(f.supabase,result.id))?.document.dates[0].items![0].attended).toBe(true);
    item.check_in = false;
    expect((await save(f,document,result.id,2)).error?.hint).toBe("CHECK_IN_SESSIONS_CONFLICT");
    expect((await f.supabase.from("event_agenda_items").update({ check_in: false }).eq("id",item.key)).error?.hint).toBe("CHECK_IN_SESSIONS_CONFLICT");
    expect((await f.supabase.from("event_agenda_items").delete().eq("id",item.key)).error?.hint).toBe("CHECK_IN_SESSIONS_CONFLICT");
    expect((await f.supabase.from("event_agenda_days").delete().eq("id",document.dates[0].key)).error?.hint).toBe("CHECK_IN_SESSIONS_CONFLICT");
    expect((await f.supabase.from("events").delete().eq("id",result.id)).error?.hint).toBe("CHECK_IN_SESSIONS_CONFLICT");
  }));

  it("rejects nonexistent and repeated historical Pacific wall times at the database boundary", () => withFixtures(async f => {
    for (const [date,time] of [["2025-03-09","02:30"],["2025-11-02","01:30"]]) {
      const document = config(); document.dates[0].date = date; document.dates[0].items![0].start = time;
      expect((await save(f,document)).error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
    }
  }));
  it("recovers incomplete working drafts, derives their projection and receipts publication with canonical IDs", () => withFixtures(async f => {
    const id = f.track("events",randomUUID());
    const agenda = config(); agenda.dates[0].items = [];
    const document: EventWorkingDocument = { version: 1, formState: { ...defaultFormState, name: `Draft ${f.tag}`, page_slug: `draft-agenda-${f.tag}`, slug_edited: true, date_location: agenda }, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] };
    const first = await saveEventDraft(f.supabase,id,null,0,document);
    expect((await fetchEventDraft(f.supabase,id))?.document.formState.date_location?.dates[0].items).toEqual([]);
    const complete = config();
    document.formState = { ...first.document.formState, date_location: complete, starts_at: "2000-01-01T00:00", ends_at: "2000-01-02T00:00" };
    const second = await saveEventDraft(f.supabase,id,id,first.revision,document,first.eventRevision);
    const row = await f.supabase.from("events").select("starts_at,ends_at,revision,slug").eq("id",id).single();
    expect(row.data?.starts_at).toBe("2099-08-02T06:00:00+00:00");
    expect(row.data?.ends_at).toBe("2099-08-02T09:00:00+00:00");
    const operation = f.track("admin_event_mutations",randomUUID());
    const args = { p_event_id: id, p_draft_id: id, p_draft_revision: second.revision, p_slug: row.data!.slug, p_expected_image_url: null!, p_expected_header_image_url: null!,
      p_event: { _operation_id: operation, _expected_revision: row.data!.revision, _date_location: complete, _date_revision: 0, name: document.formState.name, short_description: "Draft agenda", description: "Test", status: "active", configured_marketing_mode: "hosted", configured_slug: row.data!.slug, configured_pricing_mode: "free", configured_price: 0, max_capacity: 20, regular_price: 0, member_price: 0 } as unknown as Json, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [] };
    const saved = await f.supabase.rpc("save_admin_event_builder",args);
    if (saved.error) throw saved.error;
    expect((await f.supabase.rpc("save_admin_event_builder",args)).data).toEqual(saved.data);
    expect((await f.supabase.from("event_agenda_items").select("id").eq("id",complete.dates[0].items![0].key)).data).toHaveLength(1);
    expect((await f.supabase.from("events").select("working_document,status").eq("id",id).single()).data).toMatchObject({ working_document: null, status: "active" });
  }));

});
