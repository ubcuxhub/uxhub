import { describe, expect, it } from "vitest";

import {
  getRemainingCooldownSeconds,
  getResendCooldownMessage,
  getResendCooldownSeconds,
} from "./resend-email-cooldown";

describe("resend email cooldown", () => {
  describe("getResendCooldownSeconds", () => {
    it.each([
      [
        "For security purposes, you can only request this after 56 seconds.",
        56,
      ],
      ["For security purposes, you can only request this after 1 second.", 1],
      ["for security purposes, you can only request this after 0 seconds", 0],
    ])("extracts the delay from %j", (message, expected) => {
      expect(getResendCooldownSeconds(new Error(message))).toBe(expected);
    });

    it.each([
      new Error("Unable to resend email."),
      new Error("Please retry after 30 seconds."),
      new Error(
        "For security purposes, you can only request this after soon.",
      ),
      "For security purposes, you can only request this after 20 seconds.",
      null,
    ])("does not treat unrelated values as a cooldown error", (error) => {
      expect(getResendCooldownSeconds(error)).toBeNull();
    });

    it("rejects a delay that exceeds JavaScript's safe integer range", () => {
      expect(
        getResendCooldownSeconds(
          new Error(
            "For security purposes, you can only request this after 9007199254740992 seconds.",
          ),
        ),
      ).toBeNull();
    });
  });

  describe("getRemainingCooldownSeconds", () => {
    it.each([
      [60_000, 0, 60],
      [60_000, 1, 60],
      [60_000, 999, 60],
      [60_000, 1_000, 59],
      [60_000, 59_001, 1],
      [60_000, 60_000, 0],
      [60_000, 70_000, 0],
    ])(
      "returns %i seconds for a deadline of %i at time %i",
      (cooldownEndsAt, now, expected) => {
        expect(getRemainingCooldownSeconds(cooldownEndsAt, now)).toBe(expected);
      },
    );
  });

  describe("getResendCooldownMessage", () => {
    it("uses singular grammar for one second", () => {
      expect(getResendCooldownMessage(1)).toBe(
        "For security purposes, you can only request this after 1 second.",
      );
    });

    it("uses plural grammar for all other values", () => {
      expect(getResendCooldownMessage(56)).toBe(
        "For security purposes, you can only request this after 56 seconds.",
      );
    });
  });
});
