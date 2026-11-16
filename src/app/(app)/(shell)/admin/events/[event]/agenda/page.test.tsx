import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), client: vi.fn(), resolve: vi.fn(), event: vi.fn(), agenda: vi.fn(), schedule: vi.fn(), notFound: vi.fn(() => { throw new Error("Not found"); }) }));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/features/admin/lib/resolve-event-param", () => ({ resolveAdminEventId: mocks.resolve }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEventById: mocks.event }));
vi.mock("@/lib/supabase-helpers/event-agenda-notes", () => ({ fetchStaffAgenda: mocks.agenda }));
vi.mock("@/lib/supabase-helpers/event-content", () => ({ fetchStaffVolunteerSchedule: mocks.schedule }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/admin/components/StaffAgenda", () => ({ StaffAgenda: () => null }));
import AgendaPage from "./page";
beforeEach(() => { vi.clearAllMocks(); mocks.guard.mockResolvedValue(undefined); mocks.client.mockResolvedValue({}); mocks.resolve.mockResolvedValue("event-id"); mocks.event.mockResolvedValue({ name: "UXathon" }); mocks.agenda.mockResolvedValue([]); mocks.schedule.mockResolvedValue(null); });
it("authorizes before any staff fetch and resolves the agenda suffix for canonical slug redirects", async () => {
  mocks.guard.mockRejectedValueOnce(new Error("Denied"));
  await expect(AgendaPage({ params: Promise.resolve({ event: "slug" }) })).rejects.toThrow("Denied");
  expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.agenda).not.toHaveBeenCalled();
  const result = await AgendaPage({ params: Promise.resolve({ event: "slug" }) });
  expect(mocks.resolve).toHaveBeenCalledWith({}, "slug", "/agenda");
  expect(mocks.agenda).toHaveBeenCalledWith({}, "event-id");
  expect(result.props).toMatchObject({ eventId: "event-id", eventName: "UXathon", days: [], volunteerUrl: null });
});
it("handles missing events using the existing not-found convention", async () => {
  mocks.event.mockResolvedValueOnce(null);
  await expect(AgendaPage({ params: Promise.resolve({ event: "missing" }) })).rejects.toThrow("Not found");
});
