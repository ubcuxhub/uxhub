import { describe, expect, it } from "vitest";

import { buildEventTeamsOverview, type EventTeamsSource } from "./event-teams";

const member = (userId: string, firstName: string | null, joinedAt = "2027-01-02T00:00:00Z") => ({
  user_id: userId,
  joined_at: joinedAt,
  user_info: firstName === null ? null : { first_name: firstName, last_name: "Lee" },
});
const ticket = (userId: string, ...checkIns: (string | null)[]) => ({
  user_id: userId,
  check_ins: checkIns.map((checked_in_at) => ({ checked_in_at })),
});

function source(overrides: Partial<EventTeamsSource> = {}): EventTeamsSource {
  return {
    event: { teams_enabled: true, max_team_size: 3, team_deadline: "2027-01-10T08:00:00Z" },
    teams: [
      {
        id: "t1",
        name: "Pixel Pushers",
        owner_id: "u2",
        team_members: [
          member("u1", "Ana", "2027-01-01T00:00:00Z"),
          member("u3", "Cy", "2027-01-03T00:00:00Z"),
          member("u2", "Bo", "2027-01-05T00:00:00Z"),
        ],
      },
      { id: "t2", name: null, owner_id: "u4", team_members: [member("u4", "Dee"), member("u5", "Eli")] },
    ],
    tickets: [
      ticket("u1", "2027-01-16T17:00:00Z"),
      ticket("u2", null, "2027-01-17T17:00:00Z"),
      ticket("u3", "2027-01-16T17:00:00Z"),
      ticket("u4", "2027-01-16T17:00:00Z"),
      ticket("u5"),
      ticket("u6"),
      ticket("u7", null),
    ],
    ...overrides,
  };
}

describe("buildEventTeamsOverview", () => {
  it("counts teams, the going people on them and those to place", () => {
    const overview = buildEventTeamsOverview(source(), new Date("2027-01-05T00:00:00Z"));
    expect(overview.stats).toEqual({
      teams: 2,
      fullTeams: 1,
      openTeams: 1,
      onTeam: 5,
      going: 7,
      toPlace: 2,
    });
    expect(overview.maxTeamSize).toBe(3);
    expect(overview.locked).toBe(false);
    expect(overview.asOf).toBe("2027-01-05T00:00:00.000Z");
  });

  it("puts the owner first, then members in the order they joined", () => {
    const [team] = buildEventTeamsOverview(source()).teams;
    expect(team.members.map((m) => m.name)).toEqual(["Bo Lee", "Ana Lee", "Cy Lee"]);
    expect(team.members[0].isOwner).toBe(true);
    expect(team).toMatchObject({ size: 3, full: true });
  });

  it("names an unnamed team after its owner, or Unnamed team without one", () => {
    expect(buildEventTeamsOverview(source()).teams[1].name).toBe("Dee's team");
    const ownerless = source({
      teams: [{ id: "t3", name: null, owner_id: null, team_members: [member("u1", "Ana")] }],
    });
    expect(buildEventTeamsOverview(ownerless).teams[0].name).toBe("Unnamed team");
  });

  it("checks a team in when every member holding a ticket has a check-in on any item", () => {
    const [pixel, dee] = buildEventTeamsOverview(source()).teams;
    // Bo's first item was unticked (null) but a later one counts.
    expect(pixel.everyoneCheckedIn).toBe(true);
    expect(dee.everyoneCheckedIn).toBe(false);
    expect(dee.members.find((m) => m.name === "Eli Lee")).toMatchObject({ hasTicket: true, checkedIn: false });
  });

  it("leaves a member without a ticket out of check-in and On a team", () => {
    const overview = buildEventTeamsOverview(
      source({
        teams: [{ id: "t1", name: "Solo", owner_id: "u1", team_members: [member("u1", "Ana"), member("u9", "Ghost")] }],
        tickets: [ticket("u1", "2027-01-16T17:00:00Z")],
      })
    );
    expect(overview.teams[0]).toMatchObject({ size: 2, everyoneCheckedIn: true });
    expect(overview.teams[0].members[1]).toMatchObject({ hasTicket: false, checkedIn: false });
    expect(overview.stats).toMatchObject({ onTeam: 1, going: 1, toPlace: 0 });
  });

  it("never checks in a team with no ticket holders", () => {
    const overview = buildEventTeamsOverview(
      source({ teams: [{ id: "t1", name: "Ghosts", owner_id: null, team_members: [member("u9", "Ghost")] }], tickets: [] })
    );
    expect(overview.teams[0].everyoneCheckedIn).toBe(false);
  });

  it("falls back to Unknown User for a member without a name", () => {
    const overview = buildEventTeamsOverview(
      source({ teams: [{ id: "t1", name: "X", owner_id: null, team_members: [member("u1", null)] }] })
    );
    expect(overview.teams[0].members[0].name).toBe("Unknown User");
  });

  it("locks at the deadline, and never without one", () => {
    expect(buildEventTeamsOverview(source(), new Date("2027-01-10T08:00:00Z")).locked).toBe(true);
    expect(buildEventTeamsOverview(source(), new Date("2027-01-10T07:59:59Z")).locked).toBe(false);
    const noDeadline = source({ event: { teams_enabled: true, max_team_size: 3, team_deadline: null } });
    expect(buildEventTeamsOverview(noDeadline, new Date("2099-01-01T00:00:00Z")).locked).toBe(false);
  });

  it("has no full teams without a size limit", () => {
    const overview = buildEventTeamsOverview(
      source({ event: { teams_enabled: true, max_team_size: null, team_deadline: null } })
    );
    expect(overview.stats).toMatchObject({ fullTeams: 0, openTeams: 2 });
    expect(overview.teams.every((team) => !team.full)).toBe(true);
  });
});
