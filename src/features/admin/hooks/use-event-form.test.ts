// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import type { EventApplicationQuestionRow, EventRow } from "@/lib/supabase/models";
import { useEventForm } from "./use-event-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("./use-event-form-draft", () => ({
  useEventFormDraft: () => ({ clearDraft: vi.fn() }),
}));
vi.mock("./use-unsaved-changes-guard", () => ({ useUnsavedChangesGuard: vi.fn() }));
vi.mock("@/features/admin/actions", () => ({
  saveAdminEventAction: vi.fn(async () => ({
    id: "event-1",
    checkInSessionIds: [],
    questionIds: [],
  })),
  deleteAdminEventAction: vi.fn(),
  discardUnusedEventImageAction: vi.fn(),
}));
import { saveAdminEventAction } from "@/features/admin/actions";

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2024-01-01T00:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const event = {
  id: "event-1",
  name: "Scheduled event",
  short_description: "Preview",
  description: "Description",
  status: "draft",
  event_type: "regular",
  regular_price: 0,
  member_price: 0,
  max_capacity: 10,
  starts_at: "2024-07-01T17:00:00+00:00",
  ends_at: "2024-07-01T18:00:00+00:00",
  registration_opens_at: "2024-06-01T16:00:00+00:00",
  registration_closes_at: null,
  publish_at: "2024-07-01T17:00:00Z",
  mentors_enabled: false,
  sponsors_enabled: false,
  requires_application: false,
} as EventRow;

// These dates use historical Pacific offsets so timezone rule updates cannot
// change the expected values for a future year.
describe("event form publishing schedule", () => {
  it("cancels scheduling when changing to active", () => {
    const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: event }));
    act(() => result.current.handleFieldChange("status", "active"));
    expect(result.current.formState.status).toBe("active");
    expect(result.current.formState.publish_at).toBe("");
  });

  it.each([
    [undefined, "2024-07-01T17:00:00.000Z"],
    ["2024-12-01T10:00", "2024-12-01T18:00:00.000Z"],
    ["", null],
  ])("loads the schedule and saves the edited value %s", async (value, expected) => {
    const { result } = renderHook(() => useEventForm({
      eventId: event.id,
      initialEvent: event,
      initialCheckInSessions: [{
        id: "check-in-1",
        created_at: null,
        updated_at: null,
        event_id: event.id,
        name: "Doors",
        start_time: "2024-07-01T17:00:00Z",
        end_time: "2024-07-01T18:00:00Z",
      }],
    }));
    expect(result.current.formState.publish_at).toBe("2024-07-01T10:00");
    if (value !== undefined) {
      act(() => result.current.handleFieldChange("publish_at", value));
    }
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
    });
    expect(result.current.error).toBeNull();
    expect(saveAdminEventAction).toHaveBeenCalledWith(expect.objectContaining({
      event: expect.objectContaining({ publish_at: expected }),
    }));
  });

  it("edits the schedule as Pacific wall-clock time and saves only the new columns", async () => {
    const { result } = renderHook(() => useEventForm({
      eventId: event.id,
      initialEvent: event,
      initialCheckInSessions: [{
        id: "check-in-1",
        created_at: null,
        updated_at: null,
        event_id: event.id,
        name: "Doors",
        start_time: "2024-07-01T17:00:00Z",
        end_time: "2024-07-01T18:00:00Z",
      }],
    }));
    expect(result.current.formState).toMatchObject({
      starts_at: "2024-07-01T10:00",
      ends_at: "2024-07-01T11:00",
      registration_opens_at: "2024-06-01T09:00",
      registration_closes_at: "",
    });
    act(() => {
      result.current.handleFieldChange("ends_at", "2024-07-02T09:30");
      result.current.handleFieldChange("registration_closes_at", "2024-06-30T23:59");
      result.current.handleFieldChange("requires_application", true);
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
    });
    expect(result.current.error).toBeNull();
    const payload = vi.mocked(saveAdminEventAction).mock.calls[0][0].event;
    expect(payload).toMatchObject({
      starts_at: "2024-07-01T17:00:00.000Z",
      ends_at: "2024-07-02T16:30:00.000Z",
      registration_opens_at: "2024-06-01T16:00:00.000Z",
      registration_closes_at: "2024-07-01T06:59:00.000Z",
      requires_application: true,
    });
    // save_admin_event_atomically writes every events column the payload
    // names, so this is exactly what a save can change.
    expect(Object.keys(payload).sort()).toEqual([
      "created_at", "description", "ends_at", "event_type", "image_url",
      "location_address_url", "location_building", "location_room",
      "max_capacity", "member_price", "mentors_enabled", "name", "publish_at",
      "registration_closes_at", "registration_opens_at", "regular_price",
      "requires_application", "short_description", "sponsors_enabled",
      "starts_at", "status",
    ]);
  });
});

