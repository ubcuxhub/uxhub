import { describe, expect, it } from "vitest";
import { clientAs, withFixtures, type Fixtures } from "@/test/integration";
import type { Json } from "@/lib/supabase/database.types";
import { fetchEventById } from "@/lib/supabase-helpers/events";

function input(f: Fixtures, eventId: string | null, event: Record<string, unknown>) {
  return { p_event_id: eventId!, p_draft_id: null!, p_draft_revision: 0, p_event: { name: "Publication test", short_description: "Overview", description: "Long overview", status: "draft", publish_at: null, starts_at: "2099-08-02T17:00:00Z", ends_at: "2099-08-02T19:00:00Z", max_capacity: 10, regular_price: 10, member_price: 5, ...event } as Json, p_slug: `publication-${f.tag}`, p_expected_image_url: null!, p_expected_header_image_url: null!, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [] };
}
const future = "2099-08-01T17:00:00Z";

describe("event builder publication", () => {
  it("publishes/schedules/reschedules/cancels atomically while preserving registration dates", () => withFixtures(async f => {
    const event = await f.createEvent({ status: "draft" });
    const read = () => fetchEventById(f.supabase, event.id);
    const opens = "2099-08-01T18:00:00Z";
    const closes = "2099-08-02T16:00:00Z";
    let result = await f.supabase.rpc("save_admin_event_builder", input(f, event.id, { publish_at: future, registration_opens_at: opens, registration_closes_at: closes, _expected_publication: { status: "draft", publish_at: null } }));
    expect(result.error).toBeNull();
    expect(await fetchEventById(clientAs(null), event.id)).toBeNull();
    result = await f.supabase.rpc("save_admin_event_builder", input(f, event.id, { publish_at: "2099-08-01T18:00:00Z", registration_opens_at: opens, registration_closes_at: closes, _expected_publication: { status: "draft", publish_at: future } }));
    expect(result.error).toBeNull();
    result = await f.supabase.rpc("save_admin_event_builder", input(f, event.id, { publish_at: null, registration_opens_at: opens, registration_closes_at: closes, _expected_publication: { status: "draft", publish_at: "2099-08-01T18:00:00Z" } }));
    expect(result.error).toBeNull();
    expect((await read())!.publish_at).toBeNull();
    result = await f.supabase.rpc("save_admin_event_builder", input(f, event.id, { status: "active", registration_opens_at: opens, registration_closes_at: closes, _expected_publication: { status: "draft", publish_at: null } }));
    expect(result.error).toBeNull();
    const saved = (result.data as { publication: { status: string } }).publication;
    expect(saved.status).toBe("active");
    expect(Date.parse((await read())!.registration_opens_at!)).toBe(Date.parse(opens));
    expect(Date.parse((await read())!.registration_closes_at!)).toBe(Date.parse(closes));
  }));
  it("rejects stale save, cancel and reschedule after scheduled activation", () => withFixtures(async f => {
    const event = await f.createEvent({ status: "draft", publish_at: future });
    const activation = await f.supabase.from("events").update({ status: "active", publish_at: null }).eq("id", event.id);
    expect(activation.error).toBeNull();
    for (const publish_at of [null, future, "2099-08-01T18:00:00Z"]) {
      const result = await f.supabase.rpc("save_admin_event_builder", input(f, event.id, { name: "Stale overwrite", publish_at, _expected_publication: { status: "draft", publish_at: future } }));
      expect(result.error?.hint).toBe("EVENT_PUBLICATION_CONFLICT");
      expect((await fetchEventById(f.supabase, event.id))!.status).toBe("active");
      expect((await fetchEventById(f.supabase, event.id))!.name).toBe(event.name);
    }
  }));
  it("enforces conditional descriptions and refuses invalid or unauthorized publication", () => withFixtures(async f => {
    const event = await f.createEvent({ status: "draft" });
    for (const configured_marketing_mode of ["hosted", "external"]) {
      const result = await f.supabase.rpc("save_admin_event_builder", input(f, event.id, { status: "active", description: "", configured_marketing_mode }));
      expect(result.error?.message).toBe("Description is required.");
    }
    let result = await f.supabase.rpc("save_admin_event_builder", input(f, event.id, { publish_at: future, registration_closes_at: future }));
    expect(result.error?.message).toMatch(/before registration closes/);
    result = await f.supabase.rpc("save_admin_event_builder", input(f, event.id, { status: "active", description: "", configured_marketing_mode: "disabled" }));
    expect(result.error).toBeNull();
    for (const client of [clientAs(null), clientAs(await f.createUser())]) {
      const denied = await client.rpc("save_admin_event_builder", input(f, event.id, { name: "Unauthorized", status: "active" }));
      expect(denied.error?.code).toBe("42501");
    }
    expect((await fetchEventById(f.supabase, event.id))!.name).toBe("Publication test");
  }));
});

it("retries materialization without duplication and returns the saved lifecycle", () => withFixtures(async f => {
  const { randomUUID } = await import("node:crypto");
  const { saveEventDraft } = await import("@/lib/supabase-helpers/event-drafts");
  const { defaultFormState } = await import("./components/event-form/event-form-schema");
  const id = f.track("admin_event_drafts", randomUUID());
  const draft = await saveEventDraft(f.supabase, id, null, 0, { version: 1, formState: defaultFormState, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] });
  const args = { ...input(f, null, { status: "active", configured_marketing_mode: "disabled", description: "" }), p_draft_id: id, p_draft_revision: draft.revision };
  const first = await f.supabase.rpc("save_admin_event_builder", args);
  expect(first.error).toBeNull();
  const saved = first.data as { id: string; publication: { status: string } };
  f.track("events", saved.id);
  const replay = await f.supabase.rpc("save_admin_event_builder", args);
  expect(replay.error).toBeNull();
  expect(replay.data).toEqual(first.data);
  expect(saved.publication.status).toBe("active");
}));

it("serializes concurrent builder saves and publisher activation without deadlocks", () => withFixtures(async f => {
  for (let index = 0; index < 4; index++) {
    const event = await f.createEvent({ status: "draft", publish_at: future, slug: `publication-race-${index}-${f.tag}` });
    const [save, activation] = await Promise.all([
      f.supabase.rpc("save_admin_event_builder", input(f, event.id, { publish_at: future, _expected_publication: { status: "draft", publish_at: future } })),
      f.supabase.from("events").update({ status: "active", publish_at: null }).eq("id", event.id),
    ]);
    expect(activation.error).toBeNull();
    if (save.error) expect(save.error.hint).toBe("EVENT_PUBLICATION_CONFLICT");
    expect((await fetchEventById(f.supabase, event.id))!.status).toBe("active");
  }
}));
