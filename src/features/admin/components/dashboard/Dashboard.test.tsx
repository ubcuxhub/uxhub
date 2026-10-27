// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/features/memberships/lib/term", () => ({ getMembershipTermEndsAt: async () => null }));
vi.mock("@/lib/log", () => ({ log: { error: vi.fn(), info: vi.fn() }, errorFields: () => ({}) }));
const reads = vi.hoisted(() => ({
  fetchActiveMemberCount: vi.fn(), fetchUpcomingEventCount: vi.fn(),
  fetchUpcomingRegistrationCount: vi.fn(), fetchNextDashboardEvent: vi.fn(),
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
  it("keeps successful metrics visible and distinguishes unavailable from zero", async () => {
    reads.fetchActiveMemberCount.mockResolvedValue(0);
    reads.fetchUpcomingEventCount.mockRejectedValue(new Error("Database unavailable"));
    reads.fetchUpcomingRegistrationCount.mockResolvedValue(12);
    render(await DashboardStats({ now: "2026-10-26T12:00:00Z" }));
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Unavailable")).toBeTruthy();
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

  it("renders disabled quick links, the activity slot, and an accessible loading state", () => {
    render(<><DashboardQuickLinks /><DashboardActivityPlaceholder /><DashboardStatsSkeleton /></>);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByText("User activity will appear here.")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading statistics" })).toBeTruthy();
  });
});
