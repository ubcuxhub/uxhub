import { describe, expect, it } from "vitest";
import { isEligibleForMembership } from "./policy";

describe("membership eligibility", () => {
  const baseUser = {
    faculty: null,
    faculty_email: null,
    major: null,
    membership_type_id: null,
    membership_pre_ordered_type_id: null,
    student_number: null,
    user_type: "nonUbc" as const,
    year: null,
  };

  it("allows an eligible user with no existing membership", () => {
    expect(
      isEligibleForMembership(baseUser, {
        eligible_user_types: ["nonUbc"],
      })
    ).toBe(true);
  });

  it("rejects existing members, pre-orders, and ineligible user types", () => {
    expect(
      isEligibleForMembership(
        { ...baseUser, membership_type_id: "member" },
        { eligible_user_types: ["nonUbc"] }
      )
    ).toBe(false);
    expect(
      isEligibleForMembership(
        { ...baseUser, membership_pre_ordered_type_id: "preorder" },
        { eligible_user_types: ["nonUbc"] }
      )
    ).toBe(false);
    expect(
      isEligibleForMembership(baseUser, {
        eligible_user_types: ["faculty"],
      })
    ).toBe(false);
  });

  it("requires a complete student profile for UBC students", () => {
    const student = { ...baseUser, user_type: "ubcStudent" as const };
    const membership = { eligible_user_types: ["ubcStudent" as const] };

    expect(isEligibleForMembership(student, membership)).toBe(false);
    expect(
      isEligibleForMembership(
        { ...student, student_number: 12345678 },
        membership
      )
    ).toBe(false);
    expect(
      isEligibleForMembership(
        {
          ...student,
          faculty: "Arts",
          major: "Psychology",
          student_number: 12345678,
          year: "2" as const,
        },
        membership
      )
    ).toBe(true);
  });
});
