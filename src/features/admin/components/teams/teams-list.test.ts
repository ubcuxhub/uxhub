import { describe, expect, it } from "vitest";

import type { EventTeam } from "@/lib/supabase-helpers/event-teams";

import {
  deadlineSummary,
  filterTeams,
  parseTeamsListQuery,
  serializeTeamsListQuery,
  teamSizeOptions,
  teamsSummary,
  type TeamsListQuery,
} from "./teams-list";

const team = (id: string, name: string, members: string[], everyoneCheckedIn = false): EventTeam => ({
  id,
  name,
  members: members.map((memberName, index) => ({
    userId: `${id}-${index}`,
    name: memberName,
    isOwner: index === 0,
    hasTicket: true,
    checkedIn: everyoneCheckedIn,
  })),
  size: members.length,
  full: members.length >= 4,
  everyoneCheckedIn,
});

const teams = [
  team("a", "Proto Pals", ["Owen Patel", "Isla Moore", "Ruby Tan"], true),
  team("b", "flow finders", ["Kai Wong", "Chloe Wilson", "Lucas Martin", "Olivia Brown"]),
  team("c", "Grid Gang", ["Ethan Clark", "Jane Smith"], true),
  team("d", "Team 10", ["Zed Ali"]),
  team("e", "Team 9", ["Yan Bo"]),
];

const query = (patch: Partial<TeamsListQuery> = {}): TeamsListQuery => ({
  q: "",
  sort: "name",
  sizes: [],
  checkIns: [],
  page: 1,
  ...patch,
});
const names = (list: EventTeam[]) => list.map((t) => t.name);

describe("parseTeamsListQuery and serializeTeamsListQuery", () => {
  it("round-trips a view and leaves defaults out", () => {
    const view = query({ q: "pix", sort: "largest", sizes: ["2", "4"], checkIns: ["not-everyone"], page: 2 });
    const search = serializeTeamsListQuery(view);
    expect(search).toBe("?q=pix&sort=largest&size=2%2C4&checkin=not-everyone&page=2");
    expect(parseTeamsListQuery(new URLSearchParams(search))).toEqual(view);
    expect(serializeTeamsListQuery(query())).toBe("");
  });

  it("drops values it doesn't know and keeps keys it doesn't own", () => {
    expect(
      parseTeamsListQuery(new URLSearchParams("sort=bogus&size=0,3,x,3,1&checkin=maybe,everyone&page=-4"))
    ).toEqual(query({ sizes: ["1", "3"], checkIns: ["everyone"] }));
    expect(serializeTeamsListQuery(query({ sort: "smallest" }), "?tab=teams&sort=name-desc&page=3")).toBe(
      "?tab=teams&sort=smallest"
    );
  });
});

describe("filterTeams", () => {
  it("sorts by team name A–Z by default, ignoring case and reading numbers as numbers", () => {
    expect(names(filterTeams(teams, query()))).toEqual([
      "flow finders",
      "Grid Gang",
      "Proto Pals",
      "Team 9",
      "Team 10",
    ]);
    expect(names(filterTeams(teams, query({ sort: "name-desc" })))[0]).toBe("Team 10");
  });

  it("sorts by size both ways, breaking ties by name", () => {
    expect(names(filterTeams(teams, query({ sort: "largest" })))).toEqual([
      "flow finders",
      "Proto Pals",
      "Grid Gang",
      "Team 9",
      "Team 10",
    ]);
    expect(names(filterTeams(teams, query({ sort: "smallest" })))).toEqual([
      "Team 9",
      "Team 10",
      "Grid Gang",
      "Proto Pals",
      "flow finders",
    ]);
  });

  it("searches team names and member names", () => {
    expect(names(filterTeams(teams, query({ q: "GRID" })))).toEqual(["Grid Gang"]);
    expect(names(filterTeams(teams, query({ q: "chloe" })))).toEqual(["flow finders"]);
    expect(filterTeams(teams, query({ q: "nobody" }))).toEqual([]);
  });

  it("filters by any chosen size and by check-in, and intersects the two", () => {
    expect(names(filterTeams(teams, query({ sizes: ["1", "4"] })))).toEqual(["flow finders", "Team 9", "Team 10"]);
    expect(names(filterTeams(teams, query({ checkIns: ["everyone"] })))).toEqual(["Grid Gang", "Proto Pals"]);
    expect(names(filterTeams(teams, query({ checkIns: ["everyone", "not-everyone"] })))).toHaveLength(5);
    expect(names(filterTeams(teams, query({ sizes: ["2", "4"], checkIns: ["not-everyone"] })))).toEqual([
      "flow finders",
    ]);
  });
});

describe("teamSizeOptions", () => {
  it("runs 1 to the size limit and marks the limit full", () => {
    expect(teamSizeOptions(4, teams).map((o) => o.label)).toEqual([
      "1 member",
      "2 members",
      "3 members",
      "4 members (full)",
    ]);
  });

  it("runs to the largest team without a limit, and keeps an out-of-range choice", () => {
    expect(teamSizeOptions(null, teams.slice(0, 1)).map((o) => o.value)).toEqual(["1", "2", "3"]);
    expect(teamSizeOptions(null, [], ["6"]).map((o) => o.value)).toEqual(["1", "6"]);
  });
});

describe("teamsSummary", () => {
  const stats = { teams: 12, fullTeams: 6, openTeams: 6, onTeam: 41, going: 48, toPlace: 7 };

  it("reads as the Figma cards", () => {
    expect(
      teamsSummary({ stats, maxTeamSize: 4, deadline: "2027-01-11T06:59:00Z", locked: true, asOf: "2027-01-16T00:00:00Z" })
    ).toEqual({
      teams: "6 full · 6 with open spots",
      onTeam: "of 48 going · 7 to place",
      deadline: { value: "Jan 10", detail: "Passed · teams are locked" },
    });
  });

  it("says there is no size limit", () => {
    expect(teamsSummary({ stats, maxTeamSize: null, deadline: null, locked: false, asOf: "2027-01-16T00:00:00Z" }).teams).toBe(
      "No size limit"
    );
  });
});

describe("deadlineSummary", () => {
  const deadline = "2027-01-10T20:00:00Z";
  const at = (asOf: string) => deadlineSummary({ deadline, locked: false, asOf }).detail;

  it("counts down in days, then hours", () => {
    expect(at("2027-01-07T19:00:00Z")).toBe("Locks in 3 days");
    expect(at("2027-01-09T19:00:00Z")).toBe("Locks in 1 day");
    expect(at("2027-01-10T15:00:00Z")).toBe("Locks in 5 hours");
    expect(at("2027-01-10T19:00:00Z")).toBe("Locks in 1 hour");
    expect(at("2027-01-10T19:30:00Z")).toBe("Locks in under an hour");
  });

  it("shows the date in Pacific time, and None without a deadline", () => {
    expect(deadlineSummary({ deadline, locked: false, asOf: deadline }).value).toBe("Jan 10");
    expect(deadlineSummary({ deadline: null, locked: false, asOf: deadline })).toEqual({
      value: "None",
      detail: "Teams never lock",
    });
  });
});
