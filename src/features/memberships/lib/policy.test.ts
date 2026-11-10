import { describe, expect, it } from "vitest";
import {
  buildEligibilityUpdate,
  CHANGE_USER_TYPE_PATH,
  confirmedJoinPath,
  hasActiveOrPendingMembership,
  isEligibleForMembership,
  isMembershipProfileComplete,
  userTypeConfirmation,
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
    ubc_email: null,
    ubc_verified_at: null,
    ubc_verified_via: null,
    user_type: "nonUbc" as const,
    year: null,
  };

  const nonUbcTier = {
    active: true,
    eligible_user_types: ["nonUbc" as const],
  };

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
        { active: true, eligible_user_types: ["faculty"] },
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

  it("rejects inactive membership tiers", () => {
    expect(
      isEligibleForMembership(
        baseUser,
        { ...nonUbcTier, active: false },
        null,
      ),
    ).toBe(false);
  });

  const RECENT = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const studentTier = {
    active: true,
    eligible_user_types: ["ubcStudent" as const],
  };
  const completeStudent = {
    ...baseUser,
    user_type: "ubcStudent" as const,
    faculty: "Arts",
    major: "Psychology",
    student_number: 28471936,
    year: "2" as const,
    ubc_email: "jane@student.ubc.ca",
    ubc_verified_at: RECENT,
    ubc_verified_via: "code" as const,
  };

  it("requires a complete student profile for UBC students", () => {
    const student = { ...baseUser, user_type: "ubcStudent" as const };

    expect(isEligibleForMembership(student, studentTier, null)).toBe(false);
    expect(
      isEligibleForMembership(
        { ...student, student_number: 28471936 },
        studentTier,
        null
      )
    ).toBe(false);
    expect(isEligibleForMembership(completeStudent, studentTier, null)).toBe(true);
  });

  it("needs a UBC student address on file", () => {
    expect(isMembershipProfileComplete(completeStudent)).toBe(true);
    expect(isMembershipProfileComplete({ ...completeStudent, ubc_email: null })).toBe(false);
    expect(
      isMembershipProfileComplete({ ...completeStudent, ubc_email: "jane@ubc.ca" }),
    ).toBe(false);
  });

  it("needs a faculty address that passes the faculty rule", () => {
    const faculty = { ...baseUser, user_type: "faculty" as const };
    expect(isMembershipProfileComplete({ ...faculty, ubc_email: "prof@cs.ubc.ca" })).toBe(true);
    expect(isMembershipProfileComplete({ ...faculty, ubc_email: "prof@student.ubc.ca" })).toBe(false);
    // The legacy column alone no longer counts.
    expect(isMembershipProfileComplete({ ...faculty, faculty_email: "prof@ubc.ca" })).toBe(false);
  });

  it("refuses a UBC tier until the UBC address is verified for purchase", () => {
    expect(
      isEligibleForMembership(
        { ...completeStudent, ubc_verified_at: null, ubc_verified_via: null },
        studentTier,
        null,
      ),
    ).toBe(false);
    // Grandfathering covers the membership held at migration, never a purchase.
    expect(
      isEligibleForMembership(
        { ...completeStudent, ubc_verified_via: "grandfathered" },
        studentTier,
        null,
      ),
    ).toBe(false);
    expect(
      isEligibleForMembership(
        { ...completeStudent, ubc_verified_at: PAST, ubc_verified_via: "manual" },
        studentTier,
        null,
      ),
    ).toBe(false);
    expect(
      isEligibleForMembership(
        { ...completeStudent, ubc_verified_via: "manual" },
        studentTier,
        null,
      ),
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
    // The UBC address is owned too, and untouched when not given.
    expect("ubc_email" in update).toBe(false);
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
      ubc_email: null,
    });
  });

  it("stores a faculty member's UBC address, mirrored into the legacy faculty email", () => {
    expect(
      buildEligibilityUpdate({
        userType: "faculty",
        studentNumber: null,
        faculty: "Faculty of Arts",
        ubcEmail: " Prof@CS.ubc.ca ",
      })
    ).toMatchObject({
      user_type: "faculty",
      faculty: "Faculty of Arts",
      ubc_email: "prof@cs.ubc.ca",
      faculty_email: "prof@cs.ubc.ca",
    });
  });

  it("stores a student's UBC address but clears the faculty email", () => {
    const student = buildEligibilityUpdate({
      userType: "ubcStudent",
      studentNumber: 28471936,
      ubcEmail: "jane@student.ubc.ca",
    });
    expect(student.ubc_email).toBe("jane@student.ubc.ca");
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

describe("join skips an answered \"What best describes you?\"", () => {
  const answered = { user_type: "faculty" as const, user_type_confirmed_at: PAST };

  it("goes straight to the details for the answered type", () => {
    expect(confirmedJoinPath(answered, false)).toBe("/portal/membership/join/faculty");
    expect(
      confirmedJoinPath({ user_type: "nonUbc", user_type_confirmed_at: PAST }, false),
    ).toBe("/portal/membership/join/non-ubc");
  });

  it("asks when the type was never answered, whatever the stored default", () => {
    expect(
      confirmedJoinPath({ user_type: "ubcStudent", user_type_confirmed_at: null }, false),
    ).toBeNull();
  });

  it("asks again when the member chose to change it", () => {
    expect(confirmedJoinPath(answered, true)).toBeNull();
    expect(CHANGE_USER_TYPE_PATH).toBe("/portal/membership/join?change=1");
  });

  it("stamps the answer when a join or Settings save writes the type", () => {
    expect(userTypeConfirmation(new Date(FUTURE))).toEqual({ user_type_confirmed_at: FUTURE });
  });
});
