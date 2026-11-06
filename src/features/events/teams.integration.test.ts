/**
 * Teams against the local database: the team functions the server calls
 * (create, join, leave, delete), their refusals, and what a student can read.
 * See the Figma Teams workflow (7.1–7.11).
 */
import { describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import {
  createTeam,
  deleteTeam,
  fetchTeamByInviteCode,
  fetchUserTeam,
  joinTeam,
  leaveTeam,
} from "@/lib/supabase-helpers/teams";
import { clientAs, createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

const db = createIntegrationClient();

type EventInsert = Partial<Database["public"]["Tables"]["events"]["Insert"]>;

const hour = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function teamEvent(fixtures: Fixtures, overrides: EventInsert = {}) {
  return fixtures.createEvent({
    status: "active",
    teams_enabled: true,
    max_team_size: 4,
    team_deadline: at(24 * hour),
    ...overrides,
  });
}

/** A user holding a ticket to the event. */
async function going(fixtures: Fixtures, eventId: string, firstName = "Integration") {
  const user = await fixtures.createUser({ first_name: firstName });
  const { error } = await db.from("event_tickets").insert({ event_id: eventId, user_id: user.id });
  if (error) throw error;
  return user;
}

async function ownTeam(eventId: string, userId: string, name?: string) {
  const { teamId, failureReason } = await createTeam(db, { eventId, userId, name });
  expect(failureReason).toBeNull();
  const team = await fetchUserTeam(db, eventId, userId);
  return { teamId: teamId!, inviteCode: team!.invite_code };
}

describe("createTeam", () => {
  it("makes the creator the owner and first member, with an invite code", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id, "Aubrey");

      const { teamId, failureReason } = await createTeam(db, {
        eventId: event.id,
        userId: owner.id,
        name: "  Pixel Pushers ",
      });
      expect(failureReason).toBeNull();

      const team = await fetchUserTeam(db, event.id, owner.id);
      expect(team).toMatchObject({
        id: teamId,
        event_id: event.id,
        name: "Pixel Pushers",
        owner_id: owner.id,
        members: [{ userId: owner.id, firstName: "Aubrey", isOwner: true }],
      });
      expect(team!.invite_code).toMatch(/^[0-9a-f]{10}$/);
    }));

  it("leaves the name empty when none is given", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id);
      await createTeam(db, { eventId: event.id, userId: owner.id, name: "   " });
      expect((await fetchUserTeam(db, event.id, owner.id))?.name).toBeNull();
    }));

  it.each([
    ["TEAMS_DISABLED", { teams_enabled: false }],
    ["TEAMS_LOCKED", { team_deadline: at(-hour) }],
  ] as const)("refuses with %s", (reason, overrides) =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures, overrides);
      const user = await going(fixtures, event.id);
      expect(await createTeam(db, { eventId: event.id, userId: user.id })).toEqual({
        teamId: null,
        failureReason: reason,
      });
    }));

  it("refuses someone without a ticket, or already on a team", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const noTicket = await fixtures.createUser();
      expect((await createTeam(db, { eventId: event.id, userId: noTicket.id })).failureReason).toBe(
        "NO_TICKET"
      );

      const owner = await going(fixtures, event.id);
      await ownTeam(event.id, owner.id);
      expect((await createTeam(db, { eventId: event.id, userId: owner.id })).failureReason).toBe(
        "ALREADY_ON_TEAM"
      );
      // The refused second team was not left behind.
      const { count } = await db
        .from("teams")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);
      expect(count).toBe(1);
    }));

  it("refuses an event that doesn't exist", () =>
    withFixtures(async (fixtures) => {
      const user = await fixtures.createUser();
      const { failureReason } = await createTeam(db, {
        eventId: "00000000-0000-0000-0000-000000000000",
        userId: user.id,
      });
      expect(failureReason).toBe("EVENT_NOT_FOUND");
    }));

  it("lets a student be on a team for each of two events", () =>
    withFixtures(async (fixtures) => {
      const first = await teamEvent(fixtures, { slug: `first-${fixtures.tag}` });
      const second = await teamEvent(fixtures, { slug: `second-${fixtures.tag}` });
      const user = await going(fixtures, first.id);
      await db.from("event_tickets").insert({ event_id: second.id, user_id: user.id });

      expect((await createTeam(db, { eventId: first.id, userId: user.id })).failureReason).toBeNull();
      expect((await createTeam(db, { eventId: second.id, userId: user.id })).failureReason).toBeNull();
    }));
});

