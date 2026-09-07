/**
 * Validation for the membership tier fields Club Settings can edit.
 *
 * Kept pure and separate from the server action so the rules the UI enforces
 * and the rules the database enforces stay testable together: `price` is
 * `numeric(10,2)` with a `price >= 0` check constraint, and `description` is
 * `NOT NULL`. Anything this accepts, the column accepts.
 */

export interface MembershipTypeInput {
  active: boolean;
  description: string;
  price: number;
}

/**
 * Parses a typed price into the two-decimal number the column stores, or null
 * when it is not one. Rejects negatives, blanks, and anything carrying more
 * precision than the column keeps — silently rounding a third decimal away
 * would charge a price the admin never typed.
 */
export function parseMembershipPrice(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const price = Number(trimmed);
  if (!Number.isFinite(price)) return null;
  // numeric(10,2) leaves eight digits ahead of the decimal point.
  if (price > 99_999_999.99) return null;

  return price;
}

/** The first problem with an edit, or null when it is saveable. */
export function validateMembershipTypeInput(
  input: MembershipTypeInput
): string | null {
  if (!input.description.trim()) {
    return "Enter a description.";
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return "Enter a valid price.";
  }
  return null;
}
