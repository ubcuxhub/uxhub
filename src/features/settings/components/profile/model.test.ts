import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toDietaryValue } from "@/features/setup/components/DietaryFields";
import { FUTURE_BIRTH_DATE, INCOMPLETE_BIRTH_DATE, INVALID_BIRTH_DATE } from "@/lib/birth-date";

import {
  dietaryPayload,
  interestsPayload,
  lockedEligibilityNote,
  membershipDetail,
  membershipLabel,
  membershipSummary,
  photoPayload,
  profileErrors,
  roleLabel,
  sameFields,
  sectionBlocked,
  sectionOf,
  studentNumberError,
} from "./model";

const member = {
  membership_type_id: "innovator",
  membership_pre_ordered_type_id: null,
  membership_expires_at: "2027-09-14T12:00:00-07:00",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00-08:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("membershipSummary", () => {
  it("calls a pre-order pending, even without a membership", () => {
    const summary = membershipSummary(
      { ...member, membership_type_id: null, membership_pre_ordered_type_id: "explorer" },
      null,
      null,
    );
    expect(summary).toEqual({ kind: "pending" });
    expect(membershipLabel(summary)).toBe("Payment processing");
    expect(lockedEligibilityNote(summary)).toMatch(/payment is processing/);
  });

  it("calls no membership not a member", () => {
    const summary = membershipSummary({ ...member, membership_type_id: null }, null, null);
    expect(membershipLabel(summary)).toBe("Not a member");
    expect(membershipDetail(summary)).toBe("Not a member");
  });

  it("shows the effective end date, cut short by the club-wide term", () => {
    const summary = membershipSummary(member, "Innovator", "2027-08-31T23:59:00-07:00");
    expect(summary).toEqual({ kind: "active", name: "Innovator", expiresOn: "Aug 31, 2027" });
    expect(membershipLabel(summary)).toBe("Innovator member");
    expect(membershipDetail(summary)).toBe("Innovator member, until Aug 31, 2027");
    expect(lockedEligibilityNote(summary)).toMatch(/membership is active/);
  });

  it("says a lapsed membership ended rather than calling it current", () => {
    const summary = membershipSummary(
      { ...member, membership_expires_at: "2026-08-31T23:59:00-07:00" },
      "Innovator",
      null,
    );
    expect(summary).toEqual({ kind: "ended", name: "Innovator", endedOn: "Aug 31, 2026" });
    expect(membershipLabel(summary)).toBe("Membership ended");
    expect(membershipDetail(summary)).toBe("Innovator membership ended Aug 31, 2026");
  });

  it("falls back to Member while the membership name is unknown", () => {
    expect(membershipLabel(membershipSummary(member, null, null))).toBe("Member");
  });
});

describe("roleLabel", () => {
  it("badges admins and managers only", () => {
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("manager")).toBe("Manager");
    expect(roleLabel("basic")).toBeNull();
  });
});

const form = {
  first_name: "Maya",
  last_name: "Chen",
  preferred_pronouns: "",
  phone: "",
  student_number: "",
  faculty: "",
  major: "",
  school_institution: "",
  student_status: "" as const,
  year: "" as const,
  birth_date: "",
};

