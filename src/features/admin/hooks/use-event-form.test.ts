// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import { defaultFormState, checkInDraftsFromRows, formStateFromEvent, getInitialFormState, questionsFromRows } from "../components/event-form/event-form-schema";
import type { EventApplicationQuestionRow, EventRow } from "@/lib/supabase/models";
import { useEventForm } from "./use-event-form";
import { parseWorkingDocument } from "../lib/event-working-document";
import { toast } from "@/components/ui/toast";
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("./use-unsaved-changes-guard", () => ({ useUnsavedChangesGuard: vi.fn() }));
vi.mock("@/features/admin/actions", () => ({
  saveAdminEventDraftAction: vi.fn(async () => ({ id: "draft-1", revision: 1 })),
  saveAdminEventAction: vi.fn(async () => ({
    id: "event-1",
    checkInSessionIds: [],
    questionIds: [],
  })),
  deleteAdminEventAction: vi.fn(),
  discardUnusedEventImageAction: vi.fn(),
}));
import { saveAdminEventAction, saveAdminEventDraftAction } from "@/features/admin/actions";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.mocked(saveAdminEventAction).mockResolvedValue({ id: "event-1", checkInSessionIds: [], questionIds: [] });
  vi.mocked(saveAdminEventDraftAction).mockResolvedValue({ id: "draft-1", revision: 1 });
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2024-01-01T00:00:00Z"));
});

it("retries a failed draft save with the latest edited values and preserves leave-dialog mode", async () => {
  const { result } = renderHook(() => useEventForm({}));
  act(() => result.current.handleFieldChange("name", "First title"));
  vi.mocked(saveAdminEventDraftAction).mockRejectedValueOnce(new Error("Offline"));
  await act(async () => { await result.current.handleSaveDraft(false); });
  expect(result.current.hasUnsavedChanges).toBe(true);
  expect(result.current.showDraftSaved).toBe(false);
  const options = vi.mocked(toast.error).mock.calls.at(-1)![1]!;
  expect(options.duration).toBe(Infinity);
  expect(options.action?.label).toBe("Try again");
  act(() => result.current.handleFieldChange("name", "Edited after failure"));
  await act(async () => { options.action!.onClick(); });
  expect(vi.mocked(saveAdminEventDraftAction).mock.calls.at(-1)![0].document.formState.name).toBe("Edited after failure");
  expect(result.current.hasUnsavedChanges).toBe(false);
  expect(result.current.showDraftSaved).toBe(false);
  expect(toast.dismiss).toHaveBeenCalledWith(options.id);
});

