// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/supabase/models";
import { EventOverview, type EventOverviewProps } from "./EventOverview";

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
const updateEventScheduleAction = vi.hoisted(() => vi.fn());
vi.mock("../../event-overview-actions", () => ({ updateEventScheduleAction }));

const event = {
  id: EVENT_ID,
  name: "UXathon 2027",
  status: "active",
  publish_at: null,
  canceled_at: null,
  revision: 0,
  requires_application: true,
  max_capacity: 40,
  regular_price: 15,
  member_price: 10,
  starts_at: "2027-01-16T17:00:00.000Z",
  ends_at: "2027-01-17T01:00:00.000Z",
  registration_opens_at: null,
  registration_closes_at: "2027-01-10T07:59:00.000Z",
  location_building: "Nest",
  location_room: "2500",
} as EventRow;

function renderOverview(props: Partial<EventOverviewProps> = {}) {
  return render(
    <EventOverview
      event={event}
      seats={{ tickets: 12, heldOffers: 2, seatsLeft: 26 }}
      checkedIn={3}
      applications={{ submitted: 4, accepted: 6, waitlisted: 2, rejected: 3, total: 15 }}
      registrations={[
        { id: "t2", name: "Ada Lovelace" },
        { id: "t1", name: "Grace Hopper" },
      ]}
      needsAction={[]}
      now="2026-11-21T20:00:00.000Z"
      {...props}
    />
  );
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  updateEventScheduleAction.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("EventOverview", () => {
  it("says when nothing needs action", () => {
    renderOverview();
    expect(screen.getByText("Nothing needs action")).toBeTruthy();
  });

  it("lists what needs action, with a link to review", () => {
    renderOverview({
      needsAction: [
        { kind: "review", type: "todo", count: 4 },
        { kind: "registration-closes", type: "deadline", at: "2026-11-25T20:00:00.000Z" },
      ],
    });
    expect(screen.getByText("4 applications waiting for review")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe(
      `/admin/events/${EVENT_ID}/review-applications`
    );
    expect(screen.getByText(/^Registration closes Nov 25, 2026, /)).toBeTruthy();
  });

  it("lists registrations newest first, each Going", () => {
    renderOverview();
    const list = screen.getByRole("list", { name: "Registrations, newest first" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Ada Lovelace");
    expect(rows[1].textContent).toContain("Grace Hopper");
    expect(within(rows[0]).getByText("Going")).toBeTruthy();
  });

  it("shows the registration numbers", () => {
    renderOverview();
    const card = screen.getByRole("group", { name: "Registrations" });
    expect(card.textContent).toContain("12 / 40");
    expect(within(card).getByText("26 spots left")).toBeTruthy();
    expect(within(card).getByText("Checked in")).toBeTruthy();
    const applications = within(card).getByRole("group", { name: "Applications" });
    expect(within(applications).getByRole("link", { name: "15 in total" })).toBeTruthy();
    expect(within(applications).getByRole("link", { name: "6 accepted" })).toBeTruthy();
  });

  it("leaves applications out of the numbers for an open-registration event", () => {
    renderOverview({ event: { ...event, requires_application: false } });
    expect(screen.queryByRole("group", { name: "Applications" })).toBeNull();
  });

  it("shows the event's details and opens the schedule quick edit", () => {
    renderOverview();
    expect(screen.getByText("Application required")).toBeTruthy();
    expect(screen.getByText("Nest, 2500")).toBeTruthy();
    expect(screen.getByText("$15.00 · $10.00 for members")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Change status and registration schedule" }));
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Save schedule" })).toBeNull();
  });

  it("saves the schedule from the quick edit", async () => {
    updateEventScheduleAction.mockResolvedValue({ ok: true, event });
    renderOverview();
    fireEvent.click(screen.getByRole("button", { name: "Change status and registration schedule" }));

    const date = screen.getByLabelText("Registration opening date");
    fireEvent.focus(date);
    fireEvent.change(date, { target: { value: "Nov 10, 2026" } });
    fireEvent.blur(date);
    const time = screen.getByLabelText("Registration opening time");
    fireEvent.focus(time);
    fireEvent.change(time, { target: { value: "9:00 AM" } });
    fireEvent.blur(time);
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));

    await waitFor(() => expect(updateEventScheduleAction).toHaveBeenCalled());
    expect(updateEventScheduleAction.mock.calls[0][1]).toMatchObject({
      registration_opens_at: "2026-11-10T16:00:00.000Z",
    });
  });
});
