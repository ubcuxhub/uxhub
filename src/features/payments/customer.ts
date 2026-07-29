import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserInfoRow } from "@/types/models";
import type { CheckoutRequestInput } from "./types";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import { squareClient } from "@/lib/square/client";
import { splitBuyerName } from "./fulfillment-rules";

const adminDb = supabaseAdmin as unknown as SupabaseClient<Database>;

export async function ensureSquareCustomerId(
  user: UserInfoRow,
  buyer: Pick<
    CheckoutRequestInput,
    "buyerEmail" | "buyerName" | "buyerPhone" | "idempotencyKey"
  >
) {
  if (user.square_customer_id) return user.square_customer_id;

  const { givenName, familyName } = splitBuyerName(buyer.buyerName);
  const response = await squareClient.customers.create({
    idempotencyKey: `customer:${user.id}`,
    givenName,
    familyName,
    emailAddress: buyer.buyerEmail,
    phoneNumber: buyer.buyerPhone ?? undefined,
    referenceId: user.id,
  });
  const customerId = response.customer?.id;
  if (!customerId) throw new Error("Square did not return a customer ID.");

  await updateUserInfoById(adminDb, user.id, {
    square_customer_id: customerId,
  });
  return customerId;
}
