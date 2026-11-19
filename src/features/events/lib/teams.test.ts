import { describe, expect, it } from "vitest";

import {
  displayInviteLink,
  formatTeamDeadline,
  inviteLinkPath,
  memberCountLabel,
  memberName,
  parseInviteCode,
  spotsLeftLabel,
  teamDisplayName,
  teamsLocked,
} from "./teams";

const member = (overrides: Partial<Parameters<typeof teamDisplayName>[0]["members"][number]> = {}) => ({
  userId: "u1",
  firstName: "Aubrey",
  lastName: "Ventura",
  isOwner: true,
  joinedAt: "2026-11-01T00:00:00Z",
  ...overrides,
});

describe("parseInviteCode", () => {
  it.each([
    ["https://ubcuxhub.ca/join/8f2kq01ab3", "8f2kq01ab3"],
    ["ubcuxhub.ca/join/8f2kq01ab3", "8f2kq01ab3"],
    ["http://localhost:3000/join/8F2KQ01AB3/?ref=slack#top", "8f2kq01ab3"],
    ["  8f2kq01ab3  ", "8f2kq01ab3"],
  ])("reads %s", (input, code) => {
    expect(parseInviteCode(input)).toBe(code);
  });

  it.each(["", "   ", "not a link at all", "ubcuxhub.ca/events", "%E0%A4%A"])(
    "rejects %j",
    (input) => {
      expect(parseInviteCode(input)).toBeNull();
    }
  );
});

describe("invite links", () => {
  it("point at /join/<code> and print without the scheme", () => {
    expect(inviteLinkPath("8f2kq01ab3")).toBe("/join/8f2kq01ab3");
    expect(displayInviteLink("https://ubcuxhub.ca/join/8f2kq01ab3")).toBe("ubcuxhub.ca/join/8f2kq01ab3");
  });
});

describe("memberName", () => {
  it("joins first and last name, and falls back when both are missing", () => {
    expect(memberName({ firstName: "Jordan", lastName: "Lee" })).toBe("Jordan Lee");
    expect(memberName({ firstName: "Jordan", lastName: null })).toBe("Jordan");
    expect(memberName({ firstName: null, lastName: null })).toBe("Teammate");
  });
});

describe("teamDisplayName", () => {
  it("uses the team's name when it has one", () => {
    expect(teamDisplayName({ name: "Pixel Pushers", members: [member()] })).toBe("Pixel Pushers");
  });

  it("names an unnamed team after its owner", () => {
    expect(teamDisplayName({ name: null, members: [member({ isOwner: false, firstName: "Sam" }), member()] })).toBe(
      "Aubrey's team"
    );
  });

  it("falls back when the team has no owner", () => {
    expect(teamDisplayName({ name: null, members: [member({ isOwner: false })] })).toBe("Your team");
  });
});

describe("member counts", () => {
  it("counts against the limit, or alone without one", () => {
    expect(memberCountLabel(3, 4)).toBe("3 of 4 members");
    expect(memberCountLabel(0, 4)).toBe("0 of 4 members");
    expect(memberCountLabel(1, null)).toBe("1 member");
    expect(memberCountLabel(2, null)).toBe("2 members");
  });

  it("says how many spots are left", () => {
    expect(spotsLeftLabel(3, 4)).toBe("1 spot left. Share the invite link to fill it.");
    expect(spotsLeftLabel(1, 4)).toBe("3 spots left. Share the invite link to fill them.");
    expect(spotsLeftLabel(4, 4)).toBe("Your team is full.");
    expect(spotsLeftLabel(2, null)).toBeNull();
  });
});

describe("team deadline", () => {
  it("formats in Pacific time", () => {
    // BC keeps UTC-7 all year from 2026, so 06:59 UTC on Nov 14 is 11:59 PM on Nov 13.
    expect(formatTeamDeadline("2026-11-14T06:59:00Z")).toBe("Nov 13 at 11:59 PM");
  });

  it("locks once the deadline passes, and never without one", () => {
    const now = Date.parse("2026-11-13T12:00:00Z");
    expect(teamsLocked("2026-11-13T11:00:00Z", now)).toBe(true);
    expect(teamsLocked("2026-11-13T13:00:00Z", now)).toBe(false);
    expect(teamsLocked(null, now)).toBe(false);
  });
});
