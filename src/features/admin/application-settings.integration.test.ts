import type { Json } from "@/lib/supabase/database.types";
import { describe, expect, it } from "vitest";
import { clientAs, withFixtures, type Fixtures } from "@/test/integration";
import { fetchEventApplicationSettings } from "@/lib/supabase-helpers/event-application-settings";

function save(fixtures: Fixtures, eventId: string, timing?: Record<string, Json>, questions: object[] = [], event: Record<string, Json> = {}) {
  return fixtures.supabase.rpc("save_admin_event_atomically", {
    p_event_id: eventId, p_event: { name: "Application settings", ...event, ...(timing ? { _application_timing: timing } : {}) },
    p_slug: null!, p_expected_image_url: null!, p_check_in_sessions: [], p_application_questions: questions as never, p_mentors: [], p_sponsors: [],
  });
}
const timing = { decisions_release_at: "2026-11-16T18:00:00Z", confirmation_deadline: "2026-11-17T18:00:00Z" };

describe("application form configuration", () => {
  it("round-trips and clears staff-only settings without changing existing offers", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent();
    const user = await fixtures.createUser();
    const offer = await fixtures.supabase.from("event_applications").insert({ event_id: event.id, user_id: user.id, status: "accepted", offer_expires_at: "2099-01-01T00:00:00Z" }).select().single();
    if (offer.error) throw offer.error;
    expect((await save(fixtures, event.id, timing)).error).toBeNull();
    const stored = await fetchEventApplicationSettings(fixtures.supabase, event.id);
    expect(stored).toMatchObject({ decisions_release_at: "2026-11-16T18:00:00+00:00", confirmation_deadline: "2026-11-17T18:00:00+00:00" });
    expect(stored?.questions_locked_at).toBeTruthy();
    expect((await save(fixtures, event.id)).error).toBeNull();
    expect(await fetchEventApplicationSettings(fixtures.supabase, event.id)).toEqual(stored);
    expect((await fixtures.supabase.from("event_applications").select().eq("id", offer.data.id)).data).toEqual([offer.data]);
    expect((await save(fixtures, event.id, { decisions_release_at: null, confirmation_deadline: null })).error).toBeNull();
    expect(await fetchEventApplicationSettings(fixtures.supabase, event.id)).toMatchObject({ decisions_release_at: null, confirmation_deadline: null, questions_locked_at: stored?.questions_locked_at });
  }));

  it("rejects reversed timing atomically and accepts elapsed moments or a single setting", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent();
    const rejected = await save(fixtures, event.id, { ...timing, confirmation_deadline: timing.decisions_release_at });
    expect(rejected.error?.hint).toBe("EVENT_SETTINGS_CONFLICT");
    expect((await fixtures.supabase.from("events").select("name").eq("id", event.id).single()).data?.name).toBe(event.name);
    expect(await fetchEventApplicationSettings(fixtures.supabase, event.id)).toBeNull();
    expect((await save(fixtures, event.id, { decisions_release_at: "2020-01-01T00:00:00Z", confirmation_deadline: null })).error).toBeNull();
  }));

  it("allows staff reads, denies browser writes and member/anonymous reads and RPCs", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent();
    expect((await save(fixtures, event.id, timing)).error).toBeNull();
    for (const role of ["admin", "manager", "basic"] as const) {
      const user = await fixtures.createUser({ role_access: role });
      const client = clientAs(user);
      const result = await fetchEventApplicationSettings(client, event.id);
      expect(!!result).toBe(role !== "basic");
      expect((await client.from("event_application_settings").update({ confirmation_deadline: null }).eq("event_id", event.id)).error).not.toBeNull();
      expect((await client.from("event_application_settings").insert({ event_id: event.id })).error).not.toBeNull();
      expect((await client.from("event_application_settings").delete().eq("event_id", event.id)).error).not.toBeNull();
      expect((await client.rpc("save_event_application_questions", { p_event_id: event.id, p_questions: [] })).error).not.toBeNull();
    }
    expect((await clientAs(null).from("event_application_settings").select("*")).error).not.toBeNull();
  }));

  it("requires valid questions on publication and scheduling, retaining incomplete draft persistence", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ requires_application: true, status: "draft" });
    expect((await save(fixtures, event.id, undefined, [], { status: "active" })).error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
    expect((await save(fixtures, event.id, undefined, [], { publish_at: "2099-01-01T00:00:00Z" })).error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
    expect((await save(fixtures, event.id, undefined, [{ question: "", response_type: "dropdown", response_options: [] }])).error).toBeNull();
    const row = await fixtures.supabase.from("event_application_questions").select().eq("event_id", event.id).single();
    if (row.error) throw row.error;
    expect((await save(fixtures, event.id, undefined, [row.data], { status: "active" })).error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
    const saved = await save(fixtures, event.id, undefined, [{ ...row.data, question: "Year?", response_options: ["1", "2"] }], { status: "active" });
    expect(saved.error).toBeNull();
  }));

  it("serializes question editing with the first actual member submission", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ requires_application: true, status: "active" });
    const user = await fixtures.createUser();
    const q = await fixtures.supabase.from("event_application_questions").insert({ event_id: event.id, question: "Why?", response_type: "short_text", is_required: false }).select().single();
    if (q.error) throw q.error;
    const draft = await clientAs(user).from("event_applications").insert({ event_id: event.id, user_id: user.id, status: "draft" }).select().single();
    if (draft.error) throw draft.error;
    expect(await fetchEventApplicationSettings(fixtures.supabase, event.id)).toBeNull();
    const [edited, submitted] = await Promise.all([
      fixtures.supabase.rpc("save_event_application_questions", { p_event_id: event.id, p_questions: [{ ...q.data, question: "Why attend?" }] }),
      clientAs(user).rpc("submit_event_application", { p_application_id: draft.data.id }),
    ]);
    expect(submitted.error).toBeNull();
    expect(submitted.data?.[0].status).toBe("SUBMITTED");
    if (edited.error) expect(edited.error.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
    const after = await fixtures.supabase.from("event_application_questions").select().eq("id", q.data.id).single();
    expect(after.data?.question).toBe(edited.error ? "Why?" : "Why attend?");
    expect((await fixtures.supabase.from("event_application_questions").update({ question: "Late change" }).eq("id", q.data.id)).error?.hint).toBe("APPLICATION_QUESTIONS_CONFLICT");
  }));
});
