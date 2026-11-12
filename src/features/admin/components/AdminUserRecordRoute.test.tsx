// @vitest-environment jsdom

import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecordNotFound } from "@/components/shared/RecordDrawer";
import { AdminUserRecordRoute } from "./AdminUserRecordRoute";
import { AdminUserRecord } from "./AdminUserRecord";
import { UserTransactionList } from "./UserTransactionList";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createClient: vi.fn(),
  fetchRecord: vi.fn(),
  fetchTiers: vi.fn(),
  fetchPurchases: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase-helpers/users", () => ({ fetchAdminUserRecordById: mocks.fetchRecord }));
vi.mock("@/lib/supabase-helpers/memberships", () => ({ fetchMembershipTypeOptions: mocks.fetchTiers }));
vi.mock("@/lib/supabase-helpers/purchases", () => ({ fetchPurchasesForUser: mocks.fetchPurchases }));
vi.mock("@/lib/log", () => ({ log: { error: mocks.logError }, errorFields: () => ({ errorType: "Error" }) }));
// The record itself is covered by its own tests; here only its props matter.
vi.mock("./AdminUserRecord", () => ({ AdminUserRecord: () => null }));

const client = { name: "server client" };
const row = {
  id: "11111111-1111-4111-8111-111111111111",
  first_name: "Dora",
  last_name: "Hu",
  student_verified_by: "22222222-2222-4222-8222-222222222222",
  order_date_deprecated: "2026-01-05",
  membership_type_id: "tier-1",
  membership_types: { name: "nonUbc" },
};
const tiers = [{ id: "tier-1", name: "nonUbc" }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ id: "me", role_access: "manager" });
  mocks.createClient.mockResolvedValue(client);
  mocks.fetchRecord.mockResolvedValue({ row, verifier: { id: row.student_verified_by, first_name: "Iris", last_name: "Chan" } });
  mocks.fetchTiers.mockResolvedValue(tiers);
  mocks.fetchPurchases.mockResolvedValue([]);
});

async function route() {
  return (await AdminUserRecordRoute({ userId: row.id })) as ReactElement<Record<string, unknown>>;
}

describe("AdminUserRecordRoute", () => {
  it("checks admin access before fetching anything", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    mocks.requireAdmin.mockRejectedValue(redirect);
    await expect(route()).rejects.toBe(redirect);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetchRecord).not.toHaveBeenCalled();
    expect(mocks.fetchTiers).not.toHaveBeenCalled();
  });

  it("hands the record, its verifier and the active tiers to the record view", async () => {
    const element = await route();
    expect(element.type).toBe(AdminUserRecord);
    expect(element.key).toBe(row.id);
    expect(mocks.fetchRecord).toHaveBeenCalledWith(client, row.id);
    expect(element.props).toMatchObject({
      record: { id: row.id, membership_type_name: "nonUbc", order_date: "2026-01-05" },
      verifierName: "Iris Chan",
      membershipTypes: tiers,
      canManage: true,
      currentUserId: "me",
    });
    expect(element.props.record).not.toHaveProperty("membership_types");
  });

  it("lets an admin look but not edit", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "me", role_access: "admin" });
    expect((await route()).props.canManage).toBe(false);
  });

  it("passes no verifier name when the verifier's profile is gone", async () => {
    mocks.fetchRecord.mockResolvedValue({ row, verifier: null });
    expect((await route()).props.verifierName).toBeNull();
  });

  it("shows Not found in the drawer for a missing user", async () => {
    mocks.fetchRecord.mockResolvedValue(null);
    const element = await route();
    expect(element.type).toBe(RecordNotFound);
    expect(element.props.noun).toBe("user");
  });

  describe("recent transactions", () => {
    async function transactions() {
      const suspense = (await route()).props.transactions as ReactElement<{ children: ReactElement<{ userId: string }> }>;
      const child = suspense.props.children;
      const render = child.type as (props: { userId: string }) => Promise<ReactElement<Record<string, unknown>>>;
      return render(child.props);
    }

    it("loads the five latest purchases as display data only", async () => {
      mocks.fetchPurchases.mockResolvedValue([
        {
          id: "p1", kind: "membership", membership_types: { name: "nonUbc" }, events: null,
          amount_cents: 1500, currency: "CAD", status: "completed", created_at: "2026-10-01T12:00:00Z",
          square_payment_id: "private-payment-id", failure_reason: "private-error",
        },
      ]);
      const element = await transactions();
      expect(mocks.fetchPurchases).toHaveBeenCalledWith(client, row.id, 5);
      expect(element.type).toBe(UserTransactionList);
      expect(element.props.purchases).toEqual([
        { id: "p1", title: "Non UBC", kind: "membership", amount_cents: 1500, currency: "CAD", status: "completed", created_at: "2026-10-01T12:00:00Z" },
      ]);
    });

    it("logs a failure without row data and says so in place", async () => {
      mocks.fetchPurchases.mockRejectedValue(new Error("row data"));
      const element = await transactions();
      expect(element.props.role).toBe("alert");
      expect(mocks.logError).toHaveBeenCalledWith("admin.user_purchases_load_failed", { userId: row.id, errorType: "Error" });
    });
  });
});
