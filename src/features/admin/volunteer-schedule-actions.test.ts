import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), create: vi.fn(), warn: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/supabase-helpers/event-content", () => ({ createStaffVolunteerSchedule: mocks.create }));
vi.mock("@/lib/log", () => ({ log: { warn: mocks.warn } }));
import { createVolunteerScheduleAction } from "./volunteer-schedule-actions";
const input = { eventId: "00000000-0000-4000-8000-000000000001", operationId: "00000000-0000-4000-8000-000000000002", url: "https://example.test/private?token=secret" };
beforeEach(() => vi.resetAllMocks());
it("guards staff access before validation or writes", async () => {
  mocks.guard.mockRejectedValue(new Error("Denied"));
  await expect(createVolunteerScheduleAction(input)).rejects.toThrow("Denied");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("validates targets and HTTPS URLs before writes", async () => {
  for (const patch of [{ eventId: "invalid" }, { operationId: "invalid" }, { url: "http://example.test" }, { url: "https://user:pass@example.test" }, { url: "https://example.test/" + "x".repeat(5000) }, { url: null }]) {
    expect(await createVolunteerScheduleAction({ ...input, ...patch } as typeof input)).toMatchObject({ ok: false });
  }
  expect(mocks.create).not.toHaveBeenCalled();
});
it("returns the receipt URL and reports concurrent creation without overwriting", async () => {
  mocks.create.mockResolvedValueOnce({ url: input.url });
  expect(await createVolunteerScheduleAction(input)).toEqual({ ok: true, url: input.url });
  expect(mocks.create).toHaveBeenCalledWith({}, input);
  expect(mocks.revalidate).toHaveBeenCalledWith("/admin/events", "layout");
  mocks.create.mockRejectedValueOnce({ hint: "STAFF_SCHEDULE_EXISTS" });
  expect(await createVolunteerScheduleAction(input)).toMatchObject({ ok: false, error: expect.stringContaining("already added") });
});
it("offers retry without leaking URLs or database error text", async () => {
  mocks.create.mockRejectedValueOnce(new Error(input.url));
  expect(await createVolunteerScheduleAction(input)).toMatchObject({ ok: false, error: expect.stringContaining("Try saving again") });
  expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain(input.url);
});