describe("joinTeam", () => {
  it("adds a ticket holder to the team, after the owner", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id, "Jordan");
      const member = await going(fixtures, event.id, "Aubrey");
      const { teamId, inviteCode } = await ownTeam(event.id, owner.id);

      expect(await joinTeam(db, { inviteCode: ` ${inviteCode} `, userId: member.id })).toEqual({
        teamId,
        failureReason: null,
      });
      const team = await fetchTeamByInviteCode(db, inviteCode);
      expect(team?.members.map((m) => [m.firstName, m.isOwner])).toEqual([
        ["Jordan", true],
        ["Aubrey", false],
      ]);
    }));

  it("refuses an unknown code, someone without a ticket, or someone on another team", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id);
      const otherOwner = await going(fixtures, event.id);
      const { inviteCode } = await ownTeam(event.id, owner.id);
      await ownTeam(event.id, otherOwner.id);
      const noTicket = await fixtures.createUser();

      expect((await joinTeam(db, { inviteCode: "nope", userId: owner.id })).failureReason).toBe(
        "TEAM_NOT_FOUND"
      );
      expect((await joinTeam(db, { inviteCode, userId: noTicket.id })).failureReason).toBe(
        "NO_TICKET"
      );
      expect((await joinTeam(db, { inviteCode, userId: otherOwner.id })).failureReason).toBe(
        "ALREADY_ON_TEAM"
      );
    }));

  it("refuses once the team is full", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures, { max_team_size: 2 });
      const owner = await going(fixtures, event.id);
      const second = await going(fixtures, event.id);
      const third = await going(fixtures, event.id);
      const { inviteCode } = await ownTeam(event.id, owner.id);

      expect((await joinTeam(db, { inviteCode, userId: second.id })).failureReason).toBeNull();
      expect((await joinTeam(db, { inviteCode, userId: third.id })).failureReason).toBe("TEAM_FULL");
    }));

  it("gives the last spot to only one of several people joining at once", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures, { max_team_size: 2 });
      const owner = await going(fixtures, event.id);
      // One at a time: the fixture helper names each user from a running count.
      const joiners = [];
      for (let i = 0; i < 4; i++) joiners.push(await going(fixtures, event.id));
      const { teamId, inviteCode } = await ownTeam(event.id, owner.id);

      const results = await Promise.all(
        joiners.map((joiner) => joinTeam(db, { inviteCode, userId: joiner.id }))
      );
      expect(results.filter((r) => r.failureReason === null)).toHaveLength(1);
      expect(results.filter((r) => r.failureReason === "TEAM_FULL")).toHaveLength(3);

      const { count } = await db
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("team_id", teamId);
      expect(count).toBe(2);
    }));

  it("refuses after the team deadline", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id);
      const late = await going(fixtures, event.id);
      const { inviteCode } = await ownTeam(event.id, owner.id);
      await db.from("events").update({ team_deadline: at(-hour) }).eq("id", event.id);

      expect((await joinTeam(db, { inviteCode, userId: late.id })).failureReason).toBe("TEAMS_LOCKED");
    }));
});

describe("leaveTeam", () => {
  it("takes a member off the team and keeps the rest together", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id);
      const member = await going(fixtures, event.id);
      const { inviteCode } = await ownTeam(event.id, owner.id);
      await joinTeam(db, { inviteCode, userId: member.id });

      expect(await leaveTeam(db, { eventId: event.id, userId: member.id })).toBeNull();
      expect(await fetchUserTeam(db, event.id, member.id)).toBeNull();
      expect((await fetchUserTeam(db, event.id, owner.id))?.members).toHaveLength(1);
    }));

  it("refuses the owner, someone not on a team, and anyone after the deadline", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id);
      const member = await going(fixtures, event.id);
      const loner = await going(fixtures, event.id);
      const { inviteCode } = await ownTeam(event.id, owner.id);
      await joinTeam(db, { inviteCode, userId: member.id });

      expect(await leaveTeam(db, { eventId: event.id, userId: owner.id })).toBe("OWNER_CANNOT_LEAVE");
      expect(await leaveTeam(db, { eventId: event.id, userId: loner.id })).toBe("NOT_ON_TEAM");

      await db.from("events").update({ team_deadline: at(-hour) }).eq("id", event.id);
      expect(await leaveTeam(db, { eventId: event.id, userId: member.id })).toBe("TEAMS_LOCKED");
    }));
});

