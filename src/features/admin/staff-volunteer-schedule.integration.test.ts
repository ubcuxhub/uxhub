import { describe, expect, it } from "vitest";
import { clientAs, createIntegrationClient, withFixtures } from "@/test/integration";
import { fetchEventContent, fetchStaffVolunteerSchedule } from "@/lib/supabase-helpers/event-content";
import { fetchEventLinks } from "@/lib/supabase-helpers/event-links";
import { fetchEventDraft, saveEventDraft } from "@/lib/supabase-helpers/event-drafts";
import { defaultFormState } from "./components/event-form/event-form-schema";
import { emptyContent, emptyContentEntry, type EventContent, type ResourceLink } from "./lib/event-content";
import type { Json } from "@/lib/supabase/database.types";

const db = createIntegrationClient();
const url = "https://example.test/private-volunteers?token=staff-only";
const invalid = ["http://example.test", "/schedule", "//example.test", "javascript:alert(1)", "data:text/plain,x", "https://", "https://user:pass@example.test", "https://example.test:invalid", "https://example.test:99999", "https://[:::]", "https://999.999.999.999", "https://example.test/a b", "https://example.test\\evil"];
const schedule = (): ResourceLink => ({ id: crypto.randomUUID(), type: "volunteer_schedule", visibility: "staff", label: "Volunteer Schedule", label_edited: true, url });
function save(eventId: string, content: EventContent) {
  return db.rpc("save_admin_event_atomically", { p_event_id: eventId, p_event: { _content: content } as unknown as Json, p_slug: null!, p_expected_image_url: null!, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [] });
}
function content(): EventContent {
  return { ...emptyContent(), sections: [{ key: crypto.randomUUID(), kind: "Judges", title: "Judges", items: [{ ...emptyContentEntry(), name: "Alex" }] }], links: [schedule(), { id: crypto.randomUUID(), type: "slack_workspace", label: "Slack", url: "https://example.test/slack", visibility: "everyone" }] };
}

