// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DashboardStatsCarousel } from "./DashboardStatsCarousel";
import type { EventAnalytics, MembershipAnalytics } from "@/lib/supabase-helpers/admin-dashboard";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const members: MembershipAnalytics = {
  activeMembers: 6, buyersLast30Days: 3,
  tiers: [{ id: "explorer", name: "Explorer", count: 2 }, { id: "innovator", name: "Innovator", count: 4 }],
};
const events: EventAnalytics = {
  currentEvent: { id: "event7", name: "Design Sprint", registrations: 24 },
  schoolYearLabel: "2026–2027", uniqueParticipants: 40,
  events: Array.from({ length: 8 }, (_, index) => ({ id: `event${index}`, name: `Event ${index}`, startsAt: `2026-10-${String(index + 10).padStart(2, "0")}T12:00:00Z`, registrations: index + 1, attendees: index })),
};

describe("statistics carousel and event chart", () => {
  it("starts on members and preserves the chart range across manual slide changes", () => {
    render(<DashboardStatsCarousel members={members} events={events} />);
    expect(screen.getByRole("heading", { name: "Members" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Events" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next statistics slide" }));
    expect(screen.getByRole("heading", { name: "Events" })).toBeTruthy();
    expect(screen.getByText("Events 3–8 of 8")).toBeTruthy();
    const chart = screen.getByRole("group", { name: "Event registration and attendance chart" });
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByText("Events 2–7 of 8")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("Events 3–7 of 8")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous statistics slide" }));
    fireEvent.click(screen.getByRole("button", { name: "Show events statistics" }));
    expect(screen.getByText("Events 3–7 of 8")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset event chart" }));
    expect(screen.getByText("Events 3–8 of 8")).toBeTruthy();
  });

  it("zooms with the wheel, scopes keyboard navigation, and bounds visible controls", () => {
    render(<DashboardStatsCarousel members={members} events={events} />);
    fireEvent.click(screen.getByRole("button", { name: "Show events statistics" }));
    const chart = screen.getByRole("group", { name: "Event registration and attendance chart" });
    vi.spyOn(performance, "now").mockReturnValue(1000);
    fireEvent.wheel(chart, { deltaY: -100 });
    expect(screen.getByText("Events 4–8 of 8")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("region", { name: "Dashboard statistics" }), { key: "ArrowLeft" });
    expect(screen.getByText("Events 4–8 of 8")).toBeTruthy();
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("Events 1–8 of 8")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Earlier events" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Later events" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Zoom out" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps empty results separate from unavailable data", () => {
    const { unmount } = render(<DashboardStatsCarousel members={{ activeMembers: 0, buyersLast30Days: 0, tiers: [] }} events={{ ...events, events: [], currentEvent: null, uniqueParticipants: 0 }} />);
    expect(screen.getByText("No active members")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show events statistics" }));
    expect(screen.getByText("No published events to show.")).toBeTruthy();
    expect(screen.getByText("No upcoming event")).toBeTruthy();
    unmount();
    render(<DashboardStatsCarousel members={null} events={null} />);
    expect(screen.getByText(/Membership statistics unavailable/)).toBeTruthy();
    expect(screen.queryByText("No active members")).toBeNull();
  });
});
