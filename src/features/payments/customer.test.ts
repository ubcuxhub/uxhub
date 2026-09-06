import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserInfoRow } from "@/types/models";

vi.mock("server-only", () => ({}));

const createCustomer = vi.fn();
vi.mock("@/lib/square/client", () => ({
  squareClient: {
    customers: {
      create: (...args: unknown[]) => createCustomer(...args),
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));

const updateUserInfoById = vi.fn();
vi.mock("@/lib/supabase-helpers/users", () => ({
  updateUserInfoById: (...args: unknown[]) => updateUserInfoById(...args),
}));

const { ensureSquareCustomerId } = await import("./customer");

describe("ensureSquareCustomerId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCustomer.mockResolvedValue({ customer: { id: "square-customer" } });
  });

  it("passes first and last names to Square without parsing", async () => {
    const user = {
      id: "user-1",
      square_customer_id: null,
    } as UserInfoRow;

    await expect(
      ensureSquareCustomerId(user, {
        buyerEmail: "ada@example.com",
        buyerFirstName: "Ada Byron",
        buyerLastName: "Lovelace",
        buyerPhone: "+16045550100",
        idempotencyKey: "checkout-key",
      })
    ).resolves.toBe("square-customer");

    expect(createCustomer).toHaveBeenCalledWith({
      emailAddress: "ada@example.com",
      familyName: "Lovelace",
      givenName: "Ada Byron",
      idempotencyKey: "customer:user-1",
      phoneNumber: "+16045550100",
      referenceId: "user-1",
    });
    expect(updateUserInfoById).toHaveBeenCalledWith({}, "user-1", {
      square_customer_id: "square-customer",
    });
  });

  it("reuses an existing Square customer", async () => {
    const user = {
      id: "user-1",
      square_customer_id: "existing-customer",
    } as UserInfoRow;

    await expect(
      ensureSquareCustomerId(user, {
        buyerEmail: "ada@example.com",
        buyerFirstName: "Ada",
        buyerLastName: "Lovelace",
        idempotencyKey: "checkout-key",
      })
    ).resolves.toBe("existing-customer");

    expect(createCustomer).not.toHaveBeenCalled();
  });
});
