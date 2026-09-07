import { describe, expect, it } from "vitest";
import { SquareError } from "square";
import {
  formatReservationFailure,
  getSquareErrorDiagnostic,
  getSquareErrorMessage,
  normalizeSquareStatus,
} from "./fulfillment-rules";

function squareError(
  errors: { category: string; code: string; detail?: string }[],
  body?: unknown
) {
  return new SquareError({
    message: "Request failed",
    body: body ?? { errors },
  });
}

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
    [
      "CVV_FAILURE",
      "The security code (CVC) on your card was rejected. Check the code and try again, or use a different card.",
    ],
    ["CARD_EXPIRED", "This card has expired. Please use a different card."],
    [
      "INSUFFICIENT_FUNDS",
      "Your card was declined for insufficient funds. Please use a different card.",
    ],
    [
      "GENERIC_DECLINE",
      "Your bank declined this payment. Check your card details and try again, or use a different card.",
    ],
    [
      "CARD_TOKEN_EXPIRED",
      "This checkout session expired before the payment finished. Refresh the page and try again.",
    ],
  ])("explains the Square decline code %s", (code, expected) => {
    const error = squareError([
      { category: "PAYMENT_METHOD_ERROR", code, detail: `Authorization error: '${code}'` },
    ]);

    expect(getSquareErrorMessage(error)).toBe(expected);
  });

  it("reports a rejected security code when the postal code passed", () => {
    const error = squareError([], {
      errors: [
        {
          category: "PAYMENT_METHOD_ERROR",
          code: "GENERIC_DECLINE",
          detail: "Authorization error: 'GENERIC_DECLINE'",
        },
      ],
      payment: {
        card_details: { avs_status: "AVS_ACCEPTED", cvv_status: "CVV_REJECTED" },
      },
    });

    expect(getSquareErrorMessage(error)).toBe(
      "The security code (CVC) on your card was rejected. Check the code and try again, or use a different card."
    );
  });

  it("reports a rejected postal code when the security code passed", () => {
    const error = squareError([], {
      errors: [
        {
          category: "PAYMENT_METHOD_ERROR",
          code: "GENERIC_DECLINE",
          detail: "Authorization error: 'GENERIC_DECLINE'",
        },
      ],
      payment: {
        card_details: { avs_status: "AVS_REJECTED", cvv_status: "CVV_ACCEPTED" },
      },
    });

    expect(getSquareErrorMessage(error)).toBe(
      "The postal code did not match the one on file for your card. Check it and try again."
    );
  });

  it.each([
    ["AVS_REJECTED", "CVV_REJECTED"],
    ["AVS_NOT_CHECKED", "CVV_REJECTED"],
    ["AVS_REJECTED", "CVV_NOT_CHECKED"],
    [undefined, "CVV_REJECTED"],
  ])(
    "stays generic when avs=%s and cvv=%s isolate no single field",
    (avsStatus, cvvStatus) => {
      const error = squareError([], {
        errors: [
          {
            category: "PAYMENT_METHOD_ERROR",
            code: "GENERIC_DECLINE",
            detail: "Authorization error: 'GENERIC_DECLINE'",
          },
        ],
        payment: {
          card_details: { avs_status: avsStatus, cvv_status: cvvStatus },
        },
      });

      expect(getSquareErrorMessage(error)).toBe(
        "Your bank declined this payment. Check your card details and try again, or use a different card."
      );
    }
  );

  it("falls back to the Square detail for an unmapped code", () => {
    const error = squareError([
      {
        category: "API_ERROR",
        code: "SOMETHING_NEW",
        detail: "Square said something unfamiliar",
      },
    ]);

    expect(getSquareErrorMessage(error)).toBe("Square said something unfamiliar");
  });

  it("keeps the raw Square codes for the server log", () => {
    const error = squareError([], {
      errors: [
        {
          category: "PAYMENT_METHOD_ERROR",
          code: "GENERIC_DECLINE",
          detail: "Authorization error: 'GENERIC_DECLINE'",
        },
      ],
      payment: {
        card_details: { avs_status: "AVS_ACCEPTED", cvv_status: "CVV_REJECTED" },
      },
    });

    expect(getSquareErrorDiagnostic(error)).toBe(
      "GENERIC_DECLINE (PAYMENT_METHOD_ERROR): Authorization error: 'GENERIC_DECLINE' | cvv=CVV_REJECTED avs=AVS_ACCEPTED"
    );
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
