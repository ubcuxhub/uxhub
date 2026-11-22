import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  client: vi.fn(),
  resolve: vi.fn(),
  event: vi.fn(),
  seats: vi.fn(),
  attendees: vi.fn(),
  statuses: vi.fn(),
  applications: vi.fn(),
  settings: vi.fn(),
  lifecycle: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("Not found");
  }),
}));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { service: true } }));
vi.mock("@/features/admin/lib/resolve-event-param", () => ({ resolveAdminEventId: mocks.resolve }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEventById: mocks.event }));
vi.mock("@/lib/supabase-helpers/event-tickets", () => ({ fetchEventSeatCounts: mocks.seats }));
vi.mock("@/lib/supabase-helpers/check-ins", () => ({
  fetchCheckInAttendees: mocks.attendees,
  fetchCheckInStatuses: mocks.statuses,
}));
vi.mock("@/lib/supabase-helpers/event-applications", () => ({
  fetchEventApplicationStatusCounts: mocks.applications,
}));
vi.mock("@/lib/supabase-helpers/event-application-settings", () => ({
  fetchEventApplicationSettings: mocks.settings,
}));
vi.mock("@/lib/supabase-helpers/event-lifecycle", () => ({ fetchEventLifecycleCounts: mocks.lifecycle }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/admin/components/event-manager/EventOverview", () => ({ EventOverview: () => null }));

import EventOverviewPage from "./page";

const page = (event = "slug") => EventOverviewPage({ params: Promise.resolve({ event }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue(undefined);
  mocks.client.mockResolvedValue({});
  mocks.resolve.mockResolvedValue("event-id");
  mocks.event.mockResolvedValue({
    id: "event-id",
    status: "active",
    requires_application: false,
    canceled_at: null,
    max_capacity: 40,
    registration_opens_at: null,
    registration_closes_at: null,
  });
  mocks.seats.mockResolvedValue(new Map([["event-id", { tickets: 2, heldOffers: 1, seatsLeft: 37 }]]));
  mocks.attendees.mockResolvedValue([
    { id: "t2", user_name: "Ada Lovelace" },
    { id: "t1", user_name: "Grace Hopper" },
  ]);
  mocks.statuses.mockResolvedValue(
    new Map([
      ["t1_s1", "2026-11-20T02:00:00.000Z"],
      ["t1_s2", "2026-11-20T03:00:00.000Z"],
      ["t2_s1", null],
      ["voided_s1", "2026-11-20T02:00:00.000Z"],
    ])
  );
});

it("authorizes before any fetch and resolves a slug to the Overview's own path", async () => {
  mocks.guard.mockRejectedValueOnce(new Error("Denied"));
  await expect(page()).rejects.toThrow("Denied");
  expect(mocks.client).not.toHaveBeenCalled();
  expect(mocks.event).not.toHaveBeenCalled();

  await page();
  expect(mocks.resolve).toHaveBeenCalledWith({}, "slug", "/overview");
});

it("passes registrations newest first and counts each checked-in holder once", async () => {
  const result = await page();
  expect(result.props).toMatchObject({
    seats: { tickets: 2, heldOffers: 1, seatsLeft: 37 },
    checkedIn: 1,
    registrations: [
      { id: "t2", name: "Ada Lovelace" },
      { id: "t1", name: "Grace Hopper" },
    ],
    applications: null,
    needsAction: [],
  });
  // No applications or cancel: nothing else to read.
  expect(mocks.applications).not.toHaveBeenCalled();
  expect(mocks.settings).not.toHaveBeenCalled();
  expect(mocks.lifecycle).not.toHaveBeenCalled();
});

it("reads review counts for an application event and paid tickets for a canceled one", async () => {
  mocks.event.mockResolvedValue({
    id: "event-id",
    status: "active",
    requires_application: true,
    canceled_at: "2026-11-01T00:00:00.000Z",
    max_capacity: 40,
    registration_opens_at: null,
    registration_closes_at: null,
  });
  const counts = { submitted: 4, accepted: 1, waitlisted: 0, rejected: 2, total: 7 };
  mocks.applications.mockResolvedValue(counts);
  mocks.settings.mockResolvedValue({ decisions_release_at: null });
  mocks.lifecycle.mockResolvedValue({ registered: 2, memberApplications: 0, paidTickets: 2 });

  const result = await page();
  expect(mocks.lifecycle).toHaveBeenCalledWith({ service: true }, "event-id");
  expect(mocks.applications).toHaveBeenCalledWith({}, "event-id");
  expect(result.props.applications).toEqual(counts);
  expect(result.props.needsAction).toEqual([{ kind: "refund", type: "todo", count: 2 }]);
});

it("is a 404 for an event that doesn't exist", async () => {
  mocks.event.mockResolvedValue(null);
  await expect(page()).rejects.toThrow("Not found");
});
