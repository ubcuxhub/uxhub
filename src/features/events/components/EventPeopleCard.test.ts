import { describe, expect, it } from "vitest";

import { sectionNoun } from "./EventPeopleCard";

describe("sectionNoun", () => {
  it("counts the standard sections by their own noun", () => {
    expect(sectionNoun("Judges")).toEqual({ singular: "judge", plural: "judges" });
    expect(sectionNoun("Mentors")).toEqual({ singular: "mentor", plural: "mentors" });
    expect(sectionNoun("Speakers")).toEqual({ singular: "speaker", plural: "speakers" });
    expect(sectionNoun("Panelists")).toEqual({ singular: "panelist", plural: "panelists" });
  });

  it("ignores case and surrounding space, as the database does", () => {
    expect(sectionNoun("  judges ")).toEqual({ singular: "judge", plural: "judges" });
  });

  it("counts people in a custom section", () => {
    expect(sectionNoun("Organizers")).toEqual({ singular: "person", plural: "people" });
  });
});
