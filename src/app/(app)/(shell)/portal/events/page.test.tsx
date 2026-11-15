// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { EventRow, EventStatus, RoleAccess } from "@/lib/supabase/models";

const fixtures = vi.hoisted(() => ({
  role: "basic" as RoleAccess,
  events: [] as EventRow[],
  fetchEvents: vi.fn(),
}));
vi.mock("@/lib/flags", () => ({ FLAGS: { studentEvents: true } }));
vi.mock("@/lib/auth/guards", () => ({
  requireAuth: async () => ({ id: "user-1", role_access: fixtures.role }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEvents: fixtures.fetchEvents }));
vi.mock("@/features/events/lib/event-states", () => ({
  loadEventStates: async (_db: unknown, _user: string, events: EventRow[]) =>
    Object.fromEntries(events.map((event) => [event.id, { kind: "reg-open", closesAt: null }])),
}));
vi.mock("@/components/shared/PageContainer", () => ({
  PageContainer: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

import PortalEvents from "./page";

const event = (slug: string, status: EventStatus) =>
  ({
    id: slug,
    slug,
    name: slug,
    status,
    starts_at: "2099-01-09T18:00:00Z",
    ends_at: null,
    location_building: null,
    location_room: null,
    image_url: null,
  }) as EventRow;

const NOTE = "Draft events are only visible to admins and managers.";

async function renderPage() {
  render(await PortalEvents());
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  // Stands in for RLS and the status filter: only the requested statuses come back.
  fixtures.fetchEvents.mockImplementation(
    async (_db: unknown, { statuses }: { statuses: EventStatus[] }) =>
      fixtures.events.filter((row) => statuses.includes(row.status))
  );
  fixtures.events = [event("kickoff", "active"), event("preview", "draft")];
});

it.each<RoleAccess>(["admin", "manager"])(
  "lists drafts to a %s, badged and under the staff-only note",
  async (role) => {
    fixtures.role = role;
    await renderPage();
    expect(fixtures.fetchEvents).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ statuses: ["active", "draft"] })
    );
    expect(screen.getByRole("link", { name: /preview/ })).toBeTruthy();
    expect(screen.getByText("Draft event")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toBe(NOTE);
  }
);

it("lists only active events to a student, with no draft badge or note", async () => {
  fixtures.role = "basic";
  await renderPage();
  expect(fixtures.fetchEvents).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ statuses: ["active"] })
  );
  expect(screen.getByRole("link", { name: /kickoff/ })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /preview/ })).toBeNull();
  expect(screen.queryByText("Draft event")).toBeNull();
  expect(screen.queryByText(NOTE)).toBeNull();
});

it("hides the note from staff when there are no drafts", async () => {
  fixtures.role = "admin";
  fixtures.events = [event("kickoff", "active")];
  await renderPage();
  expect(screen.getByRole("link", { name: /kickoff/ })).toBeTruthy();
  expect(screen.queryByText(NOTE)).toBeNull();
  expect(screen.queryByText("Draft event")).toBeNull();
});

it("hides the note when the only draft is undated, so not listed", async () => {
  fixtures.role = "admin";
  fixtures.events = [event("kickoff", "active"), { ...event("unscheduled", "draft"), starts_at: null }];
  await renderPage();
  expect(screen.queryByRole("link", { name: /unscheduled/ })).toBeNull();
  expect(screen.queryByText(NOTE)).toBeNull();
});
