/**
 * Local validation helpers for the membership wizard. These confirm the shape
 * and basic plausibility of an identifier, not its real-world validity against
 * any UBC system. UBC addresses are checked by `validateUbcEmail` in
 * `./ubc-verification`. Each returns an error message string, or `null` when valid.
 */

// UBC student numbers are 8 digits.
const STUDENT_NUMBER_PATTERN = /^\d{8}$/;
const REPEATING_BLOCK_LENGTHS = [1, 2, 4];

function isObviousFakeStudentNumber(value: string) {
  const repeatsShortBlock = REPEATING_BLOCK_LENGTHS.some(
    (length) => value.slice(0, length).repeat(value.length / length) === value,
  );
  if (repeatsShortBlock) return true;

  const digits = Array.from(value, Number);
  const isSequence = (step: 1 | -1) =>
    digits.slice(1).every((digit, index) => {
      const previous = digits[index];
      return digit === (previous + step + 10) % 10;
    });

  return isSequence(1) || isSequence(-1);
}

export function validateStudentNumber(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Please enter your UBC student number.";
  if (!STUDENT_NUMBER_PATTERN.test(value)) {
    return "Please enter a valid UBC student number.";
  }
  if (isObviousFakeStudentNumber(value)) {
    return "Please enter your actual UBC student number.";
  }
  return null;
}
