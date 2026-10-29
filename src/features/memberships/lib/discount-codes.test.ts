import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getActiveDiscountCodes, type DiscountCode } from "./discount-codes";

// Ends with March 31, 2027 in Vancouver (PDT, UTC-7).
const code: DiscountCode = {
  businessName: "Test Shop",
  url: "https://example.com",
  description: "10% off",
  code: "TEST",
  expiresAt: "2027-03-31T23:59:59.999-07:00",
};

describe("getActiveDiscountCodes", () => {
  it("drops a code once it has expired", () => {
    expect(getActiveDiscountCodes([code], new Date("2027-04-02T12:00:00-07:00"))).toEqual([]);
  });

  it("keeps a code through the end of its expiry day in Vancouver time", () => {
    // 11:30 p.m. on March 31 in Vancouver is already April 1 in UTC.
    expect(getActiveDiscountCodes([code], new Date("2027-03-31T23:30:00-07:00"))).toEqual([code]);
    // Midnight in Vancouver ends it.
    expect(getActiveDiscountCodes([code], new Date("2027-04-01T00:00:00-07:00"))).toEqual([]);
  });

  it("returns nothing when there are no codes", () => {
    expect(getActiveDiscountCodes([], new Date("2026-10-28T12:00:00-07:00"))).toEqual([]);
  });
});
