import { describe, expect, it } from "vitest";
import {
  DUPLICATE_STUDENT_NUMBER_MESSAGE,
  isDuplicateStudentNumberError,
} from "./errors";

// Shaped like the PostgrestError supabase-js returns for a unique violation.
const duplicateStudentNumber = {
  code: "23505",
  message:
    'duplicate key value violates unique constraint "idx_user_info_student_number"',
  details: null,
  hint: null,
};

describe("isDuplicateStudentNumberError", () => {
  it("recognizes a student number unique violation", () => {
    expect(isDuplicateStudentNumberError(duplicateStudentNumber)).toBe(true);
  });

  it("ignores a unique violation on another column", () => {
    expect(
      isDuplicateStudentNumberError({
        ...duplicateStudentNumber,
        message:
          'duplicate key value violates unique constraint "user_info_old_email_key"',
      })
    ).toBe(false);
  });

  it("ignores another error code on the same index", () => {
    expect(
      isDuplicateStudentNumberError({ ...duplicateStudentNumber, code: "23503" })
    ).toBe(false);
  });

  it.each([null, undefined, "23505", new Error("boom"), {}])(
    "ignores non-Postgrest value %j",
    (value) => {
      expect(isDuplicateStudentNumberError(value)).toBe(false);
    }
  );

  it("exposes a message that does not leak the constraint name", () => {
    expect(DUPLICATE_STUDENT_NUMBER_MESSAGE).not.toContain("idx_");
  });
});
