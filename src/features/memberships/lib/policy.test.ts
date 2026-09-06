import { describe, expect, it } from "vitest";
import {
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
        { ...student, student_number: 12345678 },
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
          student_number: 12345678,
          year: "2" as const,
        },
        membership,
        null
      )
    ).toBe(true);
  });
});