describe("legacy browser draft recovery", () => {
  const key = "event_create_form_draft";
  it("restores incomplete work as dirty and keeps the browser copy until a durable save succeeds", async () => {
    const legacy = { formState: { name: "Recovered draft", description: "Old overview", regular_price: "12.50", member_price: "5" }, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] };
    localStorage.setItem(key, JSON.stringify(legacy));
    const { result } = renderHook(() => useEventForm({}));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.formState.name).toBe("Recovered draft");
    expect(result.current.formState.description).toBe("Old overview");
    expect(result.current.formState).toMatchObject({ pricing_mode: "legacy", regular_price: "12.50", member_price: "5", page_slug: "recovered-draft" });
    expect(result.current.hasUnsavedChanges).toBe(true);
    vi.mocked(saveAdminEventDraftAction).mockRejectedValueOnce(new Error("Offline"));
    await act(async () => { await result.current.handleSaveDraft(); });
    expect(localStorage.getItem(key)).toBe(JSON.stringify(legacy));
    await act(async () => { await result.current.handleSaveDraft(); });
    expect(localStorage.getItem(key)).toBeNull();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it("keeps invalid recovery data and asks for images whose object URLs expired", async () => {
    localStorage.setItem(key, JSON.stringify({ formState: { name: "With image", image_url: "blob:expired" } }));
    const { result, unmount } = renderHook(() => useEventForm({}));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.formState.name).toBe("With image");
    expect(result.current.formState.image_url).toBe("");
    expect(result.current.error).toMatch(/Select its images again/);
    unmount();
    localStorage.setItem(key, "invalid JSON");
    const invalid = renderHook(() => useEventForm({}));
    await act(async () => { await Promise.resolve(); });
    expect(invalid.result.current.error).toMatch(/could not be restored/);
    expect(localStorage.getItem(key)).toBe("invalid JSON");
  });

  it("does not replace an existing event with a browser draft", async () => {
    localStorage.setItem(key, JSON.stringify({ formState: { name: "Old local draft" } }));
    const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: event }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.formState.name).toBe(event.name);
    expect(localStorage.getItem(key)).not.toBeNull();
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const event = {
  id: "event-1",
  name: "Scheduled event",
  slug: "scheduled-event",
  is_featured: false,
  short_description: "Preview",
  description: "Description",
  status: "draft",
  event_type: "regular",
  regular_price: 0,
  member_price: 0,
  max_capacity: 10,
  location_type: "in_person", location_building: "Nest", location_address: "6133 University Blvd",
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
      const dates = result.current.formState.date_location!;
      result.current.handleFieldChange("date_location", { ...dates, dates: [{ ...dates.dates[0], end: "12:30" }] });
      result.current.handleFieldChange("registration_closes_at", "2024-06-30T23:59");
      result.current.handleFieldChange("publish_at", "2024-06-29T10:00");
      result.current.handleFieldChange("requires_application", true);
      result.current.addApplicationQuestion("short_text");
      result.current.updateApplicationQuestion(0, "question", "Why attend?");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
    });
    expect(result.current.error).toBeNull();
    const payload = vi.mocked(saveAdminEventAction).mock.calls[0][0].event;
    expect(payload).toMatchObject({
      starts_at: "2024-07-01T17:00:00.000Z",
      ends_at: "2024-07-01T19:30:00.000Z",
      registration_opens_at: "2024-06-01T16:00:00.000Z",
      registration_closes_at: "2024-07-01T06:59:00.000Z",
      requires_application: true,
    });
    // save_admin_event_atomically writes every events column the payload
    // names, so this is exactly what a save can change.
    expect(Object.keys(payload).sort()).toEqual([
      "agenda_enabled",
      "configured_marketing_mode", "configured_marketing_url", "configured_slug", "configured_slug_edited", "created_at", "description", "description_rich", "ends_at", "event_colour", "event_type", "header_colour", "header_image_url", "image_url", "is_featured",
      "location_address_url", "location_building", "location_room",
      "max_capacity", "max_team_size", "mentors_enabled", "min_team_size", "name", "publish_at",
      "registration_closes_at", "registration_opens_at",
      "requires_application", "short_description", "sponsors_enabled",
      "starts_at", "status", "team_deadline", "teams_enabled",
    ]);
  });
});


describe("durable incomplete drafts", () => {
  it("saves without publish fields and establishes a clean snapshot", async () => {
    const { result } = renderHook(() => useEventForm({}));
    act(() => result.current.handleFieldChange("name", "Work in progress"));
    expect(result.current.hasUnsavedChanges).toBe(true);
    await act(async () => { expect(await result.current.handleSaveDraft()).toBe(true); });
    expect(saveAdminEventAction).not.toHaveBeenCalled();
    expect(saveAdminEventDraftAction).toHaveBeenCalledWith(expect.objectContaining({ eventId: null, document: expect.objectContaining({ formState: expect.objectContaining({ name: "Work in progress", ends_at: "" }) }) }));
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.showDraftSaved).toBe(true);
  });
  it("keeps entered work and its dirty state after a failed save", async () => {
    vi.mocked(saveAdminEventDraftAction).mockRejectedValueOnce(new Error("Draft changed elsewhere"));
    const { result } = renderHook(() => useEventForm({}));
    act(() => result.current.handleFieldChange("name", "Keep me"));
    await act(async () => { expect(await result.current.handleSaveDraft(false)).toBe(false); });
    expect(result.current.formState.name).toBe("Keep me");
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.error).toBe("Draft changed elsewhere");
    expect(result.current.showDraftSaved).toBe(false);
  });
});


it("reopens a saved unfinished card as clean while retaining all its values", () => {
  const draft = { id: "saved-draft", revision: 2, document: { version: 1 as const, formState: { ...getInitialFormState(), name: "Saved" }, checkInEvents: [], mentors: [], sponsors: [{ name: "Still editing", brand_logo_path: "", isEditing: true }], applicationTemplate: [] } };
  const { result } = renderHook(() => useEventForm({ initialDraft: draft }));
  expect(result.current.sponsors[0].name).toBe("Still editing");
  expect(result.current.hasUnsavedChanges).toBe(false);
});