describe("profileErrors", () => {
  const context = { userType: "ubcStudent" as const, canEditEligibility: true, savedStudentNumber: "" };

  it("requires a first name", () => {
    const errors = profileErrors({ ...form, first_name: "  " }, context);
    expect(errors.first_name).toBe("Enter your first name.");
    expect(sectionBlocked("about", errors)).toBe(true);
    expect(sectionBlocked("studies", errors)).toBe(false);
  });

  it("lets a member with one name leave the last name blank", () => {
    const errors = profileErrors({ ...form, last_name: "  " }, context);
    expect(errors).not.toHaveProperty("last_name");
    expect(sectionBlocked("about", errors)).toBe(false);
  });

  it("says what's wrong with a student number, holding only studies", () => {
    const errors = profileErrors({ ...form, student_number: "1234567" }, context);
    expect(errors.student_number).toBe("Student numbers are 8 digits.");
    expect(sectionBlocked("studies", errors)).toBe(true);
    expect(sectionBlocked("about", errors)).toBe(false);
  });

  it("leaves an unchanged or locked student number alone", () => {
    expect(
      profileErrors({ ...form, student_number: "1234" }, { ...context, savedStudentNumber: "1234" })
        .student_number,
    ).toBeNull();
    expect(
      profileErrors({ ...form, student_number: "1" }, { ...context, canEditEligibility: false })
        .student_number,
    ).toBeNull();
  });

  it("checks the birthday with setup's validator, holding only About you", () => {
    expect(profileErrors(form, context).birth_date).toBeNull();
    expect(profileErrors({ ...form, birth_date: "2000-02-29" }, context).birth_date).toBeNull();

    const future = profileErrors({ ...form, birth_date: "2999-01-01" }, context);
    expect(future.birth_date).toBe(FUTURE_BIRTH_DATE);
    expect(sectionBlocked("about", future)).toBe(true);
    expect(sectionBlocked("studies", future)).toBe(false);

    // Half-typed is not cleared.
    const incomplete = profileErrors({ ...form, birth_date: INCOMPLETE_BIRTH_DATE }, context);
    expect(incomplete.birth_date).toBe(INVALID_BIRTH_DATE);
    expect(sectionBlocked("about", incomplete)).toBe(true);
  });

  it("only checks student numbers for UBC students", () => {
    expect(
      profileErrors({ ...form, student_number: "1" }, { ...context, userType: "nonUbc" }).student_number,
    ).toBeNull();
  });
});

describe("studentNumberError", () => {
  it("asks for one, checks the length, then defers to the membership rules", () => {
    expect(studentNumberError("")).toBe("Enter your 8-digit student number.");
    expect(studentNumberError("12a45678")).toBe("Student numbers are 8 digits.");
    expect(studentNumberError("11111111")).toBe("Please enter your actual UBC student number.");
    expect(studentNumberError("31415926")).toBeNull();
  });
});

describe("sections", () => {
  it("files each field under the section that saves it", () => {
    expect(sectionOf("phone")).toBe("about");
    expect(sectionOf("first_name")).toBe("about");
    expect(sectionOf("birth_date")).toBe("about");
    expect(sectionOf("student_number")).toBe("studies");
    expect(sectionOf("school_institution")).toBe("studies");
  });

  it("compares field sets with missing as empty", () => {
    expect(sameFields({ phone: "" }, {})).toBe(true);
    expect(sameFields({ phone: "1" }, { phone: "" })).toBe(false);
  });
});

describe("dietaryPayload", () => {
  const empty = { diets: [], allergies: [], otherAllergies: [] };

  it("saves 'no dietary needs' on an unanswered profile, though the lists stay empty", () => {
    const value = { ...toDietaryValue(empty, false), none: true };
    expect(dietaryPayload(value, { needs: empty, answered: false })).toEqual(empty);
    expect(dietaryPayload(value, { needs: empty, answered: true })).toBeNull();
  });

  it("ignores text typed into Other allergies until it's added", () => {
    const value = { ...toDietaryValue(empty, true), pending: "Sesa" };
    expect(dietaryPayload(value, { needs: empty, answered: true })).toBeNull();
  });

  it("ignores order", () => {
    const saved = { needs: { ...empty, diets: ["vegan", "halal"] as never }, answered: true };
    const value = toDietaryValue({ ...empty, diets: ["halal", "vegan"] }, true);
    expect(dietaryPayload(value, saved)).toBeNull();
  });
});

describe("interestsPayload and photoPayload", () => {
  it("sends interests only when the set changed", () => {
    expect(interestsPayload(["ux-research", "ui-design"], ["ui-design", "ux-research"])).toBeNull();
    expect(interestsPayload([], ["ui-design"])).toEqual([]);
  });

  it("sends a picked icon, never 'your photo'", () => {
    expect(photoPayload({ kind: "preset", preset: "flower" }, null)).toBe("flower");
    expect(photoPayload({ kind: "preset", preset: "flower" }, "flower")).toBeNull();
    expect(photoPayload({ kind: "photo" }, null)).toBeNull();
    expect(photoPayload(null, null)).toBeNull();
  });
});
