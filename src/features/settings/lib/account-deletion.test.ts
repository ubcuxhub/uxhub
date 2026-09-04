import { describe, expect, it } from "vitest";
import { matchesConfirmationEmail } from "./account-deletion";

const ACCOUNT_EMAIL = "member@student.ubc.ca";

describe("matchesConfirmationEmail", () => {
  it.each([
    ["member@student.ubc.ca", "exact"],
    ["  member@student.ubc.ca  ", "surrounding whitespace"],
    ["MEMBER@Student.UBC.ca", "different case"],
  ])("accepts %j (%s)", (typed) => {
    expect(matchesConfirmationEmail(typed, ACCOUNT_EMAIL)).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["   ", "whitespace only"],
    ["member@ubc.ca", "a different address"],
    ["member@student.ubc.c", "a truncated address"],
    ["member @student.ubc.ca", "an interior space"],
    ["member@student.ubc.ca ,", "trailing punctuation"],
  ])("rejects %j (%s)", (typed) => {
    expect(matchesConfirmationEmail(typed, ACCOUNT_EMAIL)).toBe(false);
  });

  it("rejects anything when the account has no email", () => {
    expect(matchesConfirmationEmail("", "")).toBe(false);
    expect(matchesConfirmationEmail("   ", "   ")).toBe(false);
  });
});
