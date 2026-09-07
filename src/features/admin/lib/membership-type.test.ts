import { describe, expect, it } from "vitest";

import {
  parseMembershipPrice,
  validateMembershipTypeInput,
} from "./membership-type";

describe("parseMembershipPrice", () => {
  it("accepts whole numbers and one or two decimals", () => {
    expect(parseMembershipPrice("12")).toBe(12);
    expect(parseMembershipPrice("12.5")).toBe(12.5);
    expect(parseMembershipPrice("12.50")).toBe(12.5);
  });

  it("trims surrounding whitespace", () => {
    expect(parseMembershipPrice("  18.00  ")).toBe(18);
  });

  it("accepts a free tier", () => {
    expect(parseMembershipPrice("0")).toBe(0);
  });

  it("rejects more precision than the column keeps", () => {
    expect(parseMembershipPrice("12.505")).toBeNull();
  });

  it("rejects negatives, blanks, and junk", () => {
    expect(parseMembershipPrice("-1")).toBeNull();
    expect(parseMembershipPrice("")).toBeNull();
    expect(parseMembershipPrice("   ")).toBeNull();
    expect(parseMembershipPrice("$12")).toBeNull();
    expect(parseMembershipPrice("twelve")).toBeNull();
    expect(parseMembershipPrice("1e3")).toBeNull();
  });

  it("rejects a price wider than numeric(10,2)", () => {
    expect(parseMembershipPrice("100000000")).toBeNull();
  });
});

describe("validateMembershipTypeInput", () => {
  const valid = { active: true, description: "Entry to events.", price: 12 };

  it("passes a complete edit", () => {
    expect(validateMembershipTypeInput(valid)).toBeNull();
  });

  it("rejects an empty description", () => {
    expect(validateMembershipTypeInput({ ...valid, description: "   " })).toBe(
      "Enter a description.",
    );
  });

  it("rejects a negative or non-finite price", () => {
    expect(validateMembershipTypeInput({ ...valid, price: -1 })).toBe(
      "Enter a valid price.",
    );
    expect(validateMembershipTypeInput({ ...valid, price: Number.NaN })).toBe(
      "Enter a valid price.",
    );
  });
});
