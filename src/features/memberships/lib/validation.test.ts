import { describe, expect, it } from "vitest";
import { validateFacultyEmail, validateStudentNumber } from "./validation";

describe("membership validation", () => {
  it.each(["12345678", " 12345678 "])(
    "accepts an eight-digit student number",
    (value) => {
      expect(validateStudentNumber(value)).toBeNull();
    }
  );

  it.each([
    ["", "Please enter your UBC student number."],
    ["1234567", "Please enter a valid UBC student number."],
    ["123456789", "Please enter a valid UBC student number."],
    ["1234abcd", "Please enter a valid UBC student number."],
  ])("rejects invalid student number %j", (value, message) => {
    expect(validateStudentNumber(value)).toBe(message);
  });

  it.each([
    "person@ubc.ca",
    "person@student.ubc.ca",
    "person@cs.ubc.ca",
    " PERSON@UBC.CA ",
  ])("accepts UBC email %s", (email) => {
    expect(validateFacultyEmail(email)).toBeNull();
  });

  it.each(["person@example.com", "person@fakeubc.ca", "person@ubc.ca.example.com"])(
    "rejects non-UBC email %s",
    (email) => {
      expect(validateFacultyEmail(email)).toContain("must end in ubc.ca");
    }
  );
});
