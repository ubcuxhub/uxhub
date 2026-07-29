import { describe, expect, it } from "vitest";
import { createUniqueSlug, slugify } from "./slug";

describe("slug helpers", () => {
  it.each([
    ["Hello, World!", "hello-world"],
    ["  Multiple   Words ", "multiple-words"],
    ["Déjà vu", "d-j-vu"],
    ["---", "item"],
  ])("slugifies %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("returns an unused base slug", () => {
    expect(createUniqueSlug("UX Night", ["other-event"])).toBe("ux-night");
  });

  it("increments through collisions", () => {
    expect(
      createUniqueSlug("UX Night", ["ux-night", "ux-night-1", "ux-night-2"])
    ).toBe("ux-night-3");
  });

  it("uses a custom fallback", () => {
    expect(createUniqueSlug("***", [], "event")).toBe("event");
  });
});
