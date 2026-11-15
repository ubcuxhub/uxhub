import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecordNotFound } from "@/components/shared/RecordDrawer";
import type { EventRow } from "@/lib/supabase/models";

vi.mock("server-only", () => ({}));

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";
const SLUG = "portfolio-night";

const calls = vi.hoisted(() => [] as string[]);
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  fetchEventById: vi.fn(),
  fetchEventSeatCounts: vi.fn(),
  fetchEventApplicationStatusCounts: vi.fn(),
  fetchEventBySlug: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase-helpers/events", () => ({
  fetchEventById: mocks.fetchEventById,
  fetchEventBySlug: mocks.fetchEventBySlug,
}));
vi.mock("@/lib/supabase-helpers/event-tickets", () => ({
  fetchEventSeatCounts: mocks.fetchEventSeatCounts,
}));
vi.mock("@/lib/supabase-helpers/event-applications", () => ({
  fetchEventApplicationStatusCounts: mocks.fetchEventApplicationStatusCounts,
}));
// The client halves only need to be identifiable here.
vi.mock("@/features/admin/components/AdminEventRecord", () => ({
  AdminEventRecord: function AdminEventRecord() {
    return null;
  },
}));
vi.mock("@/components/shared/RecordDrawer", () => ({
  RecordNotFound: function RecordNotFound() {
    return null;
  },
}));

import { AdminEventRecordRoute } from "./AdminEventRecordRoute";

const counts = { submitted: 2, accepted: 1, rejected: 0, waitlisted: 0, total: 3 };

function event(overrides: Partial<EventRow> = {}) {
  return { id: EVENT_ID, slug: SLUG, max_capacity: 40, ...overrides } as EventRow;
}

/** Serve `row` for both lookups, as the database would for its slug and ID. */
function serve(row: EventRow | null) {
  mocks.fetchEventBySlug.mockImplementation(async (_client: unknown, slug: string) => {
    calls.push("fetch");
    return row && row.slug === slug ? row : null;
  });
  mocks.fetchEventById.mockImplementation(async (_client: unknown, id: string) => {
    calls.push("fetch");
    return row && row.id === id ? row : null;
  });
}

async function route(eventParam: string) {
  const element = await AdminEventRecordRoute({ eventParam });
  expect(isValidElement(element)).toBe(true);
  return element as ReactElement<Record<string, unknown>> & { type: { name: string } };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  mocks.requireAdmin.mockImplementation(async () => {
    calls.push("guard");
  });
  serve(event());
  mocks.fetchEventSeatCounts.mockResolvedValue(
    new Map([[EVENT_ID, { tickets: 12, heldOffers: 1, seatsLeft: 27 }]])
  );
  mocks.fetchEventApplicationStatusCounts.mockResolvedValue(counts);
});

describe("AdminEventRecordRoute", () => {
  it("guards, resolves the slug, then renders the record", async () => {
    const element = await route(SLUG);

    expect(calls).toEqual(["guard", "fetch"]);
    expect(mocks.fetchEventBySlug).toHaveBeenCalledWith({}, SLUG);
    // Everything after the slug is queried by the event's ID.
    expect(mocks.fetchEventSeatCounts).toHaveBeenCalledWith({}, [EVENT_ID]);
    expect(mocks.fetchEventApplicationStatusCounts).toHaveBeenCalledWith({}, EVENT_ID);
    expect(element.type.name).toBe("AdminEventRecord");
    expect(element.props).toMatchObject({
      event: { id: EVENT_ID },
      seats: { tickets: 12, seatsLeft: 27 },
      applications: counts,
    });
  });

  it("stops at the guard for someone who isn't an admin", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT /401"));

    await expect(AdminEventRecordRoute({ eventParam: SLUG })).rejects.toThrow("/401");
    expect(mocks.fetchEventById).not.toHaveBeenCalled();
    expect(mocks.fetchEventBySlug).not.toHaveBeenCalled();
  });

  it("falls back to the capacity when the seat count has no row", async () => {
    mocks.fetchEventSeatCounts.mockResolvedValue(new Map());

    const element = await route(SLUG);

    expect(element.props.seats).toEqual({ tickets: 0, seatsLeft: 40 });
  });

  it("shows not found in the drawer for an unknown slug, without a uuid query", async () => {
    expect((await route("nope")).type).toBe(RecordNotFound);
    expect(mocks.fetchEventById).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("shows not found in the drawer for an unknown ID", async () => {
    serve(null);

    expect((await route(EVENT_ID)).type).toBe(RecordNotFound);
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects an event ID to the slug", async () => {
    await expect(AdminEventRecordRoute({ eventParam: EVENT_ID })).rejects.toThrow(
      `NEXT_REDIRECT /admin/events/${SLUG}`
    );
    expect(mocks.fetchEventSeatCounts).not.toHaveBeenCalled();
  });
});
