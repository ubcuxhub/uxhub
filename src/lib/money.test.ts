import { describe, expect, it } from "vitest";

import { formatCents, formatDollars, formatPrice } from "./money";

describe("formatDollars", () => {
  it("shows two decimals and a dollar sign", () => {
    expect(formatDollars(15)).toBe("$15.00");
    expect(formatDollars(1234.5)).toBe("$1,234.50");
  });

  it("spells the code out when asked", () => {
    expect(formatDollars(12.5, { withCode: true })).toBe("$12.50 CAD");
  });
});

describe("formatCents", () => {
  it("reads cents as dollars", () => {
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(1250, { currency: "CAD", withCode: true })).toBe("$12.50 CAD");
  });
});

describe("formatPrice", () => {
  it("reads zero as Free, or the screen's own word", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice("0", { free: "No charge" })).toBe("No charge");
  });

  it("formats a numeric string the way a number formats", () => {
    expect(formatPrice("15")).toBe("$15.00");
    expect(formatPrice(15)).toBe("$15.00");
  });

  it("gives null, or the screen's own word, without a price", () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(undefined)).toBeNull();
    expect(formatPrice(" ", { unset: "Not set" })).toBe("Not set");
    expect(formatPrice(null, { unset: "Not set" })).toBe("Not set");
  });
});
