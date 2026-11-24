import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserInfoRow } from "@/lib/supabase/models";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updateUserInfoById } from "@/lib/supabase-helpers/users";
import { squareClient } from "@/lib/square/client";

const adminDb = supabaseAdmin as unknown as SupabaseClient<Database>;

/**
 * The buyer's Square customer, created on their first purchase from the
 * profile the server holds. Nothing the client sends reaches Square's
 * customer record.
 */
export async function ensureSquareCustomerId(
  user: Pick<
    UserInfoRow,
    "id" | "email" | "first_name" | "last_name" | "phone" | "square_customer_id"
  >
) {
  if (user.square_customer_id) return user.square_customer_id;

  const response = await squareClient.customers.create({
    idempotencyKey: `customer:${user.id}`,
    givenName: user.first_name || undefined,
    familyName: user.last_name || undefined,
    emailAddress: user.email,
    phoneNumber: user.phone || undefined,
    referenceId: user.id,
  });
  const customerId = response.customer?.id;
  if (!customerId) throw new Error("Square did not return a customer ID.");

  await updateUserInfoById(adminDb, user.id, {
    square_customer_id: customerId,
  });
  return customerId;
}
