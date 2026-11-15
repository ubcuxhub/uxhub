import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { clientAs, withFixtures } from "@/test/integration";
import { fetchEventById, fetchEventBySlug } from "./events";
import { fetchEventDraft, saveEventDraft } from "./event-drafts";
import { defaultFormState } from "@/features/admin/components/event-form/event-form-schema";

function draftDocument(slug: string, edited = true) {
  return {
    version: 1 as const,
    formState: { ...defaultFormState, name: edited ? "UX Research Workshop 2027" : slug.replaceAll("-", " "), page_slug: slug, slug_edited: edited },
    checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [],
  };
}

describe("saved event page URLs", () => {
  it("resolves an existing draft event's URL after Save draft without publishing it", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ status: "draft", slug: `ux-research-workshop-${fixtures.tag}` });
    const staff = await fixtures.createUser({ role_access: "admin" });
    const pageSlug = `ux-research-workshop-two-${fixtures.tag}`;
    const saved = await saveEventDraft(fixtures.supabase, fixtures.track("events", randomUUID()), event.id, 0, {
      version: 1,
      formState: { ...defaultFormState, name: "UX Research Workshop 2027", page_slug: pageSlug, slug_edited: true },
      checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [],
    });
    expect((await fetchEventBySlug(clientAs(staff), pageSlug))?.id).toBe(event.id);
    expect(await fetchEventBySlug(clientAs(staff), event.slug!)).toBeNull();
    expect(await fetchEventBySlug(clientAs(null), pageSlug)).toBeNull();
    expect(saved.document.formState.page_slug).toBe(pageSlug);
    expect(saved.eventRevision).toBeGreaterThan(event.revision);
    expect(await fetchEventById(fixtures.supabase, event.id)).toMatchObject({ slug: pageSlug, configured_slug: pageSlug, name: "UX Research Workshop 2027", status: "draft" });
    expect((await fixtures.supabase.from("event_url_claims").select("slug").eq("event_id", event.id)).data).toEqual([{ slug: pageSlug }]);
    const second = await fixtures.createEvent({ status: "draft" });
    await saveEventDraft(fixtures.supabase, fixtures.track("events", randomUUID()), second.id, 0, draftDocument(event.slug!));
    expect((await fetchEventBySlug(clientAs(staff), event.slug!))?.id).toBe(second.id);
  }));

  it("rejects a manually chosen duplicate and rolls back the document, URL and revision", () => withFixtures(async fixtures => {
    const first = await fixtures.createEvent({ status: "draft", slug: `first-${fixtures.tag}` });
    const second = await fixtures.createEvent({ status: "draft", slug: `second-${fixtures.tag}` });
    const id = fixtures.track("events", randomUUID());
    const saved = await saveEventDraft(fixtures.supabase, id, second.id, 0, draftDocument(second.slug!));
    const before = await fetchEventById(fixtures.supabase, second.id);
    await expect(saveEventDraft(fixtures.supabase, id, second.id, saved.revision, draftDocument(first.slug!))).rejects.toMatchObject({ message: "This page URL is already in use." });
    expect(await fetchEventById(fixtures.supabase, second.id)).toEqual(before);
    expect((await fetchEventDraft(fixtures.supabase, id))?.document).toEqual(saved.document);
  }));

  it("numbers concurrent automatic URLs, keeps retries stable, and returns the saved event revision", () => withFixtures(async fixtures => {
    const events = await Promise.all(["one", "two"].map(prefix => fixtures.createEvent({ status: "draft", slug: `${prefix}-${fixtures.tag}` })));
    const ids = events.map(() => fixtures.track("events", randomUUID()));
    const base = `same-name-${fixtures.tag}`;
    const document = draftDocument(base, false);
    const results = await Promise.all(events.map((event, index) => saveEventDraft(fixtures.supabase, ids[index], event.id, 0, document)));
    expect(results.map(result => result.document.formState.page_slug).sort()).toEqual([base, `${base}-1`].sort());
    for (const [index, result] of results.entries()) {
      const changed = await fixtures.supabase.from("events").update({ name: "An unrelated later edit" }).eq("id", events[index].id);
      expect(changed.error).toBeNull();
      const retry = await saveEventDraft(fixtures.supabase, ids[index], events[index].id, 0, document);
      expect(retry).toEqual(result);
    }
  }));

  it("rolls back a rename when the working document revision is stale", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ status: "draft" });
    const id = fixtures.track("events", randomUUID());
    await saveEventDraft(fixtures.supabase, id, event.id, 0, draftDocument(event.slug!));
    const before = await fetchEventById(fixtures.supabase, event.id);
    const next = `stale-${fixtures.tag}`;
    await expect(saveEventDraft(fixtures.supabase, id, event.id, 0, draftDocument(next))).rejects.toThrow(/another tab/);
    expect(await fetchEventById(fixtures.supabase, event.id)).toEqual(before);
    expect(await fetchEventBySlug(fixtures.supabase, next)).toBeNull();
  }));

  it("keeps the URL locked after first publication even when the event returns to draft", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ status: "active" });
    expect((await fixtures.supabase.from("events").update({ status: "draft" }).eq("id", event.id)).error).toBeNull();
    await expect(saveEventDraft(fixtures.supabase, fixtures.track("events", randomUUID()), event.id, 0, draftDocument(`forged-${fixtures.tag}`))).rejects.toMatchObject({ message: "The page URL is locked after first publication." });
    expect((await fetchEventBySlug(fixtures.supabase, event.slug!))?.id).toBe(event.id);
  }));

  it.each([false, true])("uses only the saved page URL after publication (manually edited: %s)", edited => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ status: "draft" });
    const pageSlug = `renamed-${fixtures.tag}`;
    const saved = await fixtures.supabase.rpc("save_admin_event_builder", {
      p_event_id: event.id,
      p_event: { name: `Renamed ${fixtures.tag}`, configured_slug: pageSlug, configured_slug_edited: edited },
      p_draft_id: null!, p_draft_revision: 0, p_slug: null!,
      p_expected_image_url: null!, p_expected_header_image_url: null!,
      p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [],
    });
    expect(saved.error).toBeNull();
    expect(saved.data).toMatchObject({ page_slug: pageSlug });
    const publicClient = clientAs(null);
    expect(await fetchEventBySlug(publicClient, pageSlug)).toBeNull();
    expect(await fetchEventBySlug(fixtures.supabase, pageSlug, { status: "active" })).toBeNull();
    const published = await fixtures.supabase.from("events").update({ status: "active" }).eq("id", event.id);
    expect(published.error).toBeNull();

    expect((await fetchEventBySlug(publicClient, pageSlug, { status: "active" }))?.id).toBe(event.id);
    expect(await fetchEventBySlug(publicClient, event.slug!, { status: "active" })).toBeNull();
  }));
});
