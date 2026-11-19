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

  it.each(["ended", "canceled"] as const)("keeps %s resource saves compatible, atomic and retry-safe", state => withFixtures(async f => {
    const event = await f.createEvent({ status: "active", starts_at: state === "ended" ? "2020-01-01T00:00:00Z" : "2099-01-01T00:00:00Z", ends_at: state === "ended" ? "2020-01-02T00:00:00Z" : "2099-01-02T00:00:00Z" });
    // Materialize people and generic resources before editing only resources.
    const doc = content(); expect((await save(event.id, doc)).error).toBeNull();
    if (state === "canceled") {
      const canceled = await db.rpc("cancel_admin_event", { p_event_id: event.id, p_note: "Canceled", p_operation_id: f.track("admin_event_mutations", crypto.randomUUID()) });
      expect(canceled.error).toBeNull();
    }
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

describe("Staff agenda initial schedule creation", () => {
  const create = (eventId: string, resourceUrl = url, operationId = crypto.randomUUID()) => db.rpc("create_staff_volunteer_schedule", { p_event_id: eventId, p_url: resourceUrl, p_operation_id: operationId });

  for (const state of ["draft", "active", "past"] as const) it(`preserves unrelated content and invalidates stale full saves for ${state} events`, () => withFixtures(async f => {
    const event = await f.createEvent({ status: state === "draft" ? "draft" : "active", ...(state === "past" ? { starts_at: "2020-01-01T00:00:00Z", ends_at: "2020-01-02T00:00:00Z" } : {}) });
    const doc = content(); doc.links = doc.links.filter(link => link.type !== "volunteer_schedule");
    expect((await save(event.id, doc)).error).toBeNull();
    const before = (await db.from("events").select("*").eq("id", event.id).single()).data!;
    const saved = await create(event.id); expect(saved.error).toBeNull();
    const after = (await db.from("events").select("*").eq("id", event.id).single()).data!;
    expect(after.revision).toBe(before.revision + 1);
    expect({ ...after, revision: before.revision, updated_at: before.updated_at }).toEqual(before);
    const next = await fetchEventContent(db, event.id);
    expect(next.sections).toEqual(doc.sections);
    expect(next.links.filter(link => link.type !== "volunteer_schedule")).toEqual(doc.links);
    expect(next.links.at(-1)).toMatchObject({ type: "volunteer_schedule", url });
    expect(next.revision).toBe(2);
    expect((await fetchEventLinks(db, event.id)).map(link => link.url)).toEqual(doc.links.map(link => link.url));
    expect((await save(event.id, { ...doc, revision: 1 })).error?.hint).toBe("EVENT_CONTENT_INVALID");
    expect((await fetchStaffVolunteerSchedule(db, event.id))?.url).toBe(url);
  }));

  it("updates working content and compatibility mirrors without losing incomplete input, and rejects stale draft saves", () => withFixtures(async f => {
    const event = await f.createEvent({ status: "draft" });
    const doc = content(); doc.links[0].url = "";
    const draft = { version: 1 as const, formState: { ...defaultFormState, name: "Unfinished title", description: "Unsaved description", content: doc }, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] };
    const original = await saveEventDraft(db, event.id, event.id, 0, draft);
    expect(await fetchStaffVolunteerSchedule(db, event.id)).toBeNull();
    expect((await create(event.id)).error).toBeNull();
    const next = (await fetchEventDraft(db, event.id))!;
    expect(next.revision).toBe(original.revision + 1);
    expect(next.event_revision).toBe(original.eventRevision! + 1);
    expect(next.document.formState.content!.sections).toEqual(doc.sections);
    expect(next.document.formState.content!.links.filter(link => link.type !== "volunteer_schedule")).toEqual(doc.links.filter(link => link.type !== "volunteer_schedule"));
    expect(next.document.formState.content!.links.at(-1)).toMatchObject({ url, type: "volunteer_schedule", visibility: "staff" });
    expect({ ...next.document, formState: { ...next.document.formState, content: doc } }).toEqual(original.document);
    const mirror = await db.from("admin_event_drafts").select("document,revision,event_revision").eq("event_id", event.id).eq("materialized", false).single();
    expect(mirror.error).toBeNull();
    expect(mirror.data).toEqual({ document: next.document, revision: next.revision, event_revision: next.event_revision });
    await expect(saveEventDraft(db, event.id, event.id, original.revision, draft, original.eventRevision)).rejects.toThrow("changed in another tab");
    // Reloading and saving the current draft retains the created resource.
    await saveEventDraft(db, event.id, event.id, next.revision, next.document, next.event_revision);
    expect((await fetchStaffVolunteerSchedule(db, event.id))?.url).toBe(url);
  }));

  it("retains legacy null working content and generic rows for the existing recovery adapter", () => withFixtures(async f => {
    const event = await f.createEvent({ status: "draft" });
    const doc = { ...emptyContent(), links: [content().links[1]] };
    expect((await save(event.id, doc)).error).toBeNull();
    const draft = { version: 1 as const, formState: { ...defaultFormState, content: null }, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] };
    await saveEventDraft(db, event.id, event.id, 0, draft);
    expect((await create(event.id)).error).toBeNull();
    expect((await fetchEventDraft(db, event.id))!.document.formState.content).toBeNull();
    const next = await fetchEventContent(db, event.id);
    expect(next.links[0]).toEqual(doc.links[0]);
    expect(next.links[1]).toMatchObject({ url });
  }));

  it("serializes simultaneous creation and receipts retries without changing the winner", () => withFixtures(async f => {
    const event = await f.createEvent();
    const attempts = [url, "https://example.test/second"].map(p_url => ({ p_event_id: event.id, p_url, p_operation_id: crypto.randomUUID() }));
    const results = await Promise.all(attempts.map(args => db.rpc("create_staff_volunteer_schedule", args)));
    const winner = results.findIndex(result => !result.error);
    expect(results.filter(result => !result.error)).toHaveLength(1);
    expect(results[1 - winner].error?.hint).toBe("STAFF_SCHEDULE_EXISTS");
    const revision = (await db.from("events").select("revision").eq("id", event.id).single()).data!.revision;
    expect((await db.rpc("create_staff_volunteer_schedule", attempts[winner])).data).toEqual(results[winner].data);
    expect((await db.rpc("create_staff_volunteer_schedule", { ...attempts[winner], p_url: "https://example.test/different" })).error?.hint).toBe("EVENT_REVISION_CONFLICT");
    expect((await db.from("events").select("revision").eq("id", event.id).single()).data!.revision).toBe(revision);
    expect((await fetchStaffVolunteerSchedule(db, event.id))?.url).toBe(attempts[winner].p_url);
  }));

  it("validates HTTPS and restricts creation to guarded server operations, including staff browsers", () => withFixtures(async f => {
    const event = await f.createEvent();
    for (const unsafe of invalid) expect((await create(event.id, unsafe)).error?.hint).toBe("EVENT_CONTENT_INVALID");
    expect(await fetchStaffVolunteerSchedule(db, event.id)).toBeNull();
    const basic = await f.createUser(); const admin = await f.createUser({ role_access: "admin" }); const manager = await f.createUser({ role_access: "manager" });
    for (const user of [null, basic, admin, manager]) {
      expect((await clientAs(user).rpc("create_staff_volunteer_schedule", { p_event_id: event.id, p_url: url, p_operation_id: crypto.randomUUID() })).error?.code).toBe("42501");
    }
  }));
});
