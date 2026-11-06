import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecordNotFound } from "@/components/shared/RecordDrawer";
import type { EventRow } from "@/lib/supabase/models";

vi.mock("server-only", () => ({}));

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";

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
vi.mock("@/features/admin/components/LoadAsDocument", () => ({
  LoadAsDocument: function LoadAsDocument() {
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
  return { id: EVENT_ID, max_capacity: 40, ...overrides } as EventRow;
}

async function route(eventParam: string, mode: "intercepted" | "canonical") {
  const element = await AdminEventRecordRoute({ eventParam, mode });
  expect(isValidElement(element)).toBe(true);
  return element as ReactElement<Record<string, unknown>> & { type: { name: string } };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  mocks.requireAdmin.mockImplementation(async () => {
    calls.push("guard");
  });
  mocks.fetchEventById.mockImplementation(async () => {
    calls.push("fetch");
    return event();
  });
  mocks.fetchEventSeatCounts.mockResolvedValue(
    new Map([[EVENT_ID, { tickets: 12, heldOffers: 1, seatsLeft: 27 }]])
  );
  mocks.fetchEventApplicationStatusCounts.mockResolvedValue(counts);
  mocks.fetchEventBySlug.mockResolvedValue(null);
});

describe("AdminEventRecordRoute", () => {
  it.each(["intercepted", "canonical"] as const)(
    "guards before fetching, then renders the record (%s)",
    async (mode) => {
      const element = await route(EVENT_ID, mode);

      expect(calls).toEqual(["guard", "fetch"]);
      expect(element.type.name).toBe("AdminEventRecord");
      expect(element.props).toMatchObject({
        event: { id: EVENT_ID },
        seats: { tickets: 12, seatsLeft: 27 },
        applications: counts,
      });
    }
  );

  it("stops at the guard for someone who isn't an admin", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT /401"));

    await expect(AdminEventRecordRoute({ eventParam: EVENT_ID, mode: "intercepted" })).rejects.toThrow("/401");
    expect(mocks.fetchEventById).not.toHaveBeenCalled();
    expect(mocks.fetchEventBySlug).not.toHaveBeenCalled();
  });

  it("falls back to the capacity when the seat count has no row", async () => {
    mocks.fetchEventSeatCounts.mockResolvedValue(new Map());

    const element = await route(EVENT_ID, "canonical");

    expect(element.props.seats).toEqual({ tickets: 0, seatsLeft: 40 });
  });

  it("404s on the page and shows not found in the drawer for a missing event", async () => {
    mocks.fetchEventById.mockResolvedValue(null);

    await expect(route(EVENT_ID, "canonical")).rejects.toThrow("NEXT_NOT_FOUND");
    expect((await route(EVENT_ID, "intercepted")).type).toBe(RecordNotFound);
  });

  it("handles an unknown slug the same way, without a uuid query", async () => {
    await expect(route("nope", "canonical")).rejects.toThrow("NEXT_NOT_FOUND");
    expect((await route("nope", "intercepted")).type).toBe(RecordNotFound);
    expect(mocks.fetchEventById).not.toHaveBeenCalled();
  });

  it.each(["intercepted", "canonical"] as const)("redirects a slug to the id (%s)", async (mode) => {
    mocks.fetchEventBySlug.mockResolvedValue({ id: EVENT_ID });

    await expect(AdminEventRecordRoute({ eventParam: "portfolio-night", mode })).rejects.toThrow(
      `NEXT_REDIRECT /admin/events/${EVENT_ID}`
    );
  });

  it("loads create-new as its own page when a soft navigation reaches the drawer", async () => {
    const element = await route("create-new", "intercepted");

    expect(element.type.name).toBe("LoadAsDocument");
    expect(element.props.href).toBe("/admin/events/create-new");
    expect(mocks.fetchEventBySlug).not.toHaveBeenCalled();
  });
});
