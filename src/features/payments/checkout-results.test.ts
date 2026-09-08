import { describe, expect, it } from "vitest";

import { getExistingCheckoutResult } from "./checkout-results";

describe("existing checkout results", () => {
  it.each(["pending", "authorized"])(
    "routes a replayed %s attempt to reconciliation",
    (status) => {
      expect(
        getExistingCheckoutResult(
          {
            failure_reason: null,
            id: "purchase-1",
            status,
            user_id: "user-1",
          },
          "user-1",
        ),
      ).toEqual({
        ok: true,
        purchaseId: "purchase-1",
        redirectTo: "/portal#settings/purchases",
        resolution: "processing",
      });
    },
  );

  it("allows a new key only after a known terminal failure", () => {
    expect(
      getExistingCheckoutResult(
        {
          failure_reason: "The card was declined.",
          id: "purchase-1",
          status: "failed",
          user_id: "user-1",
        },
        "user-1",
      ),
    ).toEqual({
      ok: false,
      error: "The card was declined.",
      terminal: true,
    });
  });
});
