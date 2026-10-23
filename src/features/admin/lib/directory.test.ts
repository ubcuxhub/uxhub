import { describe, expect, it } from "vitest";

import { displaySchool } from "./directory";

describe("displaySchool", () => {
  it("derives UBC for students and faculty, whose school sign-up clears", () => {
    expect(displaySchool({ school_institution: null, user_type: "ubcStudent" })).toBe("University of British Columbia");
    expect(displaySchool({ school_institution: null, user_type: "faculty" })).toBe("University of British Columbia");
  });

  it("shows a non-UBC member's own school, or nothing when they gave none", () => {
    expect(displaySchool({ school_institution: "SFU", user_type: "nonUbc" })).toBe("SFU");
    expect(displaySchool({ school_institution: null, user_type: "nonUbc" })).toBeNull();
  });
});
