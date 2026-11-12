import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALLERGY_OPTIONS, AVATAR_PRESETS, DIET_OPTIONS, interestLabel } from "./options";
import {
  isSetupStep,
  normalizeOtherAllergies,
  parseAvatarPreset,
  parseDietaryNeeds,
  parseInterests,
} from "./validation";

describe("parseDietaryNeeds", () => {
  it("accepts list ids, dropping repeats", () => {
    expect(
      parseDietaryNeeds({ diets: ["vegan", "halal", "vegan"], allergies: ["tree-nuts"], otherAllergies: [] })
    ).toEqual({ diets: ["vegan", "halal"], allergies: ["tree-nuts"], otherAllergies: [] });
  });

  it("treats all-empty as no dietary needs", () => {
    expect(parseDietaryNeeds({})).toEqual({ diets: [], allergies: [], otherAllergies: [] });
  });

  it("rejects ids from outside the lists or the wrong list", () => {
    expect(() => parseDietaryNeeds({ diets: ["paleo"] })).toThrow("diets");
    expect(() => parseDietaryNeeds({ diets: ["peanuts"] })).toThrow("diets");
    expect(() => parseDietaryNeeds({ allergies: ["Peanuts"] })).toThrow("allergies");
    expect(() => parseDietaryNeeds({ diets: "vegan" })).toThrow();
    expect(() => parseDietaryNeeds(null)).toThrow();
  });
});

describe("normalizeOtherAllergies", () => {
  it("trims, drops blanks and case-insensitive repeats", () => {
    expect(normalizeOtherAllergies([" Kiwi ", "", "kiwi", "Sesame"])).toEqual(["Kiwi", "Sesame"]);
  });

  it("holds the database's limits", () => {
    expect(() => normalizeOtherAllergies(["x".repeat(201)])).toThrow("200");
    expect(() => normalizeOtherAllergies(Array.from({ length: 21 }, (_, i) => `a${i}`))).toThrow("20");
    expect(() => normalizeOtherAllergies([1])).toThrow();
  });
});

describe("parseInterests", () => {
  it("accepts taxonomy ids only", () => {
    expect(parseInterests(["ux-research", "uxathon", "ux-research"])).toEqual(["ux-research", "uxathon"]);
    expect(parseInterests([])).toEqual([]);
    expect(() => parseInterests(["UX research"])).toThrow("interests");
    expect(() => parseInterests(undefined)).toThrow();
  });

  it("labels taxonomy ids and passes managers' free tags through", () => {
    expect(interestLabel("internships-and-co-op")).toBe("Internships and co-op");
    expect(interestLabel("Typography")).toBe("Typography");
  });
});

describe("parseAvatarPreset", () => {
  it("accepts a brand shape key only", () => {
    expect(parseAvatarPreset("starburst")).toBe("starburst");
    expect(() => parseAvatarPreset("hubbo-1")).toThrow("icon");
    expect(() => parseAvatarPreset(null)).toThrow();
  });
});

describe("isSetupStep", () => {
  it("knows the three steps and done", () => {
    expect(["dietary", "photo", "interests", "done"].every(isSetupStep)).toBe(true);
    expect(isSetupStep("welcome")).toBe(false);
  });
});

describe("options match the migration's CHECK constraints", () => {
  const migration = readFileSync("supabase/migrations/20261110030244_add_member_setup.sql", "utf8");
  const listed = (ids: readonly string[]) => `array[${ids.map((id) => `'${id}'`).join(", ")}]`;
  const inList = (ids: readonly string[]) => `(${ids.map((id) => `'${id}'`).join(", ")})`;

  it("lists the same diets, allergies and avatar presets", () => {
    expect(migration).toContain(listed(DIET_OPTIONS.map((option) => option.id)));
    expect(migration).toContain(listed(ALLERGY_OPTIONS.map((option) => option.id)));
    expect(migration).toContain(inList(AVATAR_PRESETS.map((option) => option.id)));
  });
});
