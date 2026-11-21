import { describe, expect, it } from "vitest";
import { clientAs, withFixtures, type Fixtures } from "@/test/integration";
import { fetchStaffAgenda, saveAgendaNote } from "./event-agenda-notes";
import { fetchEventParticipantContent } from "./event-agenda";

async function setup(f: Fixtures) {
  const event = await f.createEvent({ agenda_enabled: false });
  const admin = clientAs(await f.createUser({ role_access: "admin" }));
  const manager = clientAs(await f.createUser({ role_access: "manager" }));
  const day = await f.supabase.from("event_agenda_days").insert({
    event_id: event.id, date: "2027-12-01", title: "Opening day",
  }).select().single();
  if (day.error) throw day.error;
  const items = await f.supabase.from("event_agenda_items").insert([
    { event_agenda_day_id: day.data.id, title: "Later", start_time: "18:00", end_time: "19:00", starts_at: "2027-12-02T01:00:00Z", ends_at: "2027-12-02T02:00:00Z", description: "Public description", check_in: true },
    { event_agenda_day_id: day.data.id, title: "Earlier", description: "", check_in: false, start_time: "11:00", end_time: "12:00", starts_at: "2027-12-01T18:00:00Z", ends_at: "2027-12-01T19:00:00Z" },
  ]).select();
  if (items.error) throw items.error;
  return { event, admin, manager, item: items.data[0], day: day.data };
}

describe("shared agenda notes", () => {
  it("serializes two first writers and two subsequent writers without silent overwrites", () => withFixtures(async f => {
    const { event, admin, manager, item } = await setup(f);
    const input = { eventId: event.id, itemId: item.id, expectedRevision: 0 };
    const first = await Promise.all([
      saveAgendaNote(admin, { ...input, body: "Operator A" }),
      saveAgendaNote(manager, { ...input, body: "Operator B" }),
    ]);
    expect(first.filter(result => result.ok)).toHaveLength(1);
    expect(first[0].note).toEqual(first[1].note);
    expect(first[0].note.revision).toBe(1);
    const second = await Promise.all([
      saveAgendaNote(admin, { ...input, expectedRevision: 1, body: "Revision A" }),
      saveAgendaNote(manager, { ...input, expectedRevision: 1, body: "Revision B" }),
    ]);
    expect(second.filter(result => result.ok)).toHaveLength(1);
    expect(second[0].note).toEqual(second[1].note);
    expect(second[0].note.revision).toBe(2);
  }));

  it("preserves long text verbatim, allows clearing, and reads staff items with display off", () => withFixtures(async f => {
    const { event, admin, manager, item } = await setup(f);
    const body = `  Staff only\n${"📝 Long notes\n".repeat(12000)}\n `;
    const saved = await saveAgendaNote(admin, { eventId: event.id, itemId: item.id, body, expectedRevision: 0 });
    expect(saved.ok).toBe(true); expect(saved.note.body).toBe(body);
    const days = await fetchStaffAgenda(manager, event.id);
    expect(days[0].items.map(item => item.title)).toEqual(["Earlier", "Later"]);
    expect(days[0].items[1].note).toEqual(saved.note);
    expect((await fetchEventParticipantContent(manager, event.id)).agenda).toEqual([]);
    expect((await f.supabase.from("event_agenda_items").select("description").eq("id", item.id).single()).data?.description).toBe("Public description");
    expect((await saveAgendaNote(manager, { eventId: event.id, itemId: item.id, body: "", expectedRevision: 1 })).note).toEqual({ item_id: item.id, body: "", revision: 2 });
  }));

  it("protects direct reads, RPC writes and public projections for anonymous/basic/Going users", () => withFixtures(async f => {
    const { event, admin, item } = await setup(f);
    const body = "Private agenda instructions";
    await saveAgendaNote(admin, { eventId: event.id, itemId: item.id, body, expectedRevision: 0 });
    const basic = await f.createUser(); const going = await f.createUser();
    expect((await f.supabase.from("event_tickets").insert({ event_id: event.id, user_id: going.id })).error).toBeNull();
    expect((await f.supabase.from("events").update({ status: "active", agenda_enabled: true }).eq("id", event.id)).error).toBeNull();
    for (const user of [null, basic, going]) {
      const client = clientAs(user);
      const read = await client.from("event_agenda_notes").select("*").eq("item_id", item.id);
      if (user) expect(read.data).toEqual([]); else expect(read.error?.code).toBe("42501");
      const write = await client.rpc("save_agenda_note", { p_event_id: event.id, p_item_id: item.id, p_body: "Attacker", p_expected_revision: 1 });
      expect(write.error?.code).toBe("42501");
      expect(JSON.stringify(await fetchEventParticipantContent(client, event.id))).not.toContain(body);
    }
    const direct = await admin.from("event_agenda_notes").update({ body: "Bypass", revision: 2 }).eq("item_id", item.id);
    expect(direct.error?.code).toBe("42501");
  }));

  it("rejects foreign-event targets and keeps notes attached across item edits", () => withFixtures(async f => {
    const { event, admin, item } = await setup(f);
    const foreign = await f.createEvent({ slug: `${f.tag}-other` });
    await expect(saveAgendaNote(admin, { eventId: foreign.id, itemId: item.id, body: "Wrong target", expectedRevision: 0 })).rejects.toMatchObject({ code: "22023" });
    expect((await f.supabase.from("event_agenda_notes").select().eq("item_id", item.id)).data).toEqual([]);
    const saved = await saveAgendaNote(admin, { eventId: event.id, itemId: item.id, body: "Stable note", expectedRevision: 0 });
    expect((await f.supabase.from("event_agenda_items").update({ title: "Renamed", starts_at: "2027-12-02T00:00:00Z" }).eq("id", item.id)).error).toBeNull();
    expect((await fetchStaffAgenda(admin, event.id))[0].items.find(row => row.id === item.id)?.note).toEqual(saved.note);
    expect((await f.supabase.from("event_agenda_items").delete().eq("id", item.id)).error).toBeNull();
    expect((await f.supabase.from("event_agenda_notes").select().eq("item_id", item.id)).data).toEqual([]);
  }));
});