describe("Volunteer Schedule persistence and privacy", () => {
  it("round-trips order, labels, URLs and removal without changing people or generic resources", () => withFixtures(async f => {
    const event = await f.createEvent(); const doc = content();
    expect((await save(event.id, doc)).error).toBeNull();
    expect((await fetchStaffVolunteerSchedule(db, event.id))?.url).toBe(url);
    expect(await fetchEventContent(db, event.id)).toEqual({ ...doc, revision: 1 });
    expect((await db.from("event_staff_volunteer_schedules").insert({ event_id: event.id, url })).error?.code).toBe("23505");
    const next = await fetchEventContent(db, event.id); next.links[0].url = "https://example.test/revised"; next.links[0].label = "Staff shifts";
    next.links.reverse();
    expect((await save(event.id, next)).error).toBeNull();
    expect((await fetchEventContent(db, event.id)).links).toEqual(next.links);
    const legacy = await fetchEventContent(db, event.id); delete legacy.resources_version;
    legacy.links = legacy.links.filter(link => link.type !== "volunteer_schedule");
    expect((await save(event.id, legacy)).error).toBeNull();
    expect((await fetchStaffVolunteerSchedule(db, event.id))?.url).toBe("https://example.test/revised");
    const removed = await fetchEventContent(db, event.id); removed.links = removed.links.filter(link => link.type !== "volunteer_schedule");
    expect((await save(event.id, removed)).error).toBeNull();
    expect(await fetchStaffVolunteerSchedule(db, event.id)).toBeNull();
    expect(await fetchEventContent(db, event.id)).toEqual({ ...doc, revision: 4, links: [doc.links[1]] });
    expect((await fetchEventLinks(db, event.id)).map(link => link.url)).toEqual([doc.links[1].url]);
  }));

  it("enforces HTTPS, singleton and immutable audience at every database save boundary", () => withFixtures(async f => {
    const event = await f.createEvent();
    for (const unsafe of invalid) {
      expect((await db.from("event_staff_volunteer_schedules").insert({ event_id: event.id, url: unsafe })).error, unsafe).toBeTruthy();
      const doc = { ...emptyContent(), links: [{ ...schedule(), url: unsafe }] };
      expect((await save(event.id, doc)).error?.hint, unsafe).toBe("EVENT_CONTENT_INVALID");
      expect((await db.rpc("validate_event_content", { p_document: doc as unknown as Json, p_draft: true })).error?.hint, unsafe).toBe("EVENT_CONTENT_INVALID");
    }
    for (const links of [[schedule(), schedule()], ...["everyone", "going", "after_event"].map(visibility => [{ ...schedule(), visibility }])]) {
      expect((await save(event.id, { ...emptyContent(), links } as EventContent)).error?.hint).toBe("EVENT_CONTENT_INVALID");
    }
    expect(await fetchStaffVolunteerSchedule(db, event.id)).toBeNull();
  }));

  it("preserves a configured URL across incomplete and older working drafts, and restores explicit removal", () => withFixtures(async f => {
    const event = await f.createEvent(); const doc = content();
    expect((await save(event.id, doc)).error).toBeNull();
    const draft = { version: 1 as const, formState: { ...defaultFormState, content: { ...doc, links: [{ ...doc.links[0], url: "" }], sections: [] } }, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] };
    await saveEventDraft(db, event.id, event.id, 0, draft);
    expect((await fetchEventDraft(db, event.id))?.document.formState.content?.links[0].url).toBe("");
    expect((await fetchStaffVolunteerSchedule(db, event.id))?.url).toBe(url);
    draft.formState.content.links[0].url = "https://example.test/draft-updated";
    await saveEventDraft(db, event.id, event.id, 1, draft);
    expect((await fetchStaffVolunteerSchedule(db, event.id))?.url).toBe("https://example.test/draft-updated");
    delete draft.formState.content.resources_version;
    draft.formState.content.links = [];
    await saveEventDraft(db, event.id, event.id, 2, draft);
    expect((await fetchStaffVolunteerSchedule(db, event.id))?.url).toBe("https://example.test/draft-updated");
    draft.formState.content.resources_version = 2;
    await saveEventDraft(db, event.id, event.id, 3, draft);
    expect(await fetchStaffVolunteerSchedule(db, event.id)).toBeNull();
  }));

  it("keeps historical resource saves compatible, atomic and retry-safe", () => withFixtures(async f => {
    const event = await f.createEvent({ status: "active", starts_at: "2020-01-01T00:00:00Z", ends_at: "2020-01-02T00:00:00Z" });
    // Materialize people and generic resources before editing only resources.
    const doc = content(); expect((await save(event.id, doc)).error).toBeNull();
    const current = await db.from("events").select("revision").eq("id", event.id).single();
    const args = { p_event_id: event.id, p_revision: current.data!.revision, p_links: doc.links as unknown as Json, p_operation_id: crypto.randomUUID(), p_resources_version: 2 };
    const saved = await db.rpc("save_past_event_resources", args); expect(saved.error).toBeNull();
    expect((await db.rpc("save_past_event_resources", args)).data).toEqual(saved.data);
    expect((await db.rpc("save_past_event_resources", { ...args, p_links: [] })).error?.hint).toBe("EVENT_REVISION_CONFLICT");
    const revision = (saved.data as { revision: number }).revision;
    expect((await db.rpc("save_past_event_resources", { ...args, p_revision: revision, p_operation_id: crypto.randomUUID(), p_links: [{ ...doc.links[0], url: "http://example.test" }] })).error?.hint).toBe("EVENT_CONTENT_INVALID");
    const compatible = await db.rpc("save_past_event_resources", { p_event_id: event.id, p_revision: revision, p_links: [doc.links[1]] as unknown as Json, p_operation_id: crypto.randomUUID() });
    expect(compatible.error).toBeNull(); expect((await fetchStaffVolunteerSchedule(db, event.id))?.url).toBe(url);
    expect((await db.rpc("save_past_event_resources", { ...args, p_revision: (compatible.data as { revision: number }).revision, p_operation_id: crypto.randomUUID(), p_links: [] })).error).toBeNull();
    expect(await fetchStaffVolunteerSchedule(db, event.id)).toBeNull();
    expect((await fetchEventContent(db, event.id)).sections).toEqual(doc.sections);
  }));

  it("allows both staff roles to read, denies anonymous/basic/Going/checked-in access and browser mutations", () => withFixtures(async f => {
    const event = await f.createEvent({ status: "active", starts_at: "2020-01-01T00:00:00Z", ends_at: "2020-01-02T00:00:00Z" });
    expect((await save(event.id, content())).error).toBeNull();
    const basic = await f.createUser(); const going = await f.createUser(); const checked = await f.createUser();
    const tickets = await db.from("event_tickets").insert([{ event_id: event.id, user_id: going.id }, { event_id: event.id, user_id: checked.id }]).select(); expect(tickets.error).toBeNull();
    const session = await db.from("check_in_sessions").insert({ event_id: event.id, name: "Past session" }).select().single(); expect(session.error).toBeNull();
    expect((await db.from("check_ins").insert({ ticket_id: tickets.data!.find(t => t.user_id === checked.id)!.id, check_in_session_id: session.data!.id })).error).toBeNull();
    const admin = await f.createUser({ role_access: "admin" }); const manager = await f.createUser({ role_access: "manager" });
    for (const user of [null, basic, going, checked, admin, manager]) {
      const client = clientAs(user); const staff = user === admin || user === manager;
      const result = await client.from("event_staff_volunteer_schedules").select("*").eq("event_id", event.id);
      if (!user) expect(result.error?.code).toBe("42501"); else expect(result.data).toHaveLength(staff ? 1 : 0);
      if (user) expect((await fetchStaffVolunteerSchedule(client, event.id))?.url ?? null).toBe(staff ? url : null);
      expect(JSON.stringify(await fetchEventLinks(client, event.id))).not.toContain(url);
      expect(JSON.stringify((await client.rpc("event_participant_content", { p_event_id: event.id })).data)).not.toContain(url);
      expect((await client.from("event_staff_volunteer_schedules").upsert({ event_id: event.id, url })).error?.code).toBe("42501");
      expect((await client.from("event_staff_volunteer_schedules").update({ url }).eq("event_id", event.id)).error?.code).toBe("42501");
      expect((await client.from("event_staff_volunteer_schedules").delete().eq("event_id", event.id)).error?.code).toBe("42501");
      expect((await client.rpc("save_past_event_resources", { p_event_id: event.id, p_revision: 0, p_links: [schedule()] as unknown as Json, p_operation_id: crypto.randomUUID(), p_resources_version: 2 })).error?.code).toBe("42501");
      expect((await client.rpc("save_admin_event_atomically", { p_event_id: event.id, p_event: {}, p_slug: null!, p_expected_image_url: null!, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [] })).error?.code).toBe("42501");
      expect((await client.from("event_content_settings").select("*").eq("event_id", event.id)).data ?? []).toHaveLength(staff ? 1 : 0);
    }
  }));
});
