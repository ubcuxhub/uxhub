import { describe, expect, it } from "vitest";

import { formatMembershipTypeName } from "./display";

describe("formatMembershipTypeName", () => {
  it("capitalizes a single-word tier", () => {
    expect(formatMembershipTypeName("explorer")).toBe("Explorer");
  });

  it("splits camelCase tiers into words", () => {
    expect(formatMembershipTypeName("nonUbc")).toBe("Non UBC");
  });

  it("uppercases known acronyms", () => {
    expect(formatMembershipTypeName("ubc student")).toBe("UBC Student");
  });

  it("normalizes separators and stray whitespace", () => {
    expect(formatMembershipTypeName("  non-ubc  ")).toBe("Non UBC");
  });

  it("leaves an already-formatted name alone", () => {
    expect(formatMembershipTypeName("Innovator")).toBe("Innovator");
  });
});
