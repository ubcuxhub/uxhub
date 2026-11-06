// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordFrame } from "@/components/shared/RecordDrawer";
import type { EventRow } from "@/lib/supabase/models";
import { AdminEventRecord, type AdminEventRecordProps } from "./AdminEventRecord";

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => `/admin/events/${EVENT_ID}`,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/load-document", () => ({ loadDocument: vi.fn() }));

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: EVENT_ID,
    name: "Portfolio Night",
    short_description: "Show your work.",
    description: "A night of portfolio reviews.",
    status: "active",
    publish_at: null,
    event_type: "regular",
    regular_price: 0,
    member_price: 0,
    max_capacity: 40,
    // 7–9 PM on Nov 19 in Vancouver, which keeps daylight time all year.
    starts_at: "2026-11-20T02:00:00.000Z",
    ends_at: "2026-11-20T04:00:00.000Z",
    registration_opens_at: null,
    registration_closes_at: null,
    location_building: "Nest",
    location_room: "2500",
    location_address_url: null,
    image_url: null,
    description_images: [],
    agenda: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: null,
    mentors_enabled: false,
    sponsors_enabled: false,
    requires_application: false,
    slug: "portfolio-night",
    ...overrides,
  };
}

const counts = { submitted: 3, accepted: 1, rejected: 0, waitlisted: 0, total: 4 };

function renderRecord(props: Partial<AdminEventRecordProps> = {}) {
  return render(
    <RecordFrame mode="canonical" listHref="/admin/events" listLabel="Back to Manage Events">
      <AdminEventRecord
        event={event()}
        seats={{ tickets: 10, seatsLeft: 30 }}
        applications={counts}
        now="2026-11-05T20:00:00.000Z"
        publicPages
        {...props}
      />
    </RecordFrame>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminEventRecord overview", () => {
  it("shows the event, its state and who's coming", () => {
    renderRecord();

    expect(screen.getByRole("heading", { level: 1, name: "Portfolio Night" })).toBeTruthy();
    expect(screen.getByText("Thu, Nov 19 7:00 PM–9:00 PM")).toBeTruthy();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Registration open").length).toBeGreaterThan(0);

    const registered = screen.getByRole("group", { name: "Registered" });
    expect(within(registered).getByText("10 of 40 seats")).toBeTruthy();
    expect(within(screen.getByRole("group", { name: "Seats left" })).getByText("30")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Applications" })).toBeNull();
    expect(screen.getAllByText("Free")).toHaveLength(2);
  });

  it("links to the builder, check-in and the public page", () => {
    renderRecord();

    expect(screen.getByRole("link", { name: "Edit event" }).getAttribute("href")).toBe(
      `/admin/events/${EVENT_ID}/edit`
    );
    expect(screen.getByRole("link", { name: "Check-in" }).getAttribute("href")).toBe(
      `/admin/events/${EVENT_ID}/check-in`
    );
    const publicPage = screen.getByRole("link", { name: /^View public page/ });
    expect(publicPage.textContent).toBe("View public page (opens in a new tab)");
    expect(publicPage.getAttribute("href")).toBe("/events/portfolio-night");
    expect(publicPage.getAttribute("target")).toBe("_blank");
    expect(screen.queryByRole("link", { name: /Review applications/ })).toBeNull();
  });

  it("hides the public page link for a draft, or while event pages are off", () => {
    renderRecord({ event: event({ status: "draft" }) });
    expect(screen.queryByRole("link", { name: /View public page/ })).toBeNull();
    cleanup();
    renderRecord({ publicPages: false });
    expect(screen.queryByRole("link", { name: /View public page/ })).toBeNull();
  });

  it("shows applications and how many wait for review when the event takes them", () => {
    renderRecord({ event: event({ requires_application: true }) });

    expect(within(screen.getByRole("group", { name: "Applications" })).getByText("4")).toBeTruthy();
    const review = screen.getByRole("link", { name: /^Review applications/ });
    expect(review.getAttribute("href")).toBe(`/admin/events/${EVENT_ID}/review-applications`);
    expect(review.textContent).toBe("Review applications3 to review");
  });

  it("says when a draft publishes itself", () => {
    renderRecord({ event: event({ status: "draft", publish_at: "2026-11-12T18:00:00.000Z" }) });

    expect(screen.getAllByText("Scheduled Nov 12").length).toBeGreaterThan(0);
    expect(screen.getByText("Nov 12, 2026, 11:00 AM")).toBeTruthy();
    expect(screen.getByText("Opens once the event is active")).toBeTruthy();
  });
});
