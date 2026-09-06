import { describe, expect, it } from "vitest";
import { validateFacultyEmail, validateStudentNumber } from "./validation";

describe("membership validation", () => {
  it.each(["10000001", " 28471936 "])(
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
    "00000000",
    "11111111",
    "12121212",
    "12341234",
    "12345678",
    "87654321",
    "90123456",
  ])("rejects obvious fake student number %s", (value) => {
    expect(validateStudentNumber(value)).toBe(
      "Please enter your actual UBC student number.",
    );
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
