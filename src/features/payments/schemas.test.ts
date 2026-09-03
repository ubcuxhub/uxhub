import { describe, expect, it } from "vitest";
import { parseCheckoutRequest } from "./schemas";

const validPayload = {
  kind: "membership",
  slug: "student",
  token: "payment-token",
  idempotencyKey: "checkout-key",
  buyerName: "Ada Lovelace",
  buyerEmail: "ada@example.com",
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
    ["token", { token: null }, "Payment token is required."],
    [
      "idempotency key",
      { idempotencyKey: "" },
      "Checkout idempotency key is required.",
    ],
    ["buyer name", { buyerName: 12 }, "Name is required."],
    ["buyer email", { buyerEmail: "" }, "Email is required."],
    [
      "email shape",
      { buyerEmail: "not-an-email" },
      "Enter a valid email address.",
    ],
  ])("rejects an invalid %s", (_field, change, message) => {
    expect(() =>
      parseCheckoutRequest({ ...validPayload, ...change })
    ).toThrow(message);
  });

  it("trims required fields and normalizes optional strings", () => {
    expect(
      parseCheckoutRequest({
        ...validPayload,
        slug: " student ",
        buyerPhone: " 604-555-0100 ",
        billingPostalCode: " ",
      })
    ).toEqual({
      ...validPayload,
      slug: "student",
      buyerPhone: "604-555-0100",
      billingPostalCode: null,
      applicationId: null,
    });
  });
});
