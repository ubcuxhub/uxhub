import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserInfoRow } from "@/lib/supabase/models";

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

const profile = {
  id: "user-1",
  email: "ada@example.com",
  first_name: "Ada Byron",
  last_name: "Lovelace",
  phone: "+16045550100",
  square_customer_id: null,
} as UserInfoRow;

describe("ensureSquareCustomerId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCustomer.mockResolvedValue({ customer: { id: "square-customer" } });
  });

  it("creates the customer from the server's profile, names unparsed", async () => {
    await expect(ensureSquareCustomerId(profile)).resolves.toBe("square-customer");

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

  it("leaves out a missing last name and phone rather than sending blanks", async () => {
    await ensureSquareCustomerId({ ...profile, last_name: "", phone: null });

    expect(createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ familyName: undefined, phoneNumber: undefined })
    );
  });

  it("reuses an existing Square customer", async () => {
    await expect(
      ensureSquareCustomerId({ ...profile, square_customer_id: "existing-customer" })
    ).resolves.toBe("existing-customer");

    expect(createCustomer).not.toHaveBeenCalled();
  });
});
