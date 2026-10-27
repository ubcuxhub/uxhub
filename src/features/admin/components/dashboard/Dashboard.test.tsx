// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/features/memberships/lib/term", () => ({ getMembershipTermEndsAt: async () => null }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), info: vi.fn() }, errorFields: () => ({}) }));
const reads = vi.hoisted(() => ({
  fetchMembershipAnalytics: vi.fn(), fetchEventAnalytics: vi.fn(),
  fetchNextDashboardEvent: vi.fn(),
  fetchConfirmedEventRegistrationCount: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/admin-dashboard", () => reads);

import { DashboardEventData, DashboardStats, DashboardStatsSkeleton } from "./DashboardData";
import { DashboardUpcomingEvent } from "./DashboardUpcomingEvent";
import { DashboardQuickLinks } from "./DashboardQuickLinks";
import { DashboardActivityPlaceholder } from "./DashboardActivityPlaceholder";

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe("dashboard states", () => {
  it("keeps the membership slide available when event statistics fail", async () => {
    reads.fetchMembershipAnalytics.mockResolvedValue({ activeMembers: 0, buyersLast30Days: 12, tiers: [] });
    reads.fetchEventAnalytics.mockRejectedValue(new Error("Database unavailable"));
    render(await DashboardStats({ now: "2026-10-26T12:00:00Z" }));
    expect(screen.getByText("No active members")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText(/Event statistics unavailable/)).toBeTruthy();
  });

  it("distinguishes no upcoming event from a failed event query", async () => {
    reads.fetchNextDashboardEvent.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Unavailable"));
    const { unmount } = render(await DashboardEventData({ now: "2026-10-26T12:00:00Z" }));
    expect(screen.getByText("No upcoming events")).toBeTruthy();
    expect(reads.fetchConfirmedEventRegistrationCount).not.toHaveBeenCalled();
    unmount();
    render(await DashboardEventData({ now: "2026-10-26T12:00:00Z" }));
    expect(screen.queryByText("No upcoming events")).toBeNull();
    expect(screen.getByText(/Upcoming event unavailable/)).toBeTruthy();
  });

  const event = { id: "event-id", slug: "design-sprint", name: "Design Sprint", image_url: null, short_description: "Design together.", start_date: "2026-11-01", location_building: "AMS Nest", location_room: "Room 101", location_address_url: "https://maps.google.com/?q=AMS+Nest", regular_price: 12, member_price: 5 };

  it("shows event details and quick action destinations, and respects student-event visibility", async () => {
    const { rerender } = render(<DashboardUpcomingEvent event={event} rsvpCount={0} showStudentLink />);
    expect(screen.getByText("Sunday, November 1, 2026")).toBeTruthy();
    expect(screen.getByText("AMS Nest, Room 101")).toBeTruthy();
    const locationLink = screen.getByRole("link", { name: "AMS Nest, Room 101" });
    expect(locationLink.getAttribute("href")).toBe(event.location_address_url);
    expect(locationLink.getAttribute("target")).toBe("_blank");
    expect(locationLink.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("$12.00")).toBeTruthy();
    expect(screen.getByText("$5.00")).toBeTruthy();
    const actions = within(screen.getByRole("region", { name: "Quick Actions" }));
    expect(actions.getByRole("link", { name: "Edit Event Details" }).getAttribute("href")).toBe("/admin/events/event-id");
    expect(actions.getByRole("link", { name: "Check-in Participants" }).getAttribute("href")).toBe("/admin/events/event-id/check-in");
    expect(actions.getByRole("link", { name: "Review Applications" }).getAttribute("href")).toBe("/admin/events/event-id/review-applications");
    const trigger = actions.getByRole("button", { name: "View Event Page" });
    expect(screen.queryByRole("link", { name: "Marketing Page" })).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole("link", { name: "Marketing Page" }).getAttribute("href")).toBe("/events/design-sprint");
    expect(screen.getByRole("link", { name: "Sign-up Page" }).getAttribute("href")).toBe("/portal/events/design-sprint");
    fireEvent.keyDown(screen.getByRole("dialog", { name: "View Event Page" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("link", { name: "Marketing Page" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.getByText("0 RSVPs")).toBeTruthy();
    rerender(<DashboardUpcomingEvent event={event} rsvpCount={null} showStudentLink={false} />);
    expect(screen.queryByRole("button", { name: "View Event Page" })).toBeNull();
    expect(screen.getByRole("link", { name: "Edit Event Details" })).toBeTruthy();
    expect(screen.getByText("RSVPs unavailable")).toBeTruthy();
  });

  it("handles free events, optional member pricing, and missing details", () => {
    const { rerender } = render(<DashboardUpcomingEvent event={{ ...event, start_date: null, location_building: null, location_room: null, regular_price: 0, member_price: 0 }} rsvpCount={0} showStudentLink />);
    expect(screen.getAllByText("TBD")).toHaveLength(2);
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.queryByText("Members:")).toBeNull();
    rerender(<DashboardUpcomingEvent event={{ ...event, member_price: 0, location_address_url: null }} rsvpCount={0} showStudentLink />);
    expect(screen.getByText("AMS Nest, Room 101")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "AMS Nest, Room 101" })).toBeNull();
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Members:")).toBeTruthy();
    rerender(<DashboardUpcomingEvent event={{ ...event, member_price: event.regular_price }} rsvpCount={0} showStudentLink />);
    expect(screen.queryByText("Members:")).toBeNull();
  });

  it("renders external quick links, a disabled Drive placeholder, and activity and loading states", () => {
    render(<><DashboardQuickLinks /><DashboardActivityPlaceholder /><DashboardStatsSkeleton /></>);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://www.ubcuxhub.ca/",
      "https://app.notion.com/p/3342f9f09f1880038056d20a8cb5f772?v=3342f9f09f1881b68878000c67901a56&source=copy_link",
      "https://uxhub2627.slack.com/archives/C0ARSMVRV1D",
    ]);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
    expect((screen.getByRole("button", { name: "Drive" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("User activity will appear here.")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading statistics" })).toBeTruthy();
  });
});
