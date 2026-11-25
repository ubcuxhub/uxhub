// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Next supplies static-image dimensions in production; Vitest imports bare paths.
vi.mock("@/assets/hubbo/resting.png", () => ({ default: { src: "/resting.png", width: 161, height: 120 } }));
vi.mock("@/assets/hubbo/thinking.png", () => ({ default: { src: "/thinking.png", width: 113, height: 120 } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/features/memberships/lib/term", () => ({ getMembershipTermEndsAt: async () => null }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), info: vi.fn() }, errorFields: () => ({}) }));
const reads = vi.hoisted(() => ({
  fetchMajorDistribution: vi.fn(), fetchMembershipHistory: vi.fn(), fetchRecentMembershipAdditions: vi.fn(),
  fetchNextDashboardEvent: vi.fn(),
  fetchEventSeatCounts: vi.fn(),
}));
vi.mock("@/lib/supabase-helpers/admin-dashboard", () => reads);
vi.mock("@/lib/supabase-helpers/event-tickets", () => ({ fetchEventSeatCounts: reads.fetchEventSeatCounts }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DashboardEventData, DashboardMajorData, DashboardMembershipData } from "./DashboardData";
import { StatisticsCard } from "@/components/shared/StatisticsCard";
import { DashboardUpcomingEvent } from "./DashboardUpcomingEvent";
import { DashboardQuickLinks } from "./DashboardQuickLinks";
import { DashboardActivityPlaceholder } from "./DashboardActivityPlaceholder";

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe("dashboard states", () => {
  it("loads rolling additions using the same server cutoff as membership history", async () => {
    reads.fetchMembershipHistory.mockResolvedValue(null);
    reads.fetchRecentMembershipAdditions.mockResolvedValue({ count: 7, coverage: "complete" });
    const now = "2026-11-21T12:00:00Z";
    const card = await DashboardMembershipData({ now });
    expect(reads.fetchMembershipHistory).toHaveBeenCalledWith({}, now);
    expect(reads.fetchRecentMembershipAdditions).toHaveBeenCalledWith({}, now);
    expect(card.props.recentAdditions).toEqual({ count: 7, coverage: "complete" });
  });

  it("keeps membership history when the rolling metric fails", async () => {
    const history = { latestAcademicYear: 2026, completeFrom: "2026-09-01T07:00:00Z", years: [] };
    reads.fetchMembershipHistory.mockResolvedValue(history);
    reads.fetchRecentMembershipAdditions.mockRejectedValue(new Error("Unavailable"));
    const card = await DashboardMembershipData({ now: "2026-11-21T12:00:00Z" });
    expect(card.props.data).toBe(history);
    expect(card.props.recentAdditions).toBeNull();
  });

  it("keeps the successful account card available when membership loading fails", async () => {
    reads.fetchMajorDistribution.mockResolvedValue({ totalAccounts: 0, majors: [] });
    reads.fetchMembershipHistory.mockRejectedValue(new Error("Database unavailable"));
    render(<>{await DashboardMajorData()}{await DashboardMembershipData({ now: "2026-10-26T12:00:00Z" })}</>);
    expect(screen.getByText("No accounts yet")).toBeTruthy();
    expect(screen.getByText("We couldn’t load club members")).toBeTruthy();
  });

  it("distinguishes no upcoming event from a failed event query", async () => {
    reads.fetchNextDashboardEvent.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Unavailable"));
    const { unmount } = render(await DashboardEventData({ now: "2026-10-26T12:00:00Z" }));
    expect(screen.getByText("No upcoming events")).toBeTruthy();
    expect(reads.fetchEventSeatCounts).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Create event" }).getAttribute("href")).toBe("/admin/events/create-new");
    unmount();
    render(await DashboardEventData({ now: "2026-10-26T12:00:00Z" }));
    expect(screen.queryByText("No upcoming events")).toBeNull();
    expect(screen.getByText("We couldn’t load the upcoming event")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  const now = "2026-10-26T12:00:00Z";
  const event = { id: "event-id", slug: "design-sprint", name: "Design Sprint", image_url: null, header_image_url: null, header_colour: null, short_description: "Design together.", starts_at: "2026-11-02T01:00:00Z", ends_at: "2026-11-04T01:00:00Z", location_type: "in_person" as const, location_building: "AMS Nest", location_room: "Room 101", location_address_url: "https://maps.google.com/?q=AMS+Nest", regular_price: 12, member_price: 5, max_capacity: 50, registration_opens_at: null, registration_closes_at: null, requires_application: true, canceled_at: null, cancellation_note: null, configured_marketing_mode: null, configured_marketing_url: null, marketing_url: null };
  const seats = { tickets: 40, heldOffers: 3, seatsLeft: 7 };

  it("shows real event data and canonical action destinations", async () => {
    render(<DashboardUpcomingEvent event={event} seats={seats} showStudentLink now={now} />);
    expect(screen.getByText("November 1–3, 2026")).toBeTruthy();
    expect(screen.getByText("Applications open")).toBeTruthy();
    expect(screen.getByText("40/50 spots")).toBeTruthy();
    expect(screen.getByText("$5.00 for members, $12.00 for non-members")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Design Sprint" }).getAttribute("href")).toBe("/admin/events/event-id/overview");
    const location = screen.getByRole("link", { name: "AMS Nest, Room 101" });
    expect(location.getAttribute("href")).toBe(event.location_address_url);
    expect(location.getAttribute("rel")).toBe("noopener noreferrer");
    const actions = within(screen.getByRole("region", { name: "Quick Actions" }));
    for (const [name, suffix] of [["Check-in", "check-in"], ["Applications", "review-applications"], ["Edit event", "edit"]]) {
      expect(actions.getByRole("link", { name }).getAttribute("href")).toBe(`/admin/events/event-id/${suffix}`);
    }
    const trigger = actions.getByRole("button", { name: "View full page" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(await screen.findByRole("menuitem", { name: "Marketing page" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Marketing page" }).getAttribute("href")).toBe("/events/design-sprint");
    expect(screen.getByRole("menuitem", { name: "Sign-up page" }).getAttribute("href")).toBe("/portal/events/design-sprint");
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("keeps event details when seat loading fails and never fabricates zero or Full", async () => {
    reads.fetchNextDashboardEvent.mockResolvedValue(event);
    reads.fetchEventSeatCounts.mockRejectedValue(new Error("Unavailable"));
    render(await DashboardEventData({ now }));
    expect(screen.getByText("Ticket count unavailable")).toBeTruthy();
    expect(screen.getByText("Design Sprint")).toBeTruthy();
    expect(screen.queryByText("Full")).toBeNull();
    expect(screen.queryByText("0/50 spots")).toBeNull();
  });

  it("uses held offers for fullness while showing only confirmed tickets", () => {
    const { rerender } = render(<DashboardUpcomingEvent event={{ ...event, requires_application: false }} seats={{ tickets: 40, heldOffers: 10, seatsLeft: 0 }} showStudentLink now={now} />);
    expect(screen.getByText("Full")).toBeTruthy();
    expect(screen.getByText("40/50 spots")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Applications" })).toBeNull();
    rerender(<DashboardUpcomingEvent event={{ ...event, requires_application: false, registration_closes_at: "2026-10-25T01:00:00Z" }} seats={seats} showStudentLink now={now} />);
    expect(screen.getByText("Registration closed")).toBeTruthy();
  });

  it("renders a confirmed zero and derives upcoming/canceled state from the real event", () => {
    const { rerender } = render(<DashboardUpcomingEvent event={{ ...event, requires_application: false, registration_opens_at: "2026-11-01T00:00:00Z" }} seats={{ tickets: 0, heldOffers: 0, seatsLeft: 50 }} showStudentLink now={now} />);
    expect(screen.getByText("0/50 spots")).toBeTruthy();
    expect(screen.getByText("Opens Oct 31")).toBeTruthy();
    rerender(<DashboardUpcomingEvent event={{ ...event, canceled_at: "2026-10-25T00:00:00Z" }} seats={seats} showStudentLink now={now} />);
    expect(screen.getByText("Canceled")).toBeTruthy();
  });

  it("handles unlimited capacity, missing price, online venues and unsafe map URLs", () => {
    const { rerender } = render(<DashboardUpcomingEvent event={{ ...event, max_capacity: null, regular_price: null, location_type: "online" }} seats={{ ...seats, seatsLeft: null }} showStudentLink now={now} />);
    expect(screen.getByText("40 tickets · Unlimited capacity")).toBeTruthy();
    expect(screen.getByText("Price to be confirmed")).toBeTruthy();
    expect(screen.getByText("Online")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "AMS Nest, Room 101" })).toBeNull();
    rerender(<DashboardUpcomingEvent event={{ ...event, member_price: 0, location_address_url: "javascript:alert(1)" }} seats={seats} showStudentLink now={now} />);
    expect(screen.getByText("Free for members, $12.00 for non-members")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "AMS Nest, Room 101" })).toBeNull();
  });

  it("honours feature flags and configured marketing destinations", async () => {
    const { rerender } = render(<DashboardUpcomingEvent event={event} seats={seats} showStudentLink={false} now={now} />);
    expect(screen.queryByRole("button", { name: "View full page" })).toBeNull();
    rerender(<DashboardUpcomingEvent event={{ ...event, configured_marketing_mode: "external", configured_marketing_url: "https://example.com/sprint" }} seats={seats} showStudentLink now={now} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "View full page" }), { key: "ArrowDown" });
    expect((await screen.findByRole("menuitem", { name: "Marketing page" })).getAttribute("href")).toBe("https://example.com/sprint");
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    rerender(<DashboardUpcomingEvent event={{ ...event, configured_marketing_mode: "disabled" }} seats={seats} showStudentLink now={now} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "View full page" }), { key: "ArrowDown" });
    expect(await screen.findByRole("menuitem", { name: "Sign-up page" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Marketing page" })).toBeNull();
  });

  it("renders external quick links, a disabled Drive placeholder, and activity and loading states", () => {
    render(<><DashboardQuickLinks /><DashboardActivityPlaceholder /><StatisticsCard title="Area of Study" size="compact" loading /></>);
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
    expect(screen.getByRole("status", { name: "Loading Area of Study" })).toBeTruthy();
  });
});
