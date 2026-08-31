import { describe, expect, it } from "vitest";
import { SquareError } from "square";
import {
  formatReservationFailure,
  getSquareErrorMessage,
  normalizeSquareStatus,
  splitBuyerName,
} from "./fulfillment-rules";

describe("payment fulfillment rules", () => {
  it.each([
    ["APPROVED", "authorized"],
    ["COMPLETED", "completed"],
    ["CANCELED", "canceled"],
    ["FAILED", "failed"],
    ["PENDING", "pending"],
    [undefined, "pending"],
  ])("normalizes Square status %s", (status, expected) => {
    expect(normalizeSquareStatus(status)).toBe(expected);
  });

  it.each([
    ["Ada Lovelace", { givenName: "Ada", familyName: "Lovelace" }],
    ["  Ada   Byron Lovelace ", { givenName: "Ada", familyName: "Byron Lovelace" }],
    ["Ada", { givenName: "Ada", familyName: undefined }],
    [" ", { givenName: undefined, familyName: undefined }],
  ])("splits buyer name %j", (name, expected) => {
    expect(splitBuyerName(name)).toEqual(expected);
  });

  it("prefers a Square error detail", () => {
    const error = new SquareError({
      message: "Request failed",
      body: {
        errors: [
          {
            category: "PAYMENT_METHOD_ERROR",
            code: "CARD_DECLINED",
            detail: "Card declined",
          },
        ],
      },
    });

    expect(getSquareErrorMessage(error)).toBe("Card declined");
  });

  it("uses ordinary error messages and falls back for unknown values", () => {
    expect(getSquareErrorMessage(new Error("Network unavailable"))).toBe(
      "Network unavailable"
    );
    expect(getSquareErrorMessage(null, "Try again.")).toBe("Try again.");
  });

  it.each([
    ["APPLICATION_REQUIRED", "This event uses an application flow and cannot be purchased directly."],
    ["REGISTRATION_NOT_OPEN", "Registration for this event is not open yet."],
    ["REGISTRATION_CLOSED", "Registration for this event has closed."],
    ["ALREADY_REGISTERED", "You already have a registration for this event."],
    ["SOLD_OUT", "This event is sold out."],
    ["EVENT_NOT_FOUND", "This event could not be found."],
    ["EVENT_NOT_ACTIVE", "This event is no longer open for registration."],
    [null, "We could not reserve a ticket for this event."],
  ])("formats reservation failure %s", (reason, expected) => {
    expect(formatReservationFailure(reason)).toBe(expected);
  });
});
