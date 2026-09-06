/**
 * Interpretation of database errors raised by the membership write path, so
 * server actions can return something a member can act on instead of a raw
 * Postgres message.
 */

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

/** The partial unique index added in `20260905120000_unique_student_number`. */
const STUDENT_NUMBER_INDEX = "idx_user_info_student_number";

export const DUPLICATE_STUDENT_NUMBER_MESSAGE =
  "That student number is already linked to another account. Contact the UX Hub team if this looks wrong.";

/**
 * True when a write failed because the student number is already on another
 * profile. Matches on the index name as well as the error code so an unrelated
 * unique violation — a duplicate email, say — is not reported as this one.
 */
export function isDuplicateStudentNumberError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return (
    code === UNIQUE_VIOLATION &&
    typeof message === "string" &&
    message.includes(STUDENT_NUMBER_INDEX)
  );
}
