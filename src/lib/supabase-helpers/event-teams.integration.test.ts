/**
 * The admin Teams view against the local database, read through an admin's
 * and a student's viewer clients so RLS is what decides what each sees.
 */
import { describe, expect, it } from "vitest";

import { clientAs, withFixtures, type Fixtures } from "@/test/integration";

import { fetchEventTeamsOverview } from "./event-teams";

async function insert<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data as T;
}

async function setup(f: Fixtures) {
  const db = f.supabase;
  const event = await f.createEvent({
    teams_enabled: true,
    max_team_size: 3,
    team_deadline: "2020-01-01T00:00:00Z",
  });
  const admin = await f.createUser({ role_access: "admin" });
  // One at a time: a fixture's email is numbered by how many rows came before.
  const people = [];
  for (const first_name of ["Ana", "Bo", "Cy", "Dee", "Eli", "Fay"]) {
    people.push(await f.createUser({ first_name, last_name: "Lee" }));
  }
  const [ana, bo, cy, dee, eli] = people;
  const tickets = await insert(
    db.from("event_tickets").insert(people.map((p) => ({ event_id: event.id, user_id: p.id }))).select("id, user_id")
  );
  const ticketOf = (userId: string) => tickets.find((t) => t.user_id === userId)!.id;

  const [full, open] = await insert(
    db
      .from("teams")
      .insert([
        { event_id: event.id, name: "Pixel Pushers", owner_id: bo.id },
        { event_id: event.id, name: null, owner_id: dee.id },
      ])
      .select("id, name")
  );
  await insert(
    db.from("team_members").insert([
      { event_id: event.id, team_id: full.id, user_id: ana.id, joined_at: "2026-01-01T00:00:00Z" },
      { event_id: event.id, team_id: full.id, user_id: bo.id, joined_at: "2026-01-02T00:00:00Z" },
      { event_id: event.id, team_id: full.id, user_id: cy.id, joined_at: "2026-01-03T00:00:00Z" },
      { event_id: event.id, team_id: open.id, user_id: dee.id, joined_at: "2026-01-04T00:00:00Z" },
      { event_id: event.id, team_id: open.id, user_id: eli.id, joined_at: "2026-01-05T00:00:00Z" },
    ])
  );

  // Two check-in items: Pixel Pushers check in across them; Eli never does.
  const sessions = await insert(
    db
      .from("check_in_sessions")
      .insert([
        { event_id: event.id, name: "Doors" },
        { event_id: event.id, name: "Day 2" },
      ])
      .select("id")
  );
  await insert(
    db.from("check_ins").insert([
      { ticket_id: ticketOf(ana.id), check_in_session_id: sessions[0].id, checked_in_at: "2026-01-10T17:00:00Z" },
      { ticket_id: ticketOf(bo.id), check_in_session_id: sessions[0].id, checked_in_at: "2026-01-10T17:00:00Z" },
      { ticket_id: ticketOf(cy.id), check_in_session_id: sessions[1].id, checked_in_at: "2026-01-11T17:00:00Z" },
      { ticket_id: ticketOf(dee.id), check_in_session_id: sessions[0].id, checked_in_at: "2026-01-10T17:00:00Z" },
    ])
  );

  return { event, admin, ana };
}

describe("fetchEventTeamsOverview", () => {
  it("reads every team, its members and the stats with an admin's client", () =>
    withFixtures(async (f) => {
      const { event, admin } = await setup(f);
      const overview = await fetchEventTeamsOverview(clientAs(admin), event.id);

      expect(overview).toMatchObject({
        teamsEnabled: true,
        maxTeamSize: 3,
        locked: true,
        stats: { teams: 2, fullTeams: 1, openTeams: 1, onTeam: 5, going: 6, toPlace: 1 },
      });
      const teams = Object.fromEntries(overview!.teams.map((team) => [team.name, team]));
      expect(teams["Pixel Pushers"]).toMatchObject({ size: 3, full: true, everyoneCheckedIn: true });
      expect(teams["Pixel Pushers"].members.map((m) => m.name)).toEqual(["Bo Lee", "Ana Lee", "Cy Lee"]);
      expect(teams["Dee's team"]).toMatchObject({ size: 2, full: false, everyoneCheckedIn: false });
    }));

  it("gives a student nothing of a draft event, and null for an unknown event", () =>
    withFixtures(async (f) => {
      const { event, ana } = await setup(f);
      // Admins read every row; a student can't even see the (draft) event.
      expect(await fetchEventTeamsOverview(clientAs(ana), event.id)).toBeNull();
      expect(await fetchEventTeamsOverview(f.supabase, "00000000-0000-0000-0000-000000000000")).toBeNull();
    }));
});
