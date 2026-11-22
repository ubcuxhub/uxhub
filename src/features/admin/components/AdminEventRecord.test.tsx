// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { RecordFrame } from "@/components/shared/RecordDrawer";
import type { EventRow } from "@/lib/supabase/models";
import { AdminEventRecord, type AdminEventRecordProps } from "./AdminEventRecord";

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => `/admin/events/${EVENT_ID}`,
}));
vi.mock("../event-overview-actions", () => ({ cancelEventAction: vi.fn(), loadEventLifecycleCountsAction: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: EVENT_ID,
    name: "Portfolio Night",
    short_description: "Show your work.",
    description: "A night of portfolio reviews.",
    description_rich: null,
    working_document: null, working_revision: 0, legacy_draft_ids: [], canceled_at: null, cancellation_note: null,
    configured_marketing_mode: null,
    configured_marketing_url: null,
    configured_price: null,
    configured_pricing_mode: null,
    configured_slug: null,
    configured_slug_edited: true,
    revision: 0,
    pricing_policy: "legacy",
    first_published_at: null,
    status: "active",
    publish_at: null,
    event_type: "regular",
    regular_price: 0,
    member_price: 0,
    max_capacity: 40,
    reminder_schedule: "off",
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
    agenda_enabled: false,
    event_colour: null,
    header_colour: null,
    header_image_url: null,
    is_featured: false,
    location_address: null,
    location_type: "in_person",
    marketing_url: null,
    max_team_size: null,
    min_team_size: null,
    team_deadline: null,
    teams_enabled: false,
    ...overrides,
  };
}

const counts = { submitted: 3, accepted: 1, rejected: 0, waitlisted: 0, total: 4 };

function renderRecord(props: Partial<AdminEventRecordProps> = {}) {
  return render(
    <RecordFrame listHref="/admin/events">
      <AdminEventRecord
        event={event()}
        seats={{ tickets: 10, seatsLeft: 30 }}
        checkedIn={2}
        applications={counts}
        now="2026-11-05T20:00:00.000Z"
        publicPages
        {...props}
      />
    </RecordFrame>
  );
}

beforeAll(() => {
  // The date and time fields' popovers measure themselves.
  globalThis.ResizeObserver ??= class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView ??= vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdminEventRecord overview", () => {
  it("shows the event, its state and who's coming", () => {
    renderRecord();

    expect(screen.getByRole("heading", { level: 2, name: "Portfolio Night" })).toBeTruthy();
    expect(screen.getByText("Thu, Nov 19 7:00 PM–9:00 PM")).toBeTruthy();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Registration open").length).toBeGreaterThan(0);

    const registrations = screen.getByRole("group", { name: "Registrations" });
    expect(registrations.textContent).toContain("10 / 40");
    expect(within(registrations).getByText("30 spots left")).toBeTruthy();
    expect(within(registrations).getByText("Checked in").nextElementSibling?.textContent).toBe("2");
    // The one card replaces the separate stat cards.
    expect(document.querySelector("[data-slot='stat-card']")).toBeNull();
    expect(screen.queryByRole("group", { name: "Registered" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Seats left" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Applications" })).toBeNull();
    expect(screen.getAllByText("Free")).toHaveLength(2);
  });

  it("shows the event's icon as a square thumbnail, or a placeholder without one", () => {
    const { unmount } = renderRecord({ event: event({ image_url: "https://store/icon.png" }) });
    // The drawer renders in a portal, outside the render container.
    let tile = document.querySelector("[data-slot='record-thumbnail']");
    expect(tile?.querySelector("img")?.getAttribute("src")).toBe("https://store/icon.png");
    expect(tile?.className).toContain("sm:size-24");
    expect(document.querySelectorAll("img")).toHaveLength(1);
    unmount();

    renderRecord();
    tile = document.querySelector("[data-slot='record-thumbnail']");
    expect(tile).not.toBeNull();
    expect(tile?.querySelector("img")).toBeNull();
  });

  it("links to the builder, check-in and the public page", () => {
    renderRecord();

    expect(screen.getByRole("link", { name: "Edit event" }).getAttribute("href")).toBe(
      `/admin/events/${EVENT_ID}/edit`
    );
    expect(screen.getByRole("link", { name: "Check-in" }).getAttribute("href")).toBe(
      `/admin/events/${EVENT_ID}/check-in?returnTo=${encodeURIComponent(`/admin/events/${EVENT_ID}`)}`
    );
    const publicPage = screen.getByRole("link", { name: /^View marketing page/ });
    expect(publicPage.textContent).toBe("View marketing page (opens in a new tab)");
    expect(publicPage.getAttribute("href")).toBe("/events/portfolio-night");
    expect(publicPage.getAttribute("target")).toBe("_blank");
    expect(screen.queryByRole("link", { name: /Review applications/ })).toBeNull();
  });

  it("expands to the event manager's Overview, not the builder", () => {
    renderRecord();
    expect(screen.getByRole("link", { name: "Open as full page" }).getAttribute("href")).toBe(
      `/admin/events/${EVENT_ID}/overview`
    );
  });

  it("previews drafts even while public browsing is gated", () => {
    renderRecord({ event: event({ status: "draft" }) });
    expect(screen.getByRole("link", { name: /View marketing page/ }).getAttribute("href")).toBe("/events/portfolio-night?preview=draft");
    cleanup();
    renderRecord({ publicPages: false });
    expect(screen.queryByRole("link", { name: /View marketing page/ })).toBeNull();
  });

  it("shows applications and how many wait for review when the event takes them", () => {
    renderRecord({ event: event({ requires_application: true }) });

    const applications = screen.getByRole("group", { name: "Applications" });
    expect(within(applications).getByRole("link", { name: "4 in total" })).toBeTruthy();
    expect(within(applications).getByRole("link", { name: "3 to review" })).toBeTruthy();
    expect(within(applications).getByRole("link", { name: "1 accepted" })).toBeTruthy();
    const review = screen.getByRole("link", { name: /^Review applications/ });
    expect(review.getAttribute("href")).toBe(`/admin/events/${EVENT_ID}/review-applications`);
    expect(review.textContent).toBe("Review applications3 to review");
  });

  it("reads an event without a capacity as unlimited", () => {
    renderRecord({ event: event({ max_capacity: null }), seats: { tickets: 10, seatsLeft: null } });
    const registrations = screen.getByRole("group", { name: "Registrations" });
    expect(within(registrations).getByText("No capacity limit")).toBeTruthy();
    expect(registrations.textContent).not.toContain("/");
  });

  it("says when a draft publishes itself", () => {
    renderRecord({ event: event({ status: "draft", publish_at: "2026-11-12T18:00:00.000Z" }) });

    expect(screen.getAllByText("Scheduled Nov 12").length).toBeGreaterThan(0);
    expect(screen.getByText("Nov 12, 2026, 11:00 AM")).toBeTruthy();
    expect(screen.getByText("Opens once the event is active")).toBeTruthy();
  });
});

describe("AdminEventRecord schedule section", () => {
  it("shows the status and schedule read-only, with a link to Overview", () => {
    renderRecord({
      event: event({
        registration_opens_at: "2026-11-10T17:00:00.000Z",
        registration_closes_at: "2026-11-19T06:00:00.000Z",
      }),
    });

    expect(screen.getByRole("heading", { name: "Status and registration schedule" })).toBeTruthy();
    expect(screen.getByText("Registration opens")).toBeTruthy();
    expect(screen.getByText("Nov 10, 2026, 10:00 AM")).toBeTruthy();
    expect(screen.getByText("Nov 18, 2026, 11:00 PM")).toBeTruthy();

    // No in-place editing: no Change button, no save footer, no fields.
    expect(screen.queryByRole("button", { name: /Change status/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save schedule" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.queryByLabelText("Status")).toBeNull();
    expect(screen.getByRole("link", { name: "Change on Overview" }).getAttribute("href")).toBe(
      `/admin/events/${EVENT_ID}/overview`
    );
    expect(screen.getByRole("link", { name: "Edit event" })).toBeTruthy();
  });

  it("drops the Overview link for a canceled event", () => {
    renderRecord({ event: event({ canceled_at: "2026-11-01T00:00:00.000Z" }) });
    expect(screen.queryByRole("link", { name: "Change on Overview" })).toBeNull();
  });
});