it("preserves saved question identity during a branding save", async () => {
  const question = { id: "question-1", event_id: event.id, created_at: null, updated_at: null, question: "Why?", description: null, response_type: "short_text" as const, is_required: false, sort_order: 0, max_char_limit: null, response_options: [], restrict_file_types: false, allowed_file_types: [], max_file_size_bytes: null };
  const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: event, initialApplicationQuestions: [question], initialCheckInSessions: [{ id: "session-1", event_id: event.id, created_at: null, updated_at: null, name: "Doors", start_time: event.starts_at, end_time: event.ends_at }] }));
  act(() => result.current.handleFieldChange("event_colour", "#C983C7"));
  await act(async () => { await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>); });
  expect(result.current.error).toBeNull();
  expect(saveAdminEventAction).toHaveBeenCalledWith(expect.objectContaining({ applicationQuestions: [expect.objectContaining({ id: question.id, max_char_limit: null, response_options: null, allowed_file_types: null })] }));
});


describe("event configuration editing", () => {
  it("follows the name until the URL is deliberately edited, including after draft save", async () => {
    const { result } = renderHook(() => useEventForm({}));
    act(() => result.current.handleFieldChange("name", "Design Sprint"));
    expect(result.current.formState.page_slug).toBe("design-sprint");
    await act(async () => { await result.current.handleSaveDraft(false); });
    act(() => result.current.handleFieldChange("name", "New Name"));
    expect(result.current.formState.page_slug).toBe("new-name");
    act(() => result.current.handleFieldChange("page_slug", "custom-url"));
    act(() => result.current.handleFieldChange("name", "Another Name"));
    expect(result.current.formState.page_slug).toBe("custom-url");
  });
  it("does not reset source-event settings when resuming an older working document", () => {
    const source = { ...event, slug: "original-url", marketing_url: "https://existing.example.com", is_featured: true };
    const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: source, initialDraft: { id: "old-draft", revision: 1, document: { version: 1, formState: { ...defaultFormState, name: "Old document name", pricing_mode: "legacy", configuration_initialized: false }, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] } } }));
    expect(result.current.formState).toMatchObject({ name: "Old document name", page_slug: "original-url", marketing_mode: "external", marketing_url: "https://existing.example.com", is_featured: true });
  });
  it("keeps a saved automatic URL following the name after reloading an event", () => {
    const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: { ...event, configured_slug: "scheduled-event", configured_slug_edited: false } }));
    act(() => result.current.handleFieldChange("name", "Renamed Event"));
    expect(result.current.formState.page_slug).toBe("renamed-event");
  });
  it("hydrates saved configuration and preserves both legacy effective amounts", () => {
    const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: { ...event, slug: "original", regular_price: 20, member_price: 5, configured_pricing_mode: "paid", configured_price: 12.5, configured_marketing_mode: "external", configured_marketing_url: "https://devpost.com/design", configured_slug: "saved-url", is_featured: true } }));
    expect(result.current.formState).toMatchObject({ pricing_mode: "paid", pricing_amount: "12.5", regular_price: "20", member_price: "5", marketing_mode: "external", marketing_url: "https://devpost.com/design", page_slug: "saved-url", is_featured: true });
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
    act(() => { const config = result.current.formState.date_location!;
      result.current.handleFieldChange("date_location", { ...config, dates: [{ ...config.dates[0], end: "12:00" }, { ...config.dates[0], key: "second", session_id: null, start: "12:00", end: "13:00", label: "Lunch" }] });
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
    act(() => { const config = result.current.formState.date_location!; result.current.handleFieldChange("date_location", { ...config, dates: config.dates.slice(0, 1) }); });

    await submit(result);
    expect(sent(0).map((session) => session.id)).toEqual(["check-in-1"]);
    expect(result.current.error).toBe(message);
    expect(result.current.successMessage).toBeNull();
  });
});


it("loads staff-only timing and sends Pacific moments separately from event and offer fields", async () => {
  vi.mocked(saveAdminEventAction).mockResolvedValue({ id: event.id, checkInSessionIds: ["session-1"], questionIds: [] });
  const settings = { event_id: event.id, decisions_release_at: "2026-11-16T18:00:00Z", confirmation_deadline: "2026-11-17T18:00:00Z", questions_locked_at: null };
  const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: event, initialApplicationSettings: settings, initialCheckInSessions: [{ id: "session-1", event_id: event.id, created_at: null, updated_at: null, name: "Doors", start_time: event.starts_at, end_time: event.ends_at }] }));
  expect(result.current.formState.decisions_release_at).toBe("2026-11-16T11:00");
  act(() => result.current.handleFieldChange("confirmation_deadline", "2026-11-18T11:00"));
  await act(async () => { await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>); });
  expect(result.current.error).toBeNull();
  expect(saveAdminEventAction).toHaveBeenLastCalledWith(expect.objectContaining({ applicationTiming: { decisions_release_at: "2026-11-16T18:00:00.000Z", confirmation_deadline: "2026-11-18T18:00:00.000Z" } }));
});

