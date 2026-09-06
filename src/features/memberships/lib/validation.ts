/**
 * Format-only validation helpers for the membership wizard. These confirm the
 * shape of an identifier (not its real-world validity against any UBC system).
 * Each returns an error message string, or `null` when the input is valid.
 */

// UBC student numbers are 8 digits, e.g. "12345678".
const STUDENT_NUMBER_PATTERN = /^\d{8}$/;

// Matches UBC email addresses on any ubc.ca subdomain, e.g. "x@ubc.ca",
// "x@cs.ubc.ca", "x@student.ubc.ca".
const UBC_EMAIL_PATTERN = /^[^\s@]+@([a-z0-9-]+\.)*ubc\.ca$/i;

export function validateStudentNumber(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Please enter your UBC student number.";
  if (!STUDENT_NUMBER_PATTERN.test(value)) {
    return "Please enter a valid UBC student number.";
  }
  return null;
}

export function validateFacultyEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Please enter your UBC faculty email.";
  if (!UBC_EMAIL_PATTERN.test(value)) {
    return "Enter a valid UBC email address (must end in ubc.ca).";
  }
  return null;
}
