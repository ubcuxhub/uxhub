// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
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

  it("links to the event editor and respects student-event visibility", () => {
    const event = { id: "event-id", slug: "design-sprint", name: "Design Sprint", image_url: null, short_description: "Design together." };
    const { rerender } = render(<DashboardUpcomingEvent event={event} rsvpCount={0} showStudentLink />);
    expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe("/admin/events/event-id");
    expect(screen.getByRole("link", { name: "See More" }).getAttribute("href")).toBe("/portal/events/design-sprint");
    expect(screen.getByText("0 RSVPs")).toBeTruthy();
    rerender(<DashboardUpcomingEvent event={event} rsvpCount={null} showStudentLink={false} />);
    expect(screen.queryByRole("link", { name: "See More" })).toBeNull();
    expect(screen.getByText("RSVPs unavailable")).toBeTruthy();
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
    expect((screen.getByRole("button", { name: "Drive: link coming soon" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("User activity will appear here.")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading statistics" })).toBeTruthy();
  });
});
