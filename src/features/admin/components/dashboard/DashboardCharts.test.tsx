// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DashboardAreaOfStudy } from "./DashboardAreaOfStudy";
import { DashboardClubMembers } from "./DashboardClubMembers";
import type { MajorDistribution, MembershipHistory } from "@/lib/supabase-helpers/admin-dashboard";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});
afterEach(cleanup);

const majors: MajorDistribution = { totalAccounts: 10, majors: [{ major: "Cognitive Systems", count: 6 }, { major: "Unknown", count: 4 }] };
const history: MembershipHistory = {
  latestAcademicYear: 2026, completeFrom: "2025-09-01T07:00:00Z",
  years: [2025, 2026].map((year) => ({
    academicYear: year, label: `${year}–${year + 1}`, count: year === 2026 ? 8 : 20, coverage: "complete",
    months: Array.from({ length: 8 }, (_, i) => ({ month: new Date(Date.UTC(year, 8 + i, 1)).toISOString().slice(0, 10), count: i === 0 ? 5 : i === 1 ? 3 : year === 2026 ? null : 0, coverage: i > 1 && year === 2026 ? "future" : "complete" })),
  })),
};

async function openMenu(name: string) {
  const trigger = screen.getByRole("button", { name });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  await screen.findByRole("menu");
  return trigger;
}

async function chooseMonth(year = "2025–2026") {
  await openMenu("Chart period: Monthly");
  const month = screen.getByRole("menuitem", { name: "Monthly" });
  act(() => month.focus());
  fireEvent.keyDown(month, { key: "ArrowRight" });
  fireEvent.click(await screen.findByRole("menuitem", { name: year }));
}

