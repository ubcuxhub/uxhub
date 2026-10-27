// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormEvent } from "react";
import type { EventRow } from "@/lib/supabase/models";
import { useEventForm } from "./use-event-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("./use-event-form-draft", () => ({
  useEventFormDraft: () => ({ clearDraft: vi.fn() }),
}));
vi.mock("./use-unsaved-changes-guard", () => ({ useUnsavedChangesGuard: vi.fn() }));
vi.mock("@/features/admin/actions", () => ({
  saveAdminEventAction: vi.fn(async () => ({ id: "event-1" })),
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
  publish_at: "2024-07-01T17:00:00Z",
  mentors_enabled: false,
  sponsors_enabled: false,
  applications_enabled: false,
} as EventRow;

// These dates use historical Pacific offsets so timezone rule updates cannot
// change the expected values for a future year.
describe("event form publishing schedule", () => {
  it.each(["active", "archived"] as const)("cancels scheduling when changing to %s", (status) => {
    const { result } = renderHook(() => useEventForm({ eventId: event.id, initialEvent: event }));
    act(() => result.current.handleFieldChange("status", status));
    expect(result.current.formState.status).toBe(status);
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
});
