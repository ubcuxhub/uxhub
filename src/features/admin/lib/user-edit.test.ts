import { describe, expect, it } from "vitest";

import type { UserRecord } from "../types";
import { createUserEditDraft, isUbcVerifiedNow, userEditChanges } from "./user-edit";

const RECENT = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const user = {
  id: "dora",
  first_name: "Dora",
  last_name: "Hu",
  email: "dora@example.com",
  phone: null,
  newsletter: false,
  membership_type_id: null,
  membership_type_name: null,
  membership_expires_at: null,
  membership_pre_ordered_type_id: null,
  major: null,
  student_number: 28471936,
  faculty: null,
  year: null,
  order_date_deprecated: null,
  school_institution: null,
  birth_date: null,
  interests: [],
  role_access: "basic",
  user_type: "ubcStudent",
  ubc_email: "dora@student.ubc.ca",
  ubc_verified_at: RECENT,
  ubc_verified_via: "code",
} as unknown as UserRecord;

function withStudentNumber(value: string) {
  const draft = createUserEditDraft(user);
  return userEditChanges(user, { ...draft, fields: { ...draft.fields, student_number: value } }, []);
}

describe("admin student number", () => {
  it("uses the member-side rule: 8 digits, no obvious fakes", () => {
    expect(withStudentNumber("38475610")).toEqual({ student_number: 38475610 });
    expect(() => withStudentNumber("12345")).toThrow("Enter a valid 8-digit student number.");
    expect(() => withStudentNumber("123456789")).toThrow("Enter a valid 8-digit student number.");
    expect(() => withStudentNumber("12345678")).toThrow("Enter a real student number");
    expect(() => withStudentNumber("11111111")).toThrow("Enter a real student number");
  });

  it("still lets a manager clear it", () => {
    expect(withStudentNumber("")).toEqual({ student_number: null });
  });
});

describe("the Verified box", () => {
  it("starts checked for any verification that counts now", () => {
    expect(createUserEditDraft(user).verified).toBe(true);
    expect(isUbcVerifiedNow({ ...user, ubc_verified_via: "sign_in_email" }, null)).toBe(true);
    expect(isUbcVerifiedNow({ ...user, ubc_verified_at: null, ubc_verified_via: null }, null)).toBe(false);
    // Grandfathered counts while the membership runs.
    const grandfathered = { ...user, ubc_verified_via: "grandfathered", membership_type_id: "tier" } as UserRecord;
    expect(isUbcVerifiedNow(grandfathered, null)).toBe(true);
    expect(isUbcVerifiedNow(grandfathered, "2020-01-01T00:00:00Z")).toBe(false);
  });
});