it("saves an incomplete application and incomplete timing as a working draft", async () => {
  const { result } = renderHook(() => useEventForm({}));
  act(() => {
    result.current.handleFieldChange("requires_application", true);
    result.current.addApplicationQuestion("dropdown");
    result.current.handleFieldChange("decisions_release_at", "2099-01-01T");
  });
  await act(async () => { await result.current.handleSaveDraft(); });
  expect(result.current.error).toBeNull();
  expect(saveAdminEventDraftAction).toHaveBeenLastCalledWith(expect.objectContaining({ document: expect.objectContaining({ formState: expect.objectContaining({ decisions_release_at: "2099-01-01T" }), applicationTemplate: [expect.objectContaining({ question: "", response_options: [""] })] }) }));
});

describe("drafts with saved event children", () => {
  const storedEvent = { ...event, publish_at: null, description_rich: [{ type: "paragraph", spans: [{ text: event.description! }] }], header_image_url: "https://example.test/header.png", header_colour: null, event_colour: "#C983C7" };
  const session = { id: "session-1", event_id: event.id, created_at: null, updated_at: null, name: "Doors", start_time: event.starts_at, end_time: event.ends_at };
  const question = { id: "question-1", event_id: event.id, created_at: null, updated_at: null, question: "Why?", description: null, response_type: "short_text" as const, is_required: false, sort_order: 0, max_char_limit: 500, response_options: null, restrict_file_types: false, allowed_file_types: null, max_file_size_bytes: null };
  const options = { eventId: event.id, initialEvent: storedEvent, initialCheckInSessions: [session], initialApplicationQuestions: [question] };
  const submit = (result: { current: ReturnType<typeof useEventForm> }) => act(async () => {
    await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
  });

  it("loads branding and formatting and round-trips saved IDs through a working document", async () => {
    const { result, unmount } = renderHook(() => useEventForm(options));
    expect(result.current.formState).toMatchObject({ description_rich: storedEvent.description_rich, header_image_url: storedEvent.header_image_url, header_colour: "", event_colour: storedEvent.event_colour });
    act(() => result.current.handleFieldChange("name", "Working title"));
    await act(async () => { expect(await result.current.handleSaveDraft(false)).toBe(true); });
    const sent = vi.mocked(saveAdminEventDraftAction).mock.calls[0][0];
    const document = parseWorkingDocument(JSON.parse(JSON.stringify(sent.document)));
    expect(document.checkInEvents[0].id).toBe(session.id);
    expect(document.applicationTemplate[0].id).toBe(question.id);
    unmount();
    const reopened = renderHook(() => useEventForm({ ...options, initialDraft: { id: sent.id, revision: 1, document } }));
    expect(reopened.result.current.formState.name).toBe("Working title");
    expect(reopened.result.current.formState.date_location).toMatchObject({ location: { address: storedEvent.location_address }, dates: [{ session_id: session.id }] });
    expect(reopened.result.current.hasUnsavedChanges).toBe(false);
    vi.mocked(saveAdminEventAction).mockResolvedValue({ id: event.id, checkInSessionIds: [session.id], questionIds: [question.id] });
    await submit(reopened.result);
    expect(reopened.result.current.error).toBeNull();
    expect(vi.mocked(saveAdminEventAction).mock.calls[0][0]).toMatchObject({ draftId: sent.id, draftRevision: 1, checkInSessions: [{ id: session.id }], applicationQuestions: [{ id: question.id }] });
    expect(reopened.result.current.hasUnsavedChanges).toBe(false);
    await submit(reopened.result);
    expect(vi.mocked(saveAdminEventAction).mock.calls[1][0].draftId).toBeUndefined();
  });

  it("preserves changed work and draft identity on a refused event save, then adopts IDs on success", async () => {
    const document = { version: 1 as const, formState: formStateFromEvent(storedEvent), checkInEvents: checkInDraftsFromRows([session]), mentors: [], sponsors: [], applicationTemplate: questionsFromRows([question]) };
    const { result } = renderHook(() => useEventForm({ ...options, initialDraft: { id: "saved-draft", revision: 2, document } }));
    act(() => result.current.handleFieldChange("name", "Keep my edits"));
    vi.mocked(saveAdminEventAction).mockResolvedValueOnce({ error: "Question has answers" });
    await submit(result);
    expect(result.current.error).toBe("Question has answers");
    expect(result.current.formState.name).toBe("Keep my edits");
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.successMessage).toBeNull();
    vi.mocked(saveAdminEventAction).mockResolvedValue({ id: event.id, checkInSessionIds: [session.id], questionIds: [question.id] });
    await submit(result);
    expect(vi.mocked(saveAdminEventAction).mock.calls[1][0]).toMatchObject({ draftId: "saved-draft", draftRevision: 2 });
    expect(result.current.error).toBeNull();
    expect(result.current.checkInEvents[0].id).toBe(session.id);
    expect(result.current.applicationTemplate[0].id).toBe(question.id);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});

it("recovers team settings from an event when an older working document has no team fields", async () => {
  const source = { ...event, teams_enabled: true, min_team_size: 2, max_team_size: 4, team_deadline: "2026-11-16T18:00:00Z" };
  const oldState = { ...formStateFromEvent(source) };
  for (const key of ["teams_configuration_initialized", "teams_enabled", "min_team_size", "max_team_size", "team_deadline"]) delete (oldState as unknown as Record<string, unknown>)[key];
  const document = parseWorkingDocument({ version: 1, formState: oldState, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] });
  const { result } = renderHook(() => useEventForm({ eventId: source.id, initialEvent: source, initialDraft: { id: "old-draft", revision: 1, document } }));
  expect(result.current.formState).toMatchObject({ teams_enabled: true, min_team_size: "2", max_team_size: "4", team_deadline: "2026-11-16T11:00", teams_configuration_initialized: true });
  act(() => result.current.handleFieldChange("max_team_size", "5"));
  expect(result.current.hasUnsavedChanges).toBe(true);
});

