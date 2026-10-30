import { describe, expect, it } from "vitest";
import type { EventUpdate } from "@/lib/supabase/models";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { clientAs, withFixtures, type Fixtures } from "@/test/integration";

async function save(fixtures: Fixtures, event: EventUpdate, eventId?: string) {
  const { data, error } = await fixtures.supabase.rpc("save_admin_event_atomically", {
    p_event_id: eventId ?? null!,
    p_event: event,
    p_slug: `scheduled-${fixtures.tag}`,
    p_expected_image_url: null!,
    p_check_in_sessions: [],
    p_application_questions: [],
    p_mentors: [],
    p_sponsors: [],
  });
  if (error) throw error;
  const id = (data as { id: string }).id;
  if (!eventId) fixtures.track("events", id);
  return id;
}

const hour = 60 * 60 * 1000;

function payload(fixtures: Fixtures, publish_at: string | null) {
  return {
    name: `Scheduled event ${fixtures.tag}`,
    description: "Publishing schedule integration test.",
    status: "draft" as const,
    event_type: "regular" as const,
    mentors_enabled: false,
    sponsors_enabled: false,
    requires_application: false,
    regular_price: 0,
    member_price: 0,
    max_capacity: 10,
    created_at: new Date().toISOString(),
    publish_at,
  };
}

describe("admin event publishing", () => {
  it("saves, edits, preserves and cancels a draft schedule", () =>
    withFixtures(async (fixtures) => {
      const future = new Date(Date.now() + hour).toISOString();
      const event = payload(fixtures, future);
      const id = await save(fixtures, event);
      const read = () => fetchEventById(fixtures.supabase, id);
      const publicRead = () => fetchEventById(clientAs(null), id);
      expect((await read())!.status).toBe("draft");
      expect(new Date((await read())!.publish_at!).toISOString()).toBe(future);
      expect(await publicRead()).toBeNull();

      const later = new Date(Date.now() + 2 * hour).toISOString();
      await save(fixtures, { ...event, publish_at: later }, id);
      expect(new Date((await read())!.publish_at!).toISOString()).toBe(later);

      const legacyPayload: EventUpdate = { ...event };
      delete legacyPayload.publish_at;
      await save(fixtures, legacyPayload, id);
      expect(new Date((await read())!.publish_at!).toISOString()).toBe(later);

      await save(fixtures, { ...event, publish_at: null }, id);
      expect((await read())!.publish_at).toBeNull();
      expect((await read())!.status).toBe("draft");
      expect(await publicRead()).toBeNull();
    }));

  it("saves the schedule from the new columns alone", () =>
    withFixtures(async (fixtures) => {
      const schedule = {
        starts_at: "2026-11-20T02:00:00.000Z",
        ends_at: "2026-11-20T04:00:00.000Z",
        registration_opens_at: null,
        registration_closes_at: null,
      };
      const id = await save(fixtures, { ...payload(fixtures, null), ...schedule });
      const read = async () => {
        const event = (await fetchEventById(fixtures.supabase, id))!;
        return {
          starts_at: event.starts_at && new Date(event.starts_at).toISOString(),
          ends_at: event.ends_at && new Date(event.ends_at).toISOString(),
          registration_opens_at: event.registration_opens_at,
          registration_closes_at: event.registration_closes_at,
        };
      };
      // No registration window means always open, not a week from creation.
      expect(await read()).toEqual(schedule);

      const opensAt = "2026-11-01T16:00:00.000Z";
      await save(fixtures, { ...payload(fixtures, null), ...schedule, registration_opens_at: opensAt }, id);
      expect((await read()).registration_opens_at).not.toBeNull();
      expect(new Date((await read()).registration_opens_at!).toISOString()).toBe(opensAt);
    }));

  it("activates only due drafts and clears their schedules", () =>
    withFixtures(async (fixtures) => {
      const past = new Date(Date.now() - hour).toISOString();
      const due = await fixtures.createEvent({ status: "draft", publish_at: past });
      const unscheduled = await fixtures.createEvent({ slug: `unscheduled-${fixtures.tag}`, status: "draft" });
      const future = await fixtures.createEvent({ slug: `future-${fixtures.tag}`, status: "draft", publish_at: new Date(Date.now() + hour).toISOString() });
      const { error } = await fixtures.supabase.rpc("publish_due_events");
      if (error) throw error;
      const published = await fetchEventById(fixtures.supabase, due.id);
      expect(published!.status).toBe("active");
      expect(published!.publish_at).toBeNull();
      expect(await fetchEventById(clientAs(null), due.id)).not.toBeNull();
      expect((await fetchEventById(fixtures.supabase, unscheduled.id))!.status).toBe("draft");
      expect((await fetchEventById(fixtures.supabase, future.id))!.status).toBe("draft");
    }));

  it("rejects a schedule on an active event and clears it on a manual status change", () =>
    withFixtures(async (fixtures) => {
      const event = payload(fixtures, new Date(Date.now() + hour).toISOString());
      await expect(save(fixtures, { ...event, status: "active" })).rejects.toMatchObject({
        message: "Only draft events can have a publish date.",
      });
      const id = await save(fixtures, event);
      const { error } = await fixtures.supabase.from("events").update({ status: "active" }).eq("id", id);
      if (error) throw error;
      expect((await fetchEventById(fixtures.supabase, id))!.publish_at).toBeNull();
      expect((await fetchEventById(fixtures.supabase, id))!.status).toBe("active");
      expect(await fetchEventById(clientAs(null), id)).toEqual(expect.objectContaining({ status: "active" }));
    }));

  it("handles concurrent schedule edits and publishes the due batch", () =>
    withFixtures(async (fixtures) => {
      const events = await Promise.all([0, 1, 2].map((index) => fixtures.createEvent({
        slug: `scheduled-batch-${index}-${fixtures.tag}`,
        status: "draft",
        publish_at: new Date(Date.now() + hour).toISOString(),
      })));
      const dueAt = new Date(Date.now() - hour).toISOString();
      // Distinct transactions compete to update the shared cron schedule.
      // The later edit must not lose the earlier wake-up, and due events batch.
      const edits = await Promise.all(events.map((event, index) => fixtures.supabase
        .from("events")
        .update({ publish_at: index < 2 ? dueAt : new Date(Date.now() + 2 * hour).toISOString() })
        .eq("id", event.id)));
      for (const edit of edits) if (edit.error) throw edit.error;

      const { data, error } = await fixtures.supabase.rpc("publish_due_events");
      if (error) throw error;
      expect(data).toBeGreaterThanOrEqual(2);
      const current = await fetchEventById(fixtures.supabase, events[0].id);
      expect(current!.status).toBe("active");
      expect(current!.publish_at).toBeNull();
      expect((await fetchEventById(fixtures.supabase, events[1].id))!.status).toBe("active");
      expect((await fetchEventById(fixtures.supabase, events[1].id))!.publish_at).toBeNull();
      expect((await fetchEventById(fixtures.supabase, events[2].id))!.status).toBe("draft");
    }));
});
