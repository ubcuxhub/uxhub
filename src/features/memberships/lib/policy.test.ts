import { describe, expect, it } from "vitest";
import {
  buildEligibilityUpdate,
  hasActiveOrPendingMembership,
  isEligibleForMembership,
} from "./policy";

const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

describe("membership eligibility", () => {
  const baseUser = {
    faculty: null,
    faculty_email: null,
    major: null,
    membership_expires_at: null,
    membership_type_id: null,
    membership_pre_ordered_type_id: null,
    student_number: null,
    user_type: "nonUbc" as const,
    year: null,
  };

  const nonUbcTier = { eligible_user_types: ["nonUbc" as const] };

  it("allows an eligible user with no existing membership", () => {
    expect(isEligibleForMembership(baseUser, nonUbcTier, null)).toBe(true);
  });

  it("rejects existing members, pre-orders, and ineligible user types", () => {
    expect(
      isEligibleForMembership(
        { ...baseUser, membership_type_id: "member" },
        nonUbcTier,
        null
      )
    ).toBe(false);
    expect(
      isEligibleForMembership(
        { ...baseUser, membership_pre_ordered_type_id: "preorder" },
        nonUbcTier,
        null
      )
    ).toBe(false);
    expect(
      isEligibleForMembership(
        baseUser,
        { eligible_user_types: ["faculty"] },
        null
      )
    ).toBe(false);
  });

  it("lets a lapsed member buy again", () => {
    const lapsed = {
      ...baseUser,
      membership_expires_at: PAST,
      membership_type_id: "member",
    };

    expect(isEligibleForMembership(lapsed, nonUbcTier, null)).toBe(true);
    expect(
      isEligibleForMembership(
        { ...lapsed, membership_expires_at: FUTURE },
        nonUbcTier,
        null
      )
    ).toBe(false);
  });

  it("keeps blocking a pending pre-order even once it has lapsed", () => {
    expect(
      isEligibleForMembership(
        {
          ...baseUser,
          membership_expires_at: PAST,
          membership_pre_ordered_type_id: "preorder",
        },
        nonUbcTier,
        null
      )
    ).toBe(false);
  });

  it("treats a passed term end as a lapsed membership", () => {
    const member = {
      ...baseUser,
      membership_expires_at: FUTURE,
      membership_type_id: "member",
    };

    // The member's own expiry is years out, but the club-wide term already
    // ended, so they no longer hold a membership that blocks buying another.
    expect(hasActiveOrPendingMembership(member, null)).toBe(true);
    expect(hasActiveOrPendingMembership(member, PAST)).toBe(false);
  });

  it("sells nothing once the term has ended", () => {
    expect(isEligibleForMembership(baseUser, nonUbcTier, PAST)).toBe(false);
    expect(isEligibleForMembership(baseUser, nonUbcTier, FUTURE)).toBe(true);
  });

  it("requires a complete student profile for UBC students", () => {
    const student = { ...baseUser, user_type: "ubcStudent" as const };
    const membership = { eligible_user_types: ["ubcStudent" as const] };

    expect(isEligibleForMembership(student, membership, null)).toBe(false);
    expect(
      isEligibleForMembership(
        { ...student, student_number: 28471936 },
        membership,
        null
      )
    ).toBe(false);
    expect(
      isEligibleForMembership(
        {
          ...student,
          faculty: "Arts",
          major: "Psychology",
          student_number: 28471936,
          year: "2" as const,
        },
        membership,
        null
      )
    ).toBe(true);
  });
});

describe("buildEligibilityUpdate", () => {
  it("keeps a UBC student's own columns when their student number changes", () => {
    const update = buildEligibilityUpdate({
      userType: "ubcStudent",
      studentNumber: 28471936,
      faculty: "Faculty of Arts",
    });
    expect(update).toEqual({
      user_type: "ubcStudent",
      student_number: 28471936,
      faculty: "Faculty of Arts",
      faculty_email: null,
      school_institution: null,
      student_status: null,
    });
    // Owned but unmentioned: left alone rather than nulled.
    expect("major" in update).toBe(false);
    expect("year" in update).toBe(false);
  });

  it("leaves the faculty untouched when the caller omits it", () => {
    const update = buildEligibilityUpdate({
      userType: "ubcStudent",
      studentNumber: 28471936,
    });
    expect("faculty" in update).toBe(false);
    expect(update.student_number).toBe(28471936);
  });

  it("clears every column an off-campus classification does not own", () => {
    expect(
      buildEligibilityUpdate({
        userType: "nonUbc",
        studentNumber: null,
        faculty: "Faculty of Arts",
      })
    ).toEqual({
      user_type: "nonUbc",
      faculty: null,
      faculty_email: null,
      major: null,
      student_number: null,
    });
  });

  it("stores the verified faculty email alongside the faculty", () => {
    expect(
      buildEligibilityUpdate({
        userType: "faculty",
        studentNumber: null,
        faculty: "Faculty of Arts",
        facultyEmail: "prof@cs.ubc.ca",
      })
    ).toMatchObject({
      user_type: "faculty",
      faculty: "Faculty of Arts",
      faculty_email: "prof@cs.ubc.ca",
    });
  });

  it("only writes the faculty email for a faculty classification", () => {
    const student = buildEligibilityUpdate({
      userType: "ubcStudent",
      studentNumber: 28471936,
      facultyEmail: "prof@cs.ubc.ca",
    });
    // Not an owned column here, so it is cleared rather than stored.
    expect(student.faculty_email).toBeNull();
  });

  it("clears the student columns a faculty classification does not own", () => {
    expect(
      buildEligibilityUpdate({
        userType: "faculty",
        studentNumber: null,
        faculty: "  ",
      })
    ).toEqual({
      user_type: "faculty",
      faculty: null,
      major: null,
      school_institution: null,
      student_number: null,
      student_status: null,
      year: null,
    });
  });
});
