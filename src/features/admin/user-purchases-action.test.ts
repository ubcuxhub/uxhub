import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAdminUserPurchasesAction } from "./user-purchases-action";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createClient: vi.fn(),
  fetchPurchasesForUser: vi.fn(),
  logError: vi.fn(),
  errorFields: vi.fn(() => ({ errorType: "Error" })),
}));

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase-helpers/purchases", () => ({ fetchPurchasesForUser: mocks.fetchPurchasesForUser }));
vi.mock("@/lib/log", () => ({ log: { error: mocks.logError }, errorFields: mocks.errorFields }));

describe("fetchAdminUserPurchasesAction", () => {
  const client = {};
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ role_access: "admin" });
    mocks.createClient.mockResolvedValue(client);
    mocks.fetchPurchasesForUser.mockResolvedValue([]);
  });

  it("preserves authorization redirects and never queries purchases for unauthorized callers", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    mocks.requireAdmin.mockRejectedValue(redirect);
    await expect(fetchAdminUserPurchasesAction("user-1")).rejects.toBe(redirect);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetchPurchasesForUser).not.toHaveBeenCalled();
  });

  it("requires a user id before querying", async () => {
    await expect(fetchAdminUserPurchasesAction("")).rejects.toThrow("A user id is required.");
    expect(mocks.fetchPurchasesForUser).not.toHaveBeenCalled();
  });

  it.each(["admin", "manager"])("loads five purchases for an authorized %s and returns only display data", async (role_access) => {
    mocks.requireAdmin.mockResolvedValue({ role_access });
    mocks.fetchPurchasesForUser.mockResolvedValue([
      {
        id: "purchase-1", kind: "membership", membership_types: { name: "Innovator" },
        amount_cents: 1500, currency: "CAD", status: "completed", created_at: "2026-10-01",
        square_payment_id: "private-payment-id", square_customer_id: "private-customer-id", failure_reason: "private-error",
      },
      {
        id: "purchase-2", kind: "event_ticket", events: null,
        amount_cents: 500, currency: "CAD", status: "failed", created_at: null,
      },
    ]);
    await expect(fetchAdminUserPurchasesAction("user-1")).resolves.toEqual([
      { id: "purchase-1", title: "Innovator", kind: "membership", amount_cents: 1500, currency: "CAD", status: "completed", created_at: "2026-10-01" },
      { id: "purchase-2", title: "Event ticket", kind: "event_ticket", amount_cents: 500, currency: "CAD", status: "failed", created_at: null },
    ]);
    expect(mocks.fetchPurchasesForUser).toHaveBeenCalledWith(client, "user-1", 5);
  });

  it("returns a safe error and logs without database row details", async () => {
    const error = new Error("private account information");
    mocks.fetchPurchasesForUser.mockRejectedValue(error);
    await expect(fetchAdminUserPurchasesAction("user-1")).rejects.toThrow("Unable to load recent purchases. Please try again.");
    expect(mocks.errorFields).toHaveBeenCalledWith(error);
    expect(mocks.logError).toHaveBeenCalledWith("admin.user_purchases_load_failed", { userId: "user-1", errorType: "Error" });
  });
});
