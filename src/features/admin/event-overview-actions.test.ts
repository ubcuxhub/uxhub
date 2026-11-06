import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventRow, UserInfoRow } from "@/lib/supabase/models";

vi.mock("server-only", () => ({}));

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";

const guards = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const events = vi.hoisted(() => ({
  fetchEventById: vi.fn(),
  updateEventSchedule: vi.fn(),
}));
const checkIns = vi.hoisted(() => ({ fetchCheckInSessions: vi.fn() }));
const applications = vi.hoisted(() => ({ fetchApplicationQuestions: vi.fn() }));
const revalidatePath = vi.hoisted(() => vi.fn());
const log = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
const sessionClient = vi.hoisted(() => ({ client: "session" }));
const serviceClient = vi.hoisted(() => ({ client: "service" }));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/guards", () => guards);
vi.mock("@/lib/supabase-helpers/events", () => events);
vi.mock("@/lib/supabase-helpers/check-ins", () => checkIns);
vi.mock("@/lib/supabase-helpers/event-applications", () => applications);
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: serviceClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => sessionClient) }));
vi.mock("@/lib/log", () => ({ log, errorFields: () => ({}) }));

// The publication rules are left real: the action's refusals are theirs.
import { updateEventScheduleAction } from "./event-overview-actions";

const admin = { id: "admin-1", role_access: "admin" } as UserInfoRow;
const manager = { id: "manager-1", role_access: "manager" } as UserInfoRow;

function storedEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: EVENT_ID,
    name: "Portfolio Night",
    short_description: "Show your work.",
    description: "A night of portfolio reviews.",
    status: "draft",
    publish_at: null,
    event_type: "regular",
    regular_price: 10,
    member_price: 5,
    max_capacity: 40,
    starts_at: "2099-11-20T02:00:00.000Z",
    ends_at: "2099-11-20T04:00:00.000Z",
    registration_opens_at: null,
    registration_closes_at: null,
    location_building: null,
    location_room: null,
    location_address_url: null,
    image_url: null,
    description_images: [],
    agenda: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: null,
    mentors_enabled: false,
    sponsors_enabled: false,
    requires_application: false,
    slug: "portfolio-night",
    agenda_enabled: false,
    event_colour: null,
    header_colour: null,
    header_image_url: null,
    is_featured: false,
    location_address: null,
    location_type: "in_person",
    marketing_url: null,
    max_team_size: null,
    min_team_size: null,
    team_deadline: null,
    teams_enabled: false,
    ...overrides,
  };
}

const input = {
  status: "draft" as const,
  publish_at: null,
  starts_at: "2099-11-21T02:00:00.000Z",
  ends_at: "2099-11-21T04:00:00.000Z",
  registration_opens_at: "2099-11-01T02:00:00.000Z",
  registration_closes_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  guards.requireAdmin.mockResolvedValue(admin);
  events.fetchEventById.mockResolvedValue(storedEvent());
  events.updateEventSchedule.mockImplementation(async (_client, _id, patch) => storedEvent(patch));
  checkIns.fetchCheckInSessions.mockResolvedValue([]);
  applications.fetchApplicationQuestions.mockResolvedValue([]);
});

