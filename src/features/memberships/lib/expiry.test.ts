import { describe, expect, it } from "vitest";
import {
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
