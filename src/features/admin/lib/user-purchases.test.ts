import { describe, expect, it } from "vitest";

import type { PurchaseWithDetails } from "@/lib/supabase-helpers/purchases";
import { describeUserPurchase, toUserPurchaseSummary } from "./user-purchases";

function purchase(overrides: Partial<PurchaseWithDetails>): PurchaseWithDetails {
  return {
    id: "p1", kind: "membership", amount_cents: 1500, currency: "CAD", status: "completed",
    created_at: "2026-10-01", events: null, membership_types: null,
    ...overrides,
  } as PurchaseWithDetails;
}

describe("toUserPurchaseSummary", () => {
  it("keeps only display data", () => {
    const summary = toUserPurchaseSummary({
      ...purchase({ membership_types: { id: "t", name: "nonUbc", slug: "non-ubc" } }),
      square_payment_id: "private-payment-id",
      failure_reason: "private-error",
    } as PurchaseWithDetails);
    expect(summary).toEqual({ id: "p1", title: "Non UBC", kind: "membership", amount_cents: 1500, currency: "CAD", status: "completed", created_at: "2026-10-01" });
  });

  it.each([
    [purchase({}), "Membership purchase"],
    [purchase({ kind: "event_ticket", events: { id: "e", name: "Portfolio Night", slug: "p", starts_at: null } as PurchaseWithDetails["events"] }), "Portfolio Night"],
    [purchase({ kind: "event_ticket" }), "Event ticket"],
  ])("titles a purchase without its tier or event (%#)", (input, title) => {
    expect(toUserPurchaseSummary(input).title).toBe(title);
  });
});

describe("describeUserPurchase", () => {
  it("names the kind, and the status when it isn't completed", () => {
    expect(describeUserPurchase({ kind: "membership", status: "completed" })).toBe("Annual membership");
    expect(describeUserPurchase({ kind: "event_ticket", status: "failed" })).toBe("Event ticket · Failed");
  });
});
