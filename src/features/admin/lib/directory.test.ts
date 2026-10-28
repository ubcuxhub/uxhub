import { describe, expect, it } from "vitest";

import { displaySchool } from "./directory";

describe("displaySchool", () => {
  it.each(["explorer", "innovator", "faculty", null, undefined])("defaults to UBC for membership %s even with a previous institution", (membership_type_name) => {
    expect(displaySchool({ school_institution: "SFU", membership_type_name })).toBe("University of British Columbia");
  });

  it("shows a Non-UBC member's own school, or nothing when they gave none", () => {
    expect(displaySchool({ school_institution: "SFU", membership_type_name: "nonUbc" })).toBe("SFU");
    expect(displaySchool({ school_institution: null, membership_type_name: "nonUbc" })).toBeNull();
  });

  it("uses the draft membership when supplied", () => {
    expect(displaySchool({ school_institution: "SFU", membership_type_name: "nonUbc" }, null)).toBe("University of British Columbia");
  });
});
