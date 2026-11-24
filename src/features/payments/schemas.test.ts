import { describe, expect, it } from "vitest";
import { CheckoutRequestError, parseCheckoutRequest } from "./schemas";

const validPayload = {
  kind: "membership",
  slug: "student",
  token: "payment-token",
  idempotencyKey: "checkout-key",
  expectedAmountCents: 2000,
};

describe("parseCheckoutRequest", () => {
  it.each([null, undefined, "payload", 42])(
    "rejects a non-object payload: %s",
    (input) => {
      expect(() => parseCheckoutRequest(input)).toThrow(
        "Invalid checkout payload."
      );
    }
  );

  it.each([
    ["kind", { kind: "donation" }, "Invalid purchase kind."],
    ["slug", { slug: " " }, "Product slug is required."],
    [
      "idempotency key",
      { idempotencyKey: "" },
      "Checkout idempotency key is required.",
    ],
  ])("rejects an invalid %s", (_field, change, message) => {
    expect(() =>
      parseCheckoutRequest({ ...validPayload, ...change })
    ).toThrow(new CheckoutRequestError(message));
  });

  it("trims required fields and drops the buyer details older clients send", () => {
    expect(
      parseCheckoutRequest({
        ...validPayload,
        slug: " student ",
        buyerFirstName: "Mallory",
        buyerEmail: "someone-else@example.com",
        buyerPhone: " 604-555-0100 ",
        billingPostalCode: " ",
      })
    ).toEqual({
      ...validPayload,
      slug: "student",
      verificationToken: null,
    });
  });

  it("keeps the buyer verification token when one is present", () => {
    expect(
      parseCheckoutRequest({
        ...validPayload,
        verificationToken: " verification-token ",
      }).verificationToken
    ).toBe("verification-token");
  });

  it("treats a missing buyer verification token as absent", () => {
    expect(parseCheckoutRequest(validPayload).verificationToken).toBeNull();
  });
});

it("accepts a cardless request, leaving checkout to decide whether the price needs a card", () => {
  expect(parseCheckoutRequest({ ...validPayload, kind: "event_ticket", token: null, expectedAmountCents: 0 })).toMatchObject({ token: null, expectedAmountCents: 0 });
  expect(parseCheckoutRequest({ ...validPayload, token: null })).toMatchObject({ token: null });
  for (const expectedAmountCents of [-1, 0.1, "0", NaN, Infinity]) {
    expect(() => parseCheckoutRequest({ ...validPayload, expectedAmountCents })).toThrow("Invalid expected amount");
  }
});
