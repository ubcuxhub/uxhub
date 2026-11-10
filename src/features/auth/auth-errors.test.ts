import { describe, expect, it } from "vitest";

import { isUserAlreadyExistsError } from "./auth-errors";

describe("isUserAlreadyExistsError", () => {
  it("matches the GoTrue codes", () => {
    expect(
      isUserAlreadyExistsError(
        Object.assign(new Error("x"), { code: "user_already_exists" }),
      ),
    ).toBe(true);
    expect(
      isUserAlreadyExistsError(
        Object.assign(new Error("x"), { code: "email_exists" }),
      ),
    ).toBe(true);
  });

  it("matches the message when there is no code", () => {
    expect(isUserAlreadyExistsError(new Error("User already registered"))).toBe(
      true,
    );
    expect(isUserAlreadyExistsError(new Error("Email already exists"))).toBe(
      true,
    );
  });

  it("ignores other errors", () => {
    expect(isUserAlreadyExistsError(new Error("weak"))).toBe(false);
    expect(isUserAlreadyExistsError(null)).toBe(false);
    expect(isUserAlreadyExistsError("already registered")).toBe(false);
  });
});
