import { describe, expect, it } from "vitest";

import { characterCount, clampCharacters, shortOverviewTooLong, SHORT_OVERVIEW_MAX_LENGTH } from "./event-overview";

describe("short overview length", () => {
  it("counts code points, as Postgres length() does", () => {
    expect(characterCount("Hi \u{1F44B}")).toBe(4);
    expect("Hi \u{1F44B}".length).toBe(5);
  });

  it("allows 120 characters, emoji included", () => {
    expect(SHORT_OVERVIEW_MAX_LENGTH).toBe(120);
    expect(shortOverviewTooLong("\u{1F389}".repeat(120))).toBe(false);
    expect(shortOverviewTooLong("x".repeat(121))).toBe(true);
    expect(shortOverviewTooLong(null)).toBe(false);
  });

  it("clamps without splitting an emoji", () => {
    expect(clampCharacters("ab\u{1F389}cd", 3)).toBe("ab\u{1F389}");
    expect(clampCharacters("short", 10)).toBe("short");
  });
});
