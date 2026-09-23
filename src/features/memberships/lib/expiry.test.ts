import { describe, expect, it } from "vitest";
import {
  getEffectiveMembershipExpiry,
  hasActiveMembership,
  isMembershipTermClosed,
  resolveMembershipExpiry,
  termEndsBeforeFullYear,
} from "./expiry";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const ONE_YEAR_OUT = "2027-09-05T12:00:00.000Z";

describe("resolveMembershipExpiry", () => {
  it("gives a full year when no term end is set", () => {
    expect(resolveMembershipExpiry(null, NOW)).toBe(ONE_YEAR_OUT);
  });

  it("stops at the term end when it lands inside the year", () => {
    expect(
      resolveMembershipExpiry("2026-12-31T23:59:59.000Z", NOW)
    ).toBe("2026-12-31T23:59:59.000Z");
  });

  it("still gives a full year when the term end is further out", () => {
    expect(resolveMembershipExpiry("2030-01-01T00:00:00.000Z", NOW)).toBe(
      ONE_YEAR_OUT
    );
  });

  it("falls back to a full year for an unparseable term end", () => {
    expect(resolveMembershipExpiry("not a date", NOW)).toBe(ONE_YEAR_OUT);
  });
});

describe("isMembershipTermClosed", () => {
  it.each([
    [null, false],
    ["2026-09-06T00:00:00.000Z", false],
    ["2026-09-04T00:00:00.000Z", true],
    // The instant the term ends counts as closed, not as a last chance.
    ["2026-09-05T12:00:00.000Z", true],
    ["not a date", false],
  ])("term end %s -> closed %s", (termEndsAt, expected) => {
    expect(isMembershipTermClosed(termEndsAt, NOW)).toBe(expected);
  });
});

describe("termEndsBeforeFullYear", () => {
  it("is true only when the term end shortens the year", () => {
    expect(termEndsBeforeFullYear("2026-12-31T00:00:00.000Z", NOW)).toBe(true);
    expect(termEndsBeforeFullYear("2030-01-01T00:00:00.000Z", NOW)).toBe(false);
    expect(termEndsBeforeFullYear(null, NOW)).toBe(false);
  });

  it("is false once the term has already closed, since nothing is for sale", () => {
    expect(termEndsBeforeFullYear("2020-01-01T00:00:00.000Z", NOW)).toBe(false);
  });
});

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

  it("returns null for a user without a membership", () => {
    expect(
      getEffectiveMembershipExpiry(
        { membership_type_id: null, membership_expires_at: null },
        SOON
      )
    ).toBe(null);
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