it("retains hidden team settings through draft save/reload and event payloads", async () => {
  const source = { ...event, teams_enabled: true, min_team_size: 2, max_team_size: 4, team_deadline: "2026-11-16T18:00:00Z" };
  const { result, unmount } = renderHook(() => useEventForm({ eventId: source.id, initialEvent: source }));
  act(() => result.current.handleFieldChange("teams_enabled", false));
  await act(async () => { await result.current.handleSaveDraft(); });
  const sent = vi.mocked(saveAdminEventDraftAction).mock.calls.at(-1)![0];
  expect(sent.document.formState).toMatchObject({ teams_enabled: false, min_team_size: "2", max_team_size: "4", team_deadline: "2026-11-16T11:00" });
  unmount();
  const reopened = renderHook(() => useEventForm({ eventId: source.id, initialEvent: source, initialDraft: { id: sent.id, revision: 1, document: parseWorkingDocument(sent.document) } }));
  expect(reopened.result.current.hasUnsavedChanges).toBe(false);
  await act(async () => { await reopened.result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>); });
  expect(reopened.result.current.error).toBeNull();
  expect(saveAdminEventAction).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ teams_enabled: false, min_team_size: 2, max_team_size: 4, team_deadline: "2026-11-16T18:00:00.000Z" }) }));
});

it("saves incomplete team settings in a working document", async () => {
  const { result } = renderHook(() => useEventForm({}));
  act(() => { result.current.handleFieldChange("teams_enabled", true); result.current.handleFieldChange("min_team_size", "0"); result.current.handleFieldChange("team_deadline", "2099-01-01T"); });
  await act(async () => { await result.current.handleSaveDraft(); });
  expect(result.current.error).toBeNull();
  expect(saveAdminEventDraftAction).toHaveBeenLastCalledWith(expect.objectContaining({ document: expect.objectContaining({ formState: expect.objectContaining({ teams_enabled: true, min_team_size: "0", team_deadline: "2099-01-01T" }) }) }));
});

