import { describe, expect, it } from "vitest";

import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_HINT,
  PASSWORD_TOO_SHORT_ERROR,
  isPasswordLongEnough,
} from "./password-rules";

describe("password rules", () => {
  it("shares one length between the hint, the error and the check", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(PASSWORD_HINT).toBe("At least 8 characters.");
    expect(PASSWORD_TOO_SHORT_ERROR).toBe("Use at least 8 characters.");
    expect(isPasswordLongEnough("1234567")).toBe(false);
    expect(isPasswordLongEnough("12345678")).toBe(true);
  });
});
