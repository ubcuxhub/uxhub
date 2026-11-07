// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import type { EventRow } from "@/lib/supabase/models";
import { defaultFormState, getInitialFormState } from "../components/event-form/event-form-schema";
import { useEventForm } from "./use-event-form";
import { toast } from "@/components/ui/toast";
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("./use-unsaved-changes-guard", () => ({ useUnsavedChangesGuard: vi.fn() }));
vi.mock("@/features/admin/actions", () => ({
  saveAdminEventDraftAction: vi.fn(async () => ({ id: "draft-1", revision: 1 })),
  saveAdminEventAction: vi.fn(async () => ({ id: "event-1" })),
  deleteAdminEventAction: vi.fn(),
  discardUnusedEventImageAction: vi.fn(),
}));
import { saveAdminEventAction, saveAdminEventDraftAction } from "@/features/admin/actions";

beforeEach(() => {
  localStorage.clear();
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
      "configured_marketing_mode", "configured_marketing_url", "configured_slug", "configured_slug_edited", "created_at", "description", "description_rich", "ends_at", "event_colour", "event_type", "header_colour", "header_image_url", "image_url", "is_featured",
      "location_address_url", "location_building", "location_room",
      "max_capacity", "mentors_enabled", "name", "publish_at",
      "registration_closes_at", "registration_opens_at",
      "requires_application", "short_description", "sponsors_enabled",
      "starts_at", "status",
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


it("preserves untouched legacy question defaults during a branding save", async () => {
  const question = { id: "question-1", event_id: event.id, created_at: null, updated_at: null, question: "Why?", description: null, response_type: "short_text" as const, is_required: false, sort_order: 0, max_char_limit: null, response_options: [], restrict_file_types: false, allowed_file_types: [], max_file_size_bytes: null };
  const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: event, initialApplicationQuestions: [question], initialCheckInSessions: [{ id: "session-1", event_id: event.id, created_at: null, updated_at: null, name: "Doors", start_time: event.starts_at, end_time: event.ends_at }] }));
  act(() => result.current.handleFieldChange("event_colour", "#C983C7"));
  await act(async () => { await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>); });
  expect(result.current.error).toBeNull();
  expect(saveAdminEventAction).toHaveBeenCalledWith(expect.objectContaining({ applicationQuestions: [expect.objectContaining({ max_char_limit: null, response_options: [], allowed_file_types: [] })] }));
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