it("starts new schedules off and restores old drafts from the event's saved choice", () => {
  const fresh = renderHook(() => useEventForm({}));
  expect(fresh.result.current.formState.agenda_enabled).toBe(false);
  fresh.unmount();
  const oldState = Object.fromEntries(Object.entries(defaultFormState).filter(([key]) => !["agenda_enabled", "schedule_configuration_initialized"].includes(key)));
  const document = parseWorkingDocument({ version: 1, formState: oldState, checkInEvents: [], mentors: [], sponsors: [], applicationTemplate: [] });
  for (const enabled of [true, false]) {
    const reopened = renderHook(() => useEventForm({ eventId: event.id, initialEvent: { ...event, agenda_enabled: enabled }, initialDraft: { id: "old-draft", revision: 1, document } }));
    expect(reopened.result.current.formState.agenda_enabled).toBe(enabled);
    reopened.unmount();
  }
});

it.each([true, false])("round-trips schedule visibility %s through working drafts and the event save", async enabled => {
  const source = { ...event, agenda_enabled: !enabled };
  const { result, unmount } = renderHook(() => useEventForm({ eventId: source.id, initialEvent: source }));
  act(() => result.current.handleFieldChange("agenda_enabled", enabled));
  expect(result.current.hasUnsavedChanges).toBe(true);
  await act(async () => { await result.current.handleSaveDraft(); });
  const sent = vi.mocked(saveAdminEventDraftAction).mock.calls.at(-1)![0];
  unmount();
  const reopened = renderHook(() => useEventForm({ eventId: source.id, initialEvent: source, initialDraft: { id: sent.id, revision: 1, document: parseWorkingDocument(sent.document) } }));
  expect(reopened.result.current.formState.agenda_enabled).toBe(enabled);
  expect(reopened.result.current.hasUnsavedChanges).toBe(false);
  vi.mocked(saveAdminEventAction).mockResolvedValueOnce({ error: "Offline" });
  const submit = () => reopened.result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);
  await act(async () => { await submit(); });
  expect(reopened.result.current.error).toBe("Offline");
  expect(reopened.result.current.formState.agenda_enabled).toBe(enabled);
  await act(async () => { await submit(); });
  expect(reopened.result.current.error).toBeNull();
  expect(saveAdminEventAction).toHaveBeenLastCalledWith(expect.objectContaining({ event: expect.objectContaining({ agenda_enabled: enabled }) }));
});

describe("builder publication commands", () => {
  it("reveals required issues only after attempting Publish and keeps incomplete drafts savable", async () => {
    const { result } = renderHook(() => useEventForm({}));
    expect(result.current.publishAttempted).toBe(false);
    expect(result.current.validation.issues.some(issue => issue.required)).toBe(true);
    await act(async () => { await result.current.handleSaveDraft(false); });
    expect(result.current.publishAttempted).toBe(false);
    await act(async () => { expect(await result.current.handlePublication("publish")).toBe(false); });
    expect(result.current.publishAttempted).toBe(true);
    expect(result.current.validationAttempt).toBe(1);
    expect(saveAdminEventAction).not.toHaveBeenCalled();
  });
  it("sends the loaded lifecycle precondition and reports the actual saved outcome", async () => {
    const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: event }));
    vi.mocked(saveAdminEventAction).mockResolvedValueOnce({ id: event.id, checkInSessionIds: [], questionIds: [], publication: { id: event.id, name: "Saved name", status: "active", publish_at: null, registration_opens_at: event.registration_opens_at, registration_closes_at: null } });
    await act(async () => { expect(await result.current.handlePublication("publish")).toBe(true); });
    expect(vi.mocked(saveAdminEventAction).mock.calls.at(-1)![0]).toMatchObject({ expectedPublication: { status: "draft", publish_at: event.publish_at }, event: { status: "active", publish_at: null } });
    expect(result.current.publicationSuccess).toMatchObject({ name: "Saved name", status: "active" });
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
  it("retains scheduled edits after failure and retries the latest values", async () => {
    const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: event }));
    act(() => result.current.handleFieldChange("name", "Edited name"));
    vi.mocked(saveAdminEventAction).mockResolvedValueOnce({ error: "Connection lost" });
    await act(async () => { expect(await result.current.handlePublication("save")).toBe(false); });
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.publicationSuccess).toBeNull();
    const options = vi.mocked(toast.error).mock.calls.at(-1)![1]!;
    expect(options.duration).toBe(Infinity);
    act(() => result.current.handleFieldChange("name", "Edited after failure"));
    await act(async () => { options.action!.onClick(); });
    expect(vi.mocked(saveAdminEventAction).mock.calls.at(-1)![0].event.name).toBe("Edited after failure");
  });
});
