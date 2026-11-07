import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import { defaultFormState } from "./components/event-form/event-form-schema";
import { saveEventDraft, fetchEventDraft, eventImageIsReferenced } from "@/lib/supabase-helpers/event-drafts";
import { fetchEventById } from "@/lib/supabase-helpers/events";
const document = { version: 1 as const, formState: defaultFormState, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] };

describe("staff-only event working documents", () => {
  it("preserves child identities and history during content edits and rolls back destructive replacements", () => withFixtures(async fixtures => {
    const user = await fixtures.createUser();
    const event = await fixtures.createEvent({ status: "active" });
    const sessionResult = await fixtures.supabase.from("check_in_sessions").insert({ event_id: event.id, name: "Opening", start_time: "2026-11-10T18:00:00Z", end_time: "2026-11-10T19:00:00Z" }).select().single();
    if (sessionResult.error) throw sessionResult.error;
    const session = sessionResult.data;
    const questionResult = await fixtures.supabase.from("event_application_questions").insert({ event_id: event.id, question: "Why attend?", response_type: "short_text" }).select().single();
    if (questionResult.error) throw questionResult.error;
    const question = questionResult.data;
    const applicationResult = await fixtures.supabase.from("event_applications").insert({ event_id: event.id, user_id: user.id, status: "submitted" }).select().single();
    if (applicationResult.error) throw applicationResult.error;
    const responseResult = await fixtures.supabase.from("event_application_responses").insert({ application_id: applicationResult.data.id, event_application_question_id: question.id, response: "To learn" }).select().single();
    if (responseResult.error) throw responseResult.error;
    const ticketResult = await fixtures.supabase.from("event_tickets").insert({ event_id: event.id, user_id: user.id }).select().single();
    if (ticketResult.error) throw ticketResult.error;
    const attendanceResult = await fixtures.supabase.from("check_ins").insert({ ticket_id: ticketResult.data.id, check_in_session_id: session.id }).select().single();
    if (attendanceResult.error) throw attendanceResult.error;
    const sessions = [{ name: session.name, start_time: session.start_time, end_time: session.end_time }];
    const input = { p_draft_id: null!, p_draft_revision: null!, p_event_id: event.id, p_expected_image_url: null!, p_expected_header_image_url: null!, p_slug: event.slug, p_event: { name: "Updated content", event_colour: "#C983C7" }, p_check_in_sessions: sessions, p_application_questions: [question], p_mentors: [], p_sponsors: [] };
    const saved = await fixtures.supabase.rpc("save_admin_event_builder", input);
    expect(saved.error).toBeNull();
    expect((await fetchEventById(fixtures.supabase, event.id))?.name).toBe("Updated content");
    const changedSession = await fixtures.supabase.rpc("save_admin_event_builder", { ...input, p_event: { name: "Must roll back" }, p_check_in_sessions: [{ ...sessions[0], name: "Replacement" }] });
    expect(changedSession.error?.message).toMatch(/already checked in/);
    const changedQuestion = await fixtures.supabase.rpc("save_admin_event_builder", { ...input, p_event: { name: "Must also roll back" }, p_application_questions: [] });
    expect(changedQuestion.error?.message).toMatch(/submitted applications/);
    expect((await fetchEventById(fixtures.supabase, event.id))?.name).toBe("Updated content");
    expect((await fixtures.supabase.from("check_in_sessions").select().eq("event_id", event.id)).data).toEqual([session]);
    expect((await fixtures.supabase.from("event_application_questions").select().eq("event_id", event.id)).data).toEqual([question]);
    expect((await fixtures.supabase.from("check_ins").select().eq("id", attendanceResult.data.id)).data).toEqual([attendanceResult.data]);
    expect((await fixtures.supabase.from("event_application_responses").select().eq("id", responseResult.data.id)).data).toEqual([responseResult.data]);
  }));
  it("round-trips incomplete values, keeps a durable identity, and rejects stale writes", () => withFixtures(async fixtures => {
    const id = fixtures.track("admin_event_drafts", randomUUID());
    const first = await saveEventDraft(fixtures.supabase, id, null, 0, document);
    expect(first.revision).toBe(1);
    expect((await saveEventDraft(fixtures.supabase, id, null, 0, document)).revision).toBe(1);
    const updated = { ...document, formState: { ...defaultFormState, name: "Saved name" } };
    const second = await saveEventDraft(fixtures.supabase, id, null, 1, updated);
    expect(second.revision).toBe(2);
    await expect(saveEventDraft(fixtures.supabase, id, null, 1, { ...updated, formState: { ...updated.formState, name: "Stale" } })).rejects.toThrow(/another tab/);
    expect((await fetchEventDraft(fixtures.supabase, id))?.document).toEqual(updated);
    expect(await fetchEventById(clientAs(null), id)).toBeNull();
    expect(await fetchEventById(fixtures.supabase, id)).toBeNull();
  }));
  it("allows admin/manager reads while denying member reads and every browser write", () => withFixtures(async fixtures => {
    const id = fixtures.track("admin_event_drafts", randomUUID());
    await saveEventDraft(fixtures.supabase, id, null, 0, document);
    const student = await fixtures.createUser();
    for (const role of ["admin", "manager"] as const) {
      const staff = await fixtures.createUser({ role_access: role });
      expect((await fetchEventDraft(clientAs(staff), id))?.id).toBe(id);
      const write = await clientAs(staff).from("admin_event_drafts").update({ document: {} }).eq("id", id);
      expect(write.error).not.toBeNull();
    }
    expect(await fetchEventDraft(clientAs(student), id)).toBeNull();
    const anonymous = await clientAs(null).from("admin_event_drafts").select("*");
    expect(anonymous.error).not.toBeNull();
    const rpc = await clientAs(student).rpc("save_admin_event_draft", { p_id: id, p_event_id: null!, p_document: {}, p_revision: 1 });
    expect(rpc.error).not.toBeNull();
  }));
  it("never mutates published data when saving an event's separate document", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ status: "draft" });
    const id = fixtures.track("admin_event_drafts", randomUUID());
    const image = "https://example.test/header.png";
    await saveEventDraft(fixtures.supabase, id, event.id, 0, { ...document, formState: { ...defaultFormState, name: "Working name", header_image_url: image, header_colour: "" } });
    expect((await fetchEventById(fixtures.supabase, event.id))?.name).toBe(event.name);
    expect(await eventImageIsReferenced(fixtures.supabase, image)).toBe(true);
  }));
  it("materializes atomically and safely retries after response loss", () => withFixtures(async fixtures => {
    const id = fixtures.track("admin_event_drafts", randomUUID());
    const draft = await saveEventDraft(fixtures.supabase, id, null, 0, document);
    const input = { p_draft_id: id, p_draft_revision: draft.revision, p_event_id: null!, p_expected_image_url: null!, p_expected_header_image_url: null!, p_slug: `draft-materialized-${fixtures.tag}`, p_event: { name: "Complete", description: "Description", regular_price: 0, member_price: 0, max_capacity: 10, status: "draft" }, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [] };
    const result = await fixtures.supabase.rpc("save_admin_event_builder", input);
    if (result.error) throw result.error;
    const eventId = (result.data as { id: string }).id;
    fixtures.track("events", eventId);
    const retry = await fixtures.supabase.rpc("save_admin_event_builder", input);
    expect(retry.error).toBeNull();
    expect(retry.data).toMatchObject({ id: eventId });
    expect(result.data).toMatchObject({ id: eventId, check_in_session_ids: [], question_ids: [] });
    expect(await fetchEventDraft(fixtures.supabase, id)).toBeNull();
    expect(await fetchEventById(clientAs(null), eventId)).toBeNull();
  }));
});
