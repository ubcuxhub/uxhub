import { defaultFormState } from "./components/event-form/event-form-schema";
import { saveEventDraft, fetchEventDraft, eventImageIsReferenced } from "@/lib/supabase-helpers/event-drafts";
import { describe, expect, it } from "vitest";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";
import { emptyContent, emptyContentEntry, type EventContent } from "./lib/event-content";
import { fetchEventContent } from "@/lib/supabase-helpers/event-content";
import { fetchEventLinks } from "@/lib/supabase-helpers/event-links";
import { searchMentors, fetchEventMentors } from "@/lib/supabase-helpers/event-people";
import type { Json } from "@/lib/supabase/database.types";
const db = createIntegrationClient();
async function save(eventId: string, content: EventContent) {
  return db.rpc("save_admin_event_atomically", { p_event_id: eventId, p_event: { _content: content } as unknown as Json, p_slug: null!, p_expected_image_url: null!, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [] });
}
function document(): EventContent {
  return { ...emptyContent(), sections: [{ key: crypto.randomUUID(), kind: "Judges", title: "Judges", items: [{ ...emptyContentEntry(), name: "Alex" }] }], links: [{ id: crypto.randomUUID(), type: "participant_package", label: "Package", url: "https://example.test/package", visibility: "going" }] };
}
async function sharedPerson(fixtures: Fixtures) {
  const { data, error } = await db.from("mentors").insert({ full_name: `Directory ${fixtures.tag}`, position: "Designer" }).select().single();
  if (error) throw error;
  fixtures.track("mentors", data.id);
  return data;
}
describe("atomic people and resource editor", () => {
  it("round-trips ordered sections, entries, resources and rejects stale saves atomically", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent(); const doc = document();
    const result = await save(event.id, doc); expect(result.error).toBeNull();
    const first = await fetchEventContent(db, event.id); expect(first).toEqual({ ...doc, revision: 1 });
    expect(await fetchEventMentors(db, event.id)).toEqual([]);
    first.sections.push({ key: crypto.randomUUID(), kind: "Sponsors", title: "Sponsors", items: [{ ...emptyContentEntry(), name: "Harvest", description: "Food sponsor", url: "https://example.test/sponsor" }] });
    first.sections.push({ key: crypto.randomUUID(), kind: "Mentors", title: "Mentors", items: [{ ...emptyContentEntry(), name: "Visible mentor" }] });
    first.sections.reverse();
    expect((await save(event.id, first)).error).toBeNull();
    const saved = await fetchEventContent(db, event.id); expect(saved.sections.map(section => section.title)).toEqual(["Mentors", "Sponsors", "Judges"]);
    expect(saved.sections[2].items[0].key).toBe(doc.sections[0].items[0].key);
    expect((await fetchEventMentors(db, event.id)).map(row => row.full_name)).toEqual(["Visible mentor"]);
    expect((await save(event.id, first)).error?.hint).toBe("EVENT_CONTENT_INVALID");
    expect((await fetchEventContent(db, event.id)).revision).toBe(2);
  }));
  it("reuses directory associations until edited and never mutates another event or shared record", () => withFixtures(async fixtures => {
    const person = await sharedPerson(fixtures);
    const one = await fixtures.createEvent({ slug: `one-${fixtures.tag}` }); const two = await fixtures.createEvent({ slug: `two-${fixtures.tag}` });
    const doc = document(); doc.sections[0].items[0] = { ...emptyContentEntry(), directory_id: person.id, name: person.full_name, position: "Designer" };
    expect((await save(one.id, doc)).error).toBeNull();
    const other = document(); other.sections[0].items[0] = { ...doc.sections[0].items[0], key: crypto.randomUUID() };
    expect((await save(two.id, other)).error).toBeNull();
    const revised = await fetchEventContent(db, one.id); revised.sections[0].items[0].name = "Event-only Alex";
    expect((await save(one.id, revised)).error).toBeNull();
    expect((await db.from("mentors").select("full_name").eq("id", person.id).single()).data?.full_name).toBe(person.full_name);
    expect((await db.from("event_mentors").select("mentor_id").eq("event_id", two.id)).data?.[0].mentor_id).toBe(person.id);
    expect((await searchMentors(db, "Event-only Alex"))).toEqual([]);
    revised.revision = 2; revised.sections[0].items[0].name = person.full_name;
    expect((await save(one.id, revised)).error).toBeNull();
    expect((await db.from("event_mentors").select("mentor_id").eq("event_id", one.id)).data?.[0].mentor_id).toBe(revised.sections[0].items[0].key);
    revised.revision = 3; revised.sections = [];
    expect((await save(one.id, revised)).error).toBeNull();
    expect((await db.from("mentors").select("id").eq("id", person.id)).data).toHaveLength(1);
  }));
  it("keeps shared sponsor fields unchanged and preserves its event-owned copy after a revert", () => withFixtures(async fixtures => {
    const { data: sponsor, error } = await db.from("sponsors").insert({ name: `Shared ${fixtures.tag}`, description: "Food sponsor", website_url: "https://example.test" }).select().single();
    if (error) throw error; fixtures.track("sponsors", sponsor.id);
    const event = await fixtures.createEvent(); const doc = document();
    const entry = { ...emptyContentEntry(), directory_id: sponsor.id, name: sponsor.name, description: sponsor.description!, url: sponsor.website_url! };
    doc.sections = [{ key: crypto.randomUUID(), kind: "Sponsors", title: "Sponsors", items: [entry] }];
    expect((await save(event.id, doc)).error).toBeNull();
    expect((await db.from("event_sponsors").select("sponsor_id").eq("event_id", event.id)).data?.[0].sponsor_id).toBe(sponsor.id);
    doc.revision = 1; entry.description = "Event-specific sponsor";
    expect((await save(event.id, doc)).error).toBeNull();
    expect((await db.from("sponsors").select("description").eq("id", sponsor.id).single()).data?.description).toBe("Food sponsor");
    doc.revision = 2; entry.description = "Food sponsor";
    expect((await save(event.id, doc)).error).toBeNull();
    expect((await db.from("event_sponsors").select("sponsor_id").eq("event_id", event.id)).data?.[0].sponsor_id).toBe(entry.key);
  }));
  it("allows only one simultaneous save for a revision", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent();
    const doc = document();
    const results = await Promise.all([save(event.id, doc), save(event.id, doc)]);
    expect(results.filter(result => !result.error)).toHaveLength(1);
    expect(results.filter(result => result.error?.hint === "EVENT_CONTENT_INVALID")).toHaveLength(1);
  }));
  it("rejects empty sections and unsafe URLs even via direct database saves; allows incomplete links only in working drafts", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent(); const doc = document(); doc.sections[0].items = [];
    expect((await save(event.id, doc)).error?.hint).toBe("EVENT_CONTENT_INVALID");
    expect((await db.rpc("validate_event_content", { p_document: doc as unknown as Json, p_draft: true })).error?.hint).toBe("EVENT_CONTENT_INVALID");
    const unsafe = document(); unsafe.links[0].url = "javascript:alert(1)";
    expect((await save(event.id, unsafe)).error?.hint).toBe("EVENT_CONTENT_INVALID");
    unsafe.links[0].url = "";
    expect((await db.rpc("validate_event_content", { p_document: unsafe as unknown as Json, p_draft: true })).error).toBeNull();
    expect((await save(event.id, unsafe)).error?.hint).toBe("EVENT_CONTENT_INVALID");
  }));
  it("restores incomplete working content, protects image references and rejects empty sections through direct draft writes", () => withFixtures(async fixtures => {
    const id = fixtures.track("admin_event_drafts", crypto.randomUUID());
    const content = document();
    content.sections[0].items[0].name = "";
    content.sections[0].items[0].image_url = "https://example.test/entry.png";
    content.links[0].url = "";
    const draft = { version: 1 as const, formState: { ...defaultFormState, content }, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] };
    await saveEventDraft(db, id, null, 0, draft);
    expect((await fetchEventDraft(db, id))?.document.formState.content).toEqual(content);
    expect(await eventImageIsReferenced(db, "https://example.test/entry.png")).toBe(true);
    content.sections[0].items = [];
    const refused = await db.rpc("save_admin_event_draft", { p_id: id, p_event_id: null!, p_revision: 1, p_document: draft as unknown as Json });
    expect(refused.error?.hint).toBe("EVENT_CONTENT_INVALID");
    expect((await fetchEventDraft(db, id))?.revision).toBe(1);
  }));
  it("keeps editor state staff-only, denies browser writes and preserves Going/staff resource access after the event", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ status: "active", starts_at: "2020-01-01T00:00:00Z", ends_at: "2020-01-02T00:00:00Z" });
    const doc = document(); expect((await save(event.id, doc)).error).toBeNull();
    const member = await fixtures.createUser(); const viewer = clientAs(member); const anon = clientAs(null);
    expect((await viewer.from("event_content_settings").select("*").eq("event_id", event.id)).data).toEqual([]);
    const staff = await fixtures.createUser({ role_access: "admin" });
    expect((await clientAs(staff).from("event_content_settings").select("event_id").eq("event_id", event.id)).data).toHaveLength(1);
    expect((await viewer.from("event_content_settings").insert({ event_id: event.id, document: {} })).error).toBeTruthy();
    expect((await viewer.rpc("save_admin_event_atomically", { p_event_id: event.id, p_event: {}, p_slug: null!, p_expected_image_url: null!, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [] })).error).toBeTruthy();
    expect(await fetchEventLinks(anon, event.id)).toEqual([]); expect(await fetchEventLinks(viewer, event.id)).toEqual([]);
    const { error } = await db.from("event_tickets").insert({ event_id: event.id, user_id: member.id }); if (error) throw error;
    expect(await fetchEventLinks(viewer, event.id)).toHaveLength(1);
    doc.revision = 1; doc.links[0].url = "https://example.test/revised";
    expect((await save(event.id, doc)).error).toBeNull();
    expect((await db.from("events").select("starts_at, ends_at").eq("id", event.id).single()).data?.ends_at).toBe("2020-01-02T00:00:00+00:00");
  }));
});