describe("event form application questions", () => {
  const checkIn = {
    id: "check-in-1",
    created_at: null,
    updated_at: null,
    event_id: event.id,
    name: "Doors",
    start_time: "2024-07-01T17:00:00Z",
    end_time: "2024-07-01T18:00:00Z",
  };
  const saved = {
    id: "question-1",
    event_id: event.id,
    question: "Why?",
    description: null,
    response_type: "long_text",
    is_required: true,
    sort_order: 0,
    max_char_limit: 500,
    response_options: null,
    restrict_file_types: false,
    allowed_file_types: null,
    max_file_size_bytes: null,
    created_at: null,
    updated_at: null,
  } as EventApplicationQuestionRow;
  const submit = (result: { current: ReturnType<typeof useEventForm> }) =>
    act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
    });
  const sentIds = (call: number) =>
    vi.mocked(saveAdminEventAction).mock.calls[call][0].applicationQuestions.map(
      (question) => question.id
    );

  it("sends saved question ids and adopts the ids of new ones", async () => {
    vi.mocked(saveAdminEventAction).mockResolvedValue({
      id: event.id,
      checkInSessionIds: ["check-in-1"],
      questionIds: ["question-1", "question-2"],
    });
    const { result } = renderHook(() => useEventForm({
      eventId: event.id,
      initialEvent: { ...event, publish_at: null },
      initialCheckInSessions: [checkIn],
      initialApplicationQuestions: [saved],
    }));
    act(() => result.current.addApplicationQuestion("short_text"));
    act(() => result.current.updateApplicationQuestion(1, "question", "Team?"));

    await submit(result);
    expect(result.current.error).toBeNull();
    expect(sentIds(0)).toEqual(["question-1", null]);

    // Saving again updates the new question rather than adding it twice.
    await submit(result);
    expect(sentIds(1)).toEqual(["question-1", "question-2"]);
  });

  it("shows a refused question change", async () => {
    vi.mocked(saveAdminEventAction).mockResolvedValue({
      error: '"Why?" has answers on submitted applications, so it cannot be removed.',
    });
    const { result } = renderHook(() => useEventForm({
      eventId: event.id,
      initialEvent: { ...event, publish_at: null },
      initialCheckInSessions: [checkIn],
      initialApplicationQuestions: [saved],
    }));
    act(() => result.current.removeApplicationQuestion(0));

    await submit(result);
    expect(result.current.error).toMatch(/cannot be removed/);
    expect(result.current.successMessage).toBeNull();
  });
});

describe("event form check-in sessions", () => {
  const doors = {
    id: "check-in-1",
    created_at: null,
    updated_at: null,
    event_id: event.id,
    name: "Doors",
    start_time: "2024-07-01T17:00:00Z",
    end_time: "2024-07-01T18:00:00Z",
  };
  const workshop = { ...doors, id: "check-in-2", name: "Workshop" };
  const submit = (result: { current: ReturnType<typeof useEventForm> }) =>
    act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
    });
  const sent = (call: number) =>
    vi.mocked(saveAdminEventAction).mock.calls[call][0].checkInSessions;

  it("sends saved session ids and adopts the ids of new ones", async () => {
    vi.mocked(saveAdminEventAction).mockResolvedValue({
      id: event.id,
      checkInSessionIds: ["check-in-1", "check-in-3"],
      questionIds: [],
    });
    const { result } = renderHook(() => useEventForm({
      eventId: event.id,
      initialEvent: { ...event, publish_at: null },
      initialCheckInSessions: [doors],
    }));
    act(() => result.current.updateCheckInEvent(0, "end_time", "2024-07-01T12:00"));
    act(() => result.current.addCheckInEvent());
    act(() => {
      result.current.updateCheckInEvent(1, "name", "Lunch");
      result.current.updateCheckInEvent(1, "start_time", "2024-07-01T12:00");
      result.current.updateCheckInEvent(1, "end_time", "2024-07-01T13:00");
    });

    await submit(result);
    expect(result.current.error).toBeNull();
    expect(sent(0)).toEqual([
      {
        id: "check-in-1",
        name: "Doors",
        start_time: "2024-07-01T17:00:00.000Z",
        end_time: "2024-07-01T19:00:00.000Z",
      },
      {
        id: null,
        name: "Lunch",
        start_time: "2024-07-01T19:00:00.000Z",
        end_time: "2024-07-01T20:00:00.000Z",
      },
    ]);

    // Saving again updates the new session rather than adding it twice.
    await submit(result);
    expect(sent(1).map((session) => session.id)).toEqual(["check-in-1", "check-in-3"]);
  });

  it("leaves a removed session out, and shows a refused removal", async () => {
    const message =
      'Attendees have already checked in to "Workshop", so it cannot be removed.';
    vi.mocked(saveAdminEventAction).mockResolvedValue({ error: message });
    const { result } = renderHook(() => useEventForm({
      eventId: event.id,
      initialEvent: { ...event, publish_at: null },
      initialCheckInSessions: [doors, workshop],
    }));
    act(() => result.current.removeCheckInEvent(1));

    await submit(result);
    expect(sent(0).map((session) => session.id)).toEqual(["check-in-1"]);
    expect(result.current.error).toBe(message);
    expect(result.current.successMessage).toBeNull();
  });
});
