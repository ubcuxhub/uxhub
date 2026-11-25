/**
 * `user_info.birth_date`: one validator for the admin user record, member
 * setup and Settings › Profile, so all three accept and refuse the same
 * dates with the same copy. Dependency-free, so client and server share it.
 */

export const INVALID_BIRTH_DATE = "Enter a valid birth date.";
export const FUTURE_BIRTH_DATE = "Birth date cannot be in the future.";

/**
 * What a birthday input holds while the date typed into it is incomplete or
 * impossible (`validity.badInput`): the browser reports "" then, which would
 * read as clearing the birthday. Never stored; `validateBirthDate` refuses it.
 */
export const INCOMPLETE_BIRTH_DATE = "incomplete";

/**
 * Today as `YYYY-MM-DD` in UTC, the latest birth date allowed. The database's
 * check (`birth_date <= current_date`) runs in UTC too.
 */
export function latestBirthDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * A real calendar date, not after today, as `YYYY-MM-DD`; null and "" clear
 * it. Throws with copy fit to show.
 */
export function validateBirthDate(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(INVALID_BIRTH_DATE);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < "0001-01-01") {
    throw new Error(INVALID_BIRTH_DATE);
  }
  if (value > latestBirthDate()) throw new Error(FUTURE_BIRTH_DATE);
  return value;
}

/** The message `validateBirthDate` would throw for what an input holds, or null. */
export function birthDateError(value: string): string | null {
  try {
    validateBirthDate(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : INVALID_BIRTH_DATE;
  }
}
