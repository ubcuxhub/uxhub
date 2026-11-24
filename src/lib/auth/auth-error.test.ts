import { describe, expect, it } from "vitest";

import {
  AUTH_ERROR_MESSAGES,
  authErrorMessage,
  authErrorPath,
} from "./auth-error";

describe("auth error copy", () => {
  it("chooses copy by code", () => {
    expect(authErrorMessage("linked_elsewhere")).toBe(
      AUTH_ERROR_MESSAGES.linked_elsewhere,
    );
  });

  it.each([
    [undefined],
    [null],
    [""],
    ["Your membership was suspended. Call 604-555-0100."],
    ["toString"],
    ["__proto__"],
  ])("never renders URL text for %j", (code) => {
    expect(authErrorMessage(code)).toBe(
      "We couldn't complete authentication. Please try signing in again.",
    );
  });

  it("builds the error path with a sanitized next", () => {
    expect(authErrorPath("callback", "/portal/events")).toBe(
      "/auth/error?code=callback&next=%2Fportal%2Fevents",
    );
    expect(authErrorPath("callback", "/.//evil.com")).toBe(
      "/auth/error?code=callback&next=%2Fportal",
    );
    expect(authErrorPath("profile_unavailable")).toBe(
      "/auth/error?code=profile_unavailable",
    );
  });
});
