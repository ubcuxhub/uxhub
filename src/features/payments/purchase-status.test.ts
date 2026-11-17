import { describe, expect, it } from "vitest";

import { isFullyRefunded, purchaseRefundLabel, purchaseStatusLabel } from "./purchase-status";

describe("purchase refund state", () => {
  it.each([
    [{ amount_cents: 2000, refunded_cents: 0 }, false, null],
    [{ amount_cents: 2000, refunded_cents: 500 }, false, "Partially refunded"],
    [{ amount_cents: 2000, refunded_cents: 2000 }, true, "Refunded"],
    [{ amount_cents: 0, refunded_cents: 0 }, false, null],
  ])("reads %o", (amounts, full, label) => {
    expect(isFullyRefunded(amounts)).toBe(full);
    expect(purchaseRefundLabel(amounts)).toBe(label);
  });

  it("labels a refund over the status, which still mirrors Square", () => {
    expect(purchaseStatusLabel({ status: "completed", amount_cents: 2000, refunded_cents: 2000 })).toBe("Refunded");
    expect(purchaseStatusLabel({ status: "completed", amount_cents: 2000, refunded_cents: 0 })).toBe("Completed");
    expect(purchaseStatusLabel({ status: "failed", amount_cents: 2000, refunded_cents: 0 })).toBe("Failed");
  });
});
