import type { TablesInsert } from "../../src/lib/supabase/database.types.ts";

export const PAYMENT_SMOKE_TIER = {
  active: true,
  description:
    "Live production payment verification tier. Purchase only when coordinating a UX Hub payment test.",
  eligible_user_types: ["ubcStudent", "faculty", "nonUbc"],
  features: ["Live Square checkout and settlement verification"],
  name: "Payment Smoke Test",
  price: 1.23,
  slug: "payment-smoke-test",
} as const satisfies TablesInsert<"membership_types">;