describe("deleteTeam", () => {
  it("removes the team and everyone on it, so they can team up again", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id);
      const member = await going(fixtures, event.id);
      const { teamId, inviteCode } = await ownTeam(event.id, owner.id);
      await joinTeam(db, { inviteCode, userId: member.id });

      expect(await deleteTeam(db, { teamId, userId: owner.id })).toBeNull();
      expect(await fetchTeamByInviteCode(db, inviteCode)).toBeNull();
      expect(await fetchUserTeam(db, event.id, member.id)).toBeNull();
      expect((await createTeam(db, { eventId: event.id, userId: member.id })).failureReason).toBeNull();
    }));

  it("refuses anyone but the owner, and the owner after the deadline", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id);
      const member = await going(fixtures, event.id);
      const { teamId, inviteCode } = await ownTeam(event.id, owner.id);
      await joinTeam(db, { inviteCode, userId: member.id });

      expect(await deleteTeam(db, { teamId, userId: member.id })).toBe("NOT_OWNER");
      await db.from("events").update({ team_deadline: at(-hour) }).eq("id", event.id);
      expect(await deleteTeam(db, { teamId, userId: owner.id })).toBe("TEAMS_LOCKED");
    }));
});

describe("deleting an account", () => {
  async function deleteAccount(user: { auth_user_id: string | null }) {
    const { error } = await db.rpc("delete_account", { p_auth_user_id: user.auth_user_id! });
    if (error) throw error;
  }

  it("frees a member's spot on their team", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures, { max_team_size: 2 });
      const owner = await going(fixtures, event.id);
      const member = await going(fixtures, event.id);
      const next = await going(fixtures, event.id);
      const { inviteCode } = await ownTeam(event.id, owner.id);
      await joinTeam(db, { inviteCode, userId: member.id });

      await deleteAccount(member);
      expect((await fetchUserTeam(db, event.id, owner.id))?.members).toHaveLength(1);
      expect((await joinTeam(db, { inviteCode, userId: next.id })).failureReason).toBeNull();
    }));

  it("passes an owner's team to the teammate who joined first", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id);
      const first = await going(fixtures, event.id);
      const second = await going(fixtures, event.id);
      const { teamId, inviteCode } = await ownTeam(event.id, owner.id);
      await joinTeam(db, { inviteCode, userId: first.id });
      await joinTeam(db, { inviteCode, userId: second.id });

      await deleteAccount(owner);
      const team = await fetchUserTeam(db, event.id, first.id);
      expect(team?.id).toBe(teamId);
      expect(team?.owner_id).toBe(first.id);
      expect(team?.members.map((m) => m.userId)).toEqual([first.id, second.id]);
      // The new owner can manage it.
      expect(await deleteTeam(db, { teamId, userId: first.id })).toBeNull();
    }));

  it("deletes a team the owner was alone on", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id);
      const { inviteCode } = await ownTeam(event.id, owner.id);

      await deleteAccount(owner);
      expect(await fetchTeamByInviteCode(db, inviteCode)).toBeNull();
    }));
});

describe("team tables", () => {
  it("refuse a member row whose event isn't its team's", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures, { slug: `team-${fixtures.tag}` });
      const other = await teamEvent(fixtures, { slug: `other-${fixtures.tag}` });
      const owner = await going(fixtures, event.id);
      const { teamId } = await ownTeam(event.id, owner.id);
      const stray = await fixtures.createUser();

      const { error } = await db
        .from("team_members")
        .insert({ event_id: other.id, team_id: teamId, user_id: stray.id });
      expect(error?.code).toBe("23503");
    }));

  it("show a student their own team and teammates, and no other team", () =>
    withFixtures(async (fixtures) => {
      const event = await teamEvent(fixtures);
      const owner = await going(fixtures, event.id);
      const member = await going(fixtures, event.id);
      const outsider = await going(fixtures, event.id);
      const { teamId, inviteCode } = await ownTeam(event.id, owner.id);
      await joinTeam(db, { inviteCode, userId: member.id });
      const { teamId: outsiderTeamId } = await ownTeam(event.id, outsider.id);

      const asMember = clientAs(member);
      const { data: teams } = await asMember.from("teams").select("id").eq("event_id", event.id);
      expect(teams?.map((team) => team.id)).toEqual([teamId]);
      const { data: members } = await asMember.from("team_members").select("user_id").eq("event_id", event.id);
      expect(members?.map((row) => row.user_id).sort()).toEqual([owner.id, member.id].sort());

      const { error } = await asMember
        .from("team_members")
        .insert({ event_id: event.id, team_id: outsiderTeamId, user_id: member.id });
      expect(error).not.toBeNull();
      const { error: rpcError } = await asMember.rpc("join_team", {
        p_invite_code: inviteCode,
        p_user_id: outsider.id,
      });
      expect(rpcError).not.toBeNull();
    }));
});
