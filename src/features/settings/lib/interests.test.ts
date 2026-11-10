import { describe, expect, it } from "vitest";

import { mergeMemberInterests } from "./interests";

describe("mergeMemberInterests", () => {
  it("replaces the member's chips and keeps managers' free tags", () => {
    expect(mergeMemberInterests(["Figma whiz", "workshops", "uxathon"], ["mentorship"])).toEqual([
      "Figma whiz",
      "mentorship",
    ]);
  });

  it("drops a free tag that matches a chosen id ignoring case", () => {
    expect(mergeMemberInterests(["UXathon"], ["uxathon"])).toEqual(["uxathon"]);
  });

  it("deduplicates", () => {
    expect(mergeMemberInterests([], ["socials", "socials"])).toEqual(["socials"]);
  });

  it("refuses more than the column holds, saying how many are left", () => {
    const tags = Array.from({ length: 18 }, (_, index) => `Tag ${index}`);
    expect(() => mergeMemberInterests(tags, ["socials", "workshops", "uxathon"])).toThrow(
      "Choose at most 2 interests.",
    );
  });
});