describe("updateEventScheduleAction", () => {
  it("requires an admin before reading anything", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    guards.requireAdmin.mockRejectedValue(redirect);

    await expect(updateEventScheduleAction(EVENT_ID, input)).rejects.toBe(redirect);
    expect(events.fetchEventById).not.toHaveBeenCalled();
    expect(events.updateEventSchedule).not.toHaveBeenCalled();
  });

  it("saves the dates through the admin's own client and returns the row", async () => {
    const result = await updateEventScheduleAction(EVENT_ID, input);

    expect(result).toEqual({ ok: true, event: expect.objectContaining({ id: EVENT_ID }) });
    // Not the service role: RLS applies and the audit log sees who it was.
    expect(events.updateEventSchedule).toHaveBeenCalledWith(sessionClient, EVENT_ID, {
      status: "draft",
      publish_at: null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      registration_opens_at: input.registration_opens_at,
      registration_closes_at: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/events", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/events", "layout");
  });

  it("writes a manager's change through the service role, which the events UPDATE policy needs", async () => {
    guards.requireAdmin.mockResolvedValue(manager);

    await updateEventScheduleAction(EVENT_ID, input);

    expect(events.updateEventSchedule).toHaveBeenCalledWith(serviceClient, EVENT_ID, expect.any(Object));
    // Reads still go through the session.
    expect(events.fetchEventById).toHaveBeenCalledWith(sessionClient, EVENT_ID);
  });

  it("refuses a bad schedule without writing", async () => {
    const result = await updateEventScheduleAction(EVENT_ID, {
      ...input,
      ends_at: input.starts_at,
    });

    expect(result).toEqual({ ok: false, error: "Event end time must be after the start time." });
    expect(events.fetchEventById).not.toHaveBeenCalled();
    expect(events.updateEventSchedule).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a publish date on an active event", async () => {
    const result = await updateEventScheduleAction(EVENT_ID, {
      ...input,
      status: "active",
      publish_at: "2099-11-10T02:00:00.000Z",
    });

    expect(result).toEqual({ ok: false, error: "Only draft events can have a publish date." });
    expect(events.updateEventSchedule).not.toHaveBeenCalled();
  });

  it("treats a malformed id as a missing event", async () => {
    await expect(updateEventScheduleAction("not-an-id", input)).resolves.toEqual({
      ok: false,
      error: "This event no longer exists.",
    });
    expect(events.fetchEventById).not.toHaveBeenCalled();
  });

  it("reports an event that's gone", async () => {
    events.fetchEventById.mockResolvedValue(null);

    await expect(updateEventScheduleAction(EVENT_ID, input)).resolves.toEqual({
      ok: false,
      error: "This event no longer exists.",
    });
    expect(events.updateEventSchedule).not.toHaveBeenCalled();
  });

  describe("publishing a draft", () => {
    it("refuses an event the builder wouldn't save, naming what's missing", async () => {
      events.fetchEventById.mockResolvedValue(storedEvent({ short_description: null }));

      const result = await updateEventScheduleAction(EVENT_ID, { ...input, status: "active" });

      expect(result).toEqual({
        ok: false,
        error: "Finish the event in Edit before publishing. Short description is required.",
      });
      expect(events.updateEventSchedule).not.toHaveBeenCalled();
    });

    it("checks a scheduled publish the same way", async () => {
      events.fetchEventById.mockResolvedValue(storedEvent({ description: "" }));

      const result = await updateEventScheduleAction(EVENT_ID, {
        ...input,
        publish_at: "2099-11-10T02:00:00.000Z",
      });

      expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/^Finish the event in Edit/) });
    });

    it("validates against the new dates, and the stored check-in sessions", async () => {
      checkIns.fetchCheckInSessions.mockResolvedValue([
        { id: "s1", name: "", start_time: input.starts_at, end_time: input.ends_at },
      ]);

      const result = await updateEventScheduleAction(EVENT_ID, { ...input, status: "active" });

      expect(checkIns.fetchCheckInSessions).toHaveBeenCalledWith(sessionClient, EVENT_ID);
      expect(result).toMatchObject({
        ok: false,
        error: "Finish the event in Edit before publishing. All check-in sessions require name, start time, and end time.",
      });
    });

    it("publishes a complete event and drops any publish date", async () => {
      events.fetchEventById.mockResolvedValue(storedEvent({ publish_at: "2099-11-10T02:00:00.000Z" }));

      const result = await updateEventScheduleAction(EVENT_ID, { ...input, status: "active" });

      expect(result.ok).toBe(true);
      expect(events.updateEventSchedule.mock.calls[0][2]).toMatchObject({ status: "active", publish_at: null });
    });

    it("doesn't re-check an event that is already active", async () => {
      events.fetchEventById.mockResolvedValue(storedEvent({ status: "active", short_description: null }));

      const result = await updateEventScheduleAction(EVENT_ID, { ...input, status: "active" });

      expect(result.ok).toBe(true);
      expect(checkIns.fetchCheckInSessions).not.toHaveBeenCalled();
    });
  });

  it("logs and reports a failed write without its message", async () => {
    events.updateEventSchedule.mockRejectedValue(new Error("row data in here"));

    const result = await updateEventScheduleAction(EVENT_ID, input);

    expect(result).toEqual({ ok: false, error: "Couldn’t save the schedule. Try again." });
    expect(log.error).toHaveBeenCalledWith("admin.event_schedule_save_failed", { eventId: EVENT_ID });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