describe("Area of Study", () => {
  it("starts with every segment and no selection; selection retains population and denominator", async () => {
    const { container } = render(<DashboardAreaOfStudy data={majors} />);
    expect(screen.getByText("All accounts")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Account major distribution" });
    expect(list.textContent).toContain("Cognitive Systems: 6 (60%)");
    expect(list.textContent).toContain("Unknown: 4 (40%)");
    expect(list.textContent).not.toContain("selected");
    expect(container.querySelector(".recharts-responsive-container")).toBeNull();
    expect(container.querySelector("svg.recharts-surface")?.getAttribute("width")).toBe("85");
    expect(container.querySelectorAll(".recharts-sector").length).toBe(2);
    const trigger = await openMenu("Select");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Unknown" }));
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(trigger.textContent).toBe("Select");
    expect(list.textContent).toContain("Unknown: 4 (40%), selected");
    expect(list.textContent).toContain("Cognitive Systems: 6 (60%)");
    expect(container.querySelectorAll(".recharts-sector").length).toBe(2);
    expect(container.querySelector('.recharts-sector[fill="var(--primary)"]')).toBeTruthy();
    fireEvent.click(container.querySelectorAll(".recharts-sector")[0]);
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(list.textContent).toContain("Cognitive Systems: 6 (60%), selected");
    await openMenu("Select");
    expect(screen.getByRole("menuitemradio", { name: "Cognitive Systems" }).getAttribute("aria-checked")).toBe("true");

  });

  it("distinguishes zero accounts, query failure and valid all-Unknown accounts", () => {
    const { rerender } = render(<DashboardAreaOfStudy data={{ totalAccounts: 0, majors: [] }} />);
    expect(screen.getByText("No accounts yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
    rerender(<DashboardAreaOfStudy data={null} />);
    expect(screen.getByText("We couldn’t load areas of study")).toBeTruthy();
    rerender(<DashboardAreaOfStudy data={{ totalAccounts: 3, majors: [{ major: "Unknown", count: 3 }] }} />);
    expect(screen.getByRole("list").textContent).toContain("Unknown: 3 (100%)");
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.queryByText("No accounts yet")).toBeNull();
  });
});

describe("Club Members", () => {
  it("lists Monthly years newest first without changing chronological bars", async () => {
    render(<DashboardClubMembers data={history} recentAdditions={{ count: 7, coverage: "complete" }} />);
    await openMenu("Chart period: Monthly");
    const monthly = screen.getByRole("menuitem", { name: "Monthly" });
    act(() => monthly.focus());
    fireEvent.keyDown(monthly, { key: "ArrowRight" });
    await screen.findByRole("menuitem", { name: "2026–2027" });
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent).filter((label) => /^\d{4}/.test(label ?? ""))).toEqual(["2026–2027", "2025–2026"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "2025–2026" }));
    expect(within(screen.getByRole("group", { name: "2025–2026 monthly additions" })).getAllByRole("button").map((bar) => bar.getAttribute("aria-label")?.split(":")[0])).toEqual(["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"]);
  });

  it("switches to Yearly with a data-derived range and current reporting total", async () => {
    render(<DashboardClubMembers data={{ ...history, years: [{ ...history.years[0], academicYear: 2022, label: "2022–2023" }, history.years[1]] }} recentAdditions={{ count: 7, coverage: "complete" }} />);
    await chooseMonth("2022–2023");
    expect(screen.getByLabelText("Academic-year total: 20")).toBeTruthy();
    await openMenu("Chart period: Monthly");
    fireEvent.click(screen.getByRole("menuitem", { name: "Yearly" }));
    expect(screen.getByRole("button", { name: "Chart period: Yearly" })).toBeTruthy();
    expect(screen.getAllByText("2022–2027")).toHaveLength(1);
    expect(screen.getByLabelText("Academic-year total: 8")).toBeTruthy();
    expect(screen.getByText("+7 past 30 days")).toBeTruthy();
  });

  it("provides exactly one data-collection info control and its tooltip", async () => {
    render(<DashboardClubMembers data={history} recentAdditions={{ count: 7, coverage: "complete" }} />);
    const copy = "Membership data collection began in the 2026-2027 academic year";
    const info = screen.getByRole("button", { name: copy });
    expect(info.previousElementSibling).toBe(screen.getByRole("heading", { name: "Club Members" }));
    fireEvent.keyDown(document.body, { key: "Tab" });
    fireEvent.focus(info);
    expect((await screen.findByRole("tooltip")).textContent).toBe(copy);
  });

  it("uses academic-year totals, server-provided rolling 30-day additions, and no carousel/Week controls", () => {
    render(<DashboardClubMembers data={history} recentAdditions={{ count: 7, coverage: "complete" }} />);
    expect(screen.getByRole("button", { name: "Chart period: Monthly" })).toBeTruthy();
    expect(screen.getByLabelText("Academic-year total: 8")).toBeTruthy();
    expect(screen.getByText("+7 past 30 days")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sep: 5" })).toBeTruthy();
    expect(screen.getAllByText("2026–2027")).toHaveLength(1);
    expect(document.querySelector("[data-slot=metric-badge] .lucide-trending-up")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /statistics slide|Week/ })).toBeNull();
  });

  it("shows historical year totals and one subtitle, hiding the past-month badge", async () => {
    render(<DashboardClubMembers data={history} recentAdditions={{ count: 7, coverage: "complete" }} />);
    await chooseMonth();
    expect(screen.getByRole("button", { name: "Chart period: Monthly" })).toBeTruthy();
    expect(screen.getByText("2025–2026")).toBeTruthy();
    const chart = screen.getByRole("group", { name: "2025–2026 monthly additions" });
    expect(within(chart).getAllByRole("button")).toHaveLength(8);
    expect(within(chart).getByRole("button", { name: "Sep: 5" })).toBeTruthy();
    expect(within(chart).getByRole("button", { name: "Oct: 3" })).toBeTruthy();
    expect(within(chart).getByRole("button", { name: "Apr: 0" })).toBeTruthy();
    expect(screen.getByLabelText("Academic-year total: 20")).toBeTruthy();
    expect(screen.queryByText("+7 past 30 days")).toBeNull();
  });

  it("hides a failed rolling metric without fabricating a zero", () => {
    render(<DashboardClubMembers data={history} recentAdditions={null} />);
    expect(screen.getByLabelText("Academic-year total: 8")).toBeTruthy();
    expect(screen.queryByText(/past 30 days/)).toBeNull();
  });

  it("reports future months honestly rather than as zero", async () => {
    render(<DashboardClubMembers data={history} recentAdditions={{ count: 7, coverage: "complete" }} />);
    await chooseMonth("2026–2027");
    expect(screen.getByRole("button", { name: "Dec: Not yet reported" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Dec: 0" })).toBeNull();
  });

  it("distinguishes partial, absent history, complete empty coverage and failure", () => {
    const partial: MembershipHistory = { ...history, years: history.years.map((y) => ({ ...y, count: 0, coverage: "partial", months: y.months.map((m) => ({ ...m, count: 0, coverage: "partial" })) })) };
    const { rerender } = render(<DashboardClubMembers data={partial} recentAdditions={{ count: 0, coverage: "partial" }} />);
    expect(screen.getByLabelText("Academic-year total: 0")).toBeTruthy();
    expect(screen.getByText("+0 past 30 days")).toBeTruthy();
    expect(screen.queryByText(/incomplete/i)).toBeNull();
    expect(screen.queryByText("No members yet")).toBeNull();
    rerender(<DashboardClubMembers data={{ ...partial, years: partial.years.map((y) => ({ ...y, count: null, coverage: "unavailable", months: y.months.map((m) => ({ ...m, count: null, coverage: "unavailable" })) })) }} recentAdditions={{ count: null, coverage: "unavailable" }} />);
    expect(screen.getByLabelText("Academic-year total: Data unavailable")).toBeTruthy();
    expect(screen.queryByText(/past 30 days/)).toBeNull();
    expect(screen.queryByText("No members yet")).toBeNull();
    rerender(<DashboardClubMembers data={{ ...partial, years: partial.years.map((y) => ({ ...y, coverage: "complete" })) }} recentAdditions={{ count: 7, coverage: "complete" }} />);
    expect(screen.getByText("No members yet")).toBeTruthy();
    rerender(<DashboardClubMembers data={null} recentAdditions={{ count: 7, coverage: "complete" }} />);
    expect(screen.getByText("We couldn’t load club members")).toBeTruthy();
  });

  it("preserves the server-provided latest completed year during summer", () => {
    render(<DashboardClubMembers data={{ ...history, latestAcademicYear: 2025, years: history.years.slice(0, 1) }} recentAdditions={{ count: 7, coverage: "complete" }} />);
    expect(screen.getByLabelText("Academic-year total: 20")).toBeTruthy();
    expect(screen.getByText("+7 past 30 days")).toBeTruthy();
  });
});
