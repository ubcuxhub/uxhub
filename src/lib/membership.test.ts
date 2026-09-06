import { describe, expect, it } from "vitest";
import { getEffectiveMembershipExpiry, hasActiveMembership } from "./membership";

const PAST = "2020-01-01T00:00:00.000Z";
const SOON = "2030-01-01T00:00:00.000Z";
const LATER = "2040-01-01T00:00:00.000Z";

const member = {
  membership_type_id: "tier",
  membership_expires_at: LATER,
};

describe("getEffectiveMembershipExpiry", () => {
  it.each([
    ["neither set", null, null, null],
    ["only the member's own expiry", LATER, null, LATER],
    ["only the term end", null, SOON, SOON],
    ["term end is earlier", LATER, SOON, SOON],
    ["own expiry is earlier", SOON, LATER, SOON],
  ])("%s", (_label, own, termEndsAt, expected) => {
    expect(
      getEffectiveMembershipExpiry(
        { membership_type_id: "tier", membership_expires_at: own },
        termEndsAt
      )
    ).toBe(expected);
  });

  it("returns null for a missing user", () => {
    expect(getEffectiveMembershipExpiry(null, null)).toBe(null);
  });
});

describe("hasActiveMembership", () => {
  it("requires a membership type", () => {
    expect(hasActiveMembership(null, null)).toBe(false);
    expect(
      hasActiveMembership(
        { membership_type_id: null, membership_expires_at: LATER },
        null
      )
    ).toBe(false);
  });

  it("treats an unset expiry as never expiring", () => {
    expect(
      hasActiveMembership(
        { membership_type_id: "tier", membership_expires_at: null },
        null
      )
    ).toBe(true);
  });

  it("ends a membership once the member's own expiry passes", () => {
    expect(
      hasActiveMembership(
        { membership_type_id: "tier", membership_expires_at: PAST },
        null
      )
    ).toBe(false);
  });

  it("ends a membership once the term end passes, whatever the member's own expiry says", () => {
    expect(hasActiveMembership(member, null)).toBe(true);
    expect(hasActiveMembership(member, PAST)).toBe(false);
  });

  it("keeps a membership active while both dates are in the future", () => {
    expect(hasActiveMembership(member, SOON)).toBe(true);
  });

  it("restores a member when the term end is cleared", () => {
    // The read-time check is what makes the date reversible: nothing was
    // written to the member when it was set, so removing it brings them back.
    expect(hasActiveMembership(member, PAST)).toBe(false);
    expect(hasActiveMembership(member, null)).toBe(true);
  });
});
