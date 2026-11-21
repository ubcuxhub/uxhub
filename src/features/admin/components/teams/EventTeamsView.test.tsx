// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buildEventTeamsOverview, type EventTeamsSource } from "@/lib/supabase-helpers/event-teams";

import { EventTeamsView } from "./EventTeamsView";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
beforeEach(() => window.history.replaceState(null, "", "/admin/events/e1/teams?tab=teams"));
afterEach(cleanup);

/** Team n has n % 4 + 1 members; even teams are all checked in. Two people have no team. */
function overview(teamCount = 8, maxTeamSize: number | null = 4) {
  const tickets: EventTeamsSource["tickets"] = [];
  const teams = Array.from({ length: teamCount }, (_, n) => {
    const members = Array.from({ length: (n % 4) + 1 }, (_, m) => {
      const id = `u${n}-${m}`;
      tickets.push({ user_id: id, check_ins: n % 2 === 0 ? [{ checked_in_at: "2027-01-16T17:00:00Z" }] : [] });
      return { user_id: id, joined_at: `2027-01-0${m + 1}T00:00:00Z`, user_info: { first_name: `Member${n}`, last_name: `M${m}` } };
    });
    return { id: `t${n}`, name: `Team ${String.fromCharCode(65 + n)}`, owner_id: members[0].user_id, team_members: members };
  });
  tickets.push({ user_id: "x1", check_ins: [] }, { user_id: "x2", check_ins: [] });
  return buildEventTeamsOverview(
    { event: { teams_enabled: true, max_team_size: maxTeamSize, team_deadline: "2027-01-11T06:59:00Z" }, teams, tickets },
    new Date("2027-01-16T00:00:00Z")
  );
}

const teamCells = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("EventTeamsView", () => {
  it("shows the stats, the size of each team and None for an empty spot", () => {
    render(<EventTeamsView overview={overview()} />);
    const card = (name: string) => screen.getByRole("group", { name }).textContent;
    expect(card("Teams")).toContain("8");
    expect(card("Teams")).toContain("2 full · 6 with open spots");
    expect(card("On a team")).toContain("20");
    expect(card("On a team")).toContain("of 22 going · 2 to place");
    expect(card("Team deadline")).toContain("Jan 10");
    expect(card("Team deadline")).toContain("Passed · teams are locked");

    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Team",
      "Size",
      "Member 1",
      "Member 2",
      "Member 3",
      "Member 4",
    ]);
    const first = within(screen.getAllByRole("row")[1]).getAllByRole("cell").map((c) => c.textContent);
    expect(first).toEqual(["Team A", "1 of 4", "Member0 M0", "–None", "–None", "–None"]);
  });

  it("pages, searches team and member names, and keeps the view in the URL", () => {
    render(<EventTeamsView overview={overview()} pageSize={6} />);
    expect(teamCells()).toHaveLength(6);
    expect(screen.getByText("Showing 1–6 of 8 teams")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(teamCells()).toEqual(["Team G", "Team H"]);
    expect(window.location.search).toBe("?tab=teams&page=2");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search teams or people" }), {
      target: { value: "member3" },
    });
    expect(teamCells()).toEqual(["Team D"]);
    expect(window.location.search).toBe("?tab=teams&q=member3");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search teams or people" }), {
      target: { value: "nobody" },
    });
    expect(screen.getByText("No teams match your search and filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(teamCells()).toHaveLength(6);
    expect(window.location.search).toBe("?tab=teams");
  });

  it("filters by size and check-in from the panel, and resets", () => {
    render(<EventTeamsView overview={overview()} />);
    fireEvent.click(screen.getByRole("button", { name: "Sort and filter" }));
    const panel = screen.getByRole("dialog", { name: "Sort and filter" });
    const group = (name: string) => within(panel).getAllByRole("group", { name })[0];
    expect(within(group("Team size")).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "1 member",
      "2 members",
      "3 members",
      "4 members (full)",
    ]);

    fireEvent.click(within(group("Team size")).getByRole("button", { name: "4 members (full)" }));
    expect(teamCells()).toEqual(["Team D", "Team H"]);
    fireEvent.click(within(group("Check-in")).getByRole("button", { name: "Not everyone checked in" }));
    expect(teamCells()).toEqual(["Team D", "Team H"]);
    fireEvent.click(within(group("Check-in")).getByRole("button", { name: "Not everyone checked in" }));
    fireEvent.click(within(group("Check-in")).getByRole("button", { name: "Everyone checked in" }));
    expect(screen.getByText("No teams match your search and filters.")).toBeTruthy();
    expect(window.location.search).toBe("?tab=teams&size=4&checkin=everyone");
    expect(screen.getByRole("button", { name: "Sort and filter, 2 active" })).toBeTruthy();

    fireEvent.click(within(panel).getByRole("button", { name: "Clear all" }));
    expect(window.location.search).toBe("?tab=teams");
    expect(teamCells()).toHaveLength(8);
  });

  it("opens on a sort from the URL", () => {
    window.history.replaceState(null, "", "/admin/events/e1/teams?sort=largest");
    render(<EventTeamsView overview={overview()} />);
    expect(teamCells().slice(0, 2)).toEqual(["Team D", "Team H"]);
    expect(screen.getByRole("button", { name: "Sort and filter, 1 active" })).toBeTruthy();
  });

  it("shows sizes without a limit", () => {
    render(<EventTeamsView overview={overview(3, null)} />);
    expect(screen.getByRole("group", { name: "Teams" }).textContent).toContain("No size limit");
    expect(within(screen.getAllByRole("row")[3]).getAllByRole("cell")[1].textContent).toBe("3");
  });

  it("says when there are no teams yet", () => {
    render(<EventTeamsView overview={overview(0)} />);
    expect(screen.getByRole("heading", { name: "No teams yet" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("group", { name: "On a team" }).textContent).toContain("of 2 going · 2 to place");
  });
});
