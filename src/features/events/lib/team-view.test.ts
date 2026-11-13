import { describe, expect, it } from "vitest";

import type { TeamWithMembers } from "@/lib/supabase-helpers/teams";

import { inviteDescription, joinedDescription, toTeamInvite, toTeamView } from "./team-view";

const team: TeamWithMembers = {
  id: "team-1",
  event_id: "event-1",
  name: null,
  invite_code: "8f2kq01ab3",
  owner_id: "jordan",
  members: [
    { userId: "jordan", firstName: "Jordan", lastName: "Lee", isOwner: true, joinedAt: "2026-11-01T00:00:00Z" },
    { userId: "sam", firstName: "Sam", lastName: "Chen", isOwner: false, joinedAt: "2026-11-02T00:00:00Z" },
  ],
};
const event = { name: "Design Sprint", max_team_size: 4 };

describe("toTeamView", () => {
  it("marks the signed-in student and whether they own it, without user ids", () => {
    const view = toTeamView(team, "sam");
    expect(view).toMatchObject({ id: "team-1", displayName: "Jordan's team", name: null, isOwner: false });
    expect(view.members).toEqual([
      { key: "0", name: "Jordan Lee", isOwner: true, isYou: false },
      { key: "1", name: "Sam Chen", isOwner: false, isYou: true },
    ]);
    expect(JSON.stringify(view)).not.toContain("jordan\"");
    expect(toTeamView(team, "jordan").isOwner).toBe(true);
  });
});

describe("team invites", () => {
  it("say who's inviting and how full the team is", () => {
    const invite = toTeamInvite({ ...team, name: "Pixel Pushers" }, event);
    expect(invite).toMatchObject({ teamName: "Pixel Pushers", ownerName: "Jordan Lee", maxSize: 4 });
    expect(inviteDescription(invite)).toBe(
      "Jordan Lee invited you to their Design Sprint team. 2 of 4 spots are taken."
    );
    expect(joinedDescription(invite)).toBe("You're on a team with Jordan Lee and Sam Chen.");
  });

  it("cope with no owner and no size limit", () => {
    const invite = toTeamInvite(
      { ...team, owner_id: null, members: team.members.map((m) => ({ ...m, isOwner: false })) },
      { name: "Design Sprint", max_team_size: null }
    );
    expect(invite.ownerName).toBeNull();
    expect(inviteDescription(invite)).toBe("You've been invited to a Design Sprint team.");
  });

  it("list three or more teammates with commas", () => {
    const invite = toTeamInvite(
      {
        ...team,
        members: [
          ...team.members,
          { userId: "ava", firstName: "Ava", lastName: null, isOwner: false, joinedAt: "2026-11-03T00:00:00Z" },
        ],
      },
      event
    );
    expect(joinedDescription(invite)).toBe("You're on a team with Jordan Lee, Sam Chen and Ava.");
  });
});
