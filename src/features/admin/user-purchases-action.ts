"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { errorFields, log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { fetchPurchasesForUser } from "@/lib/supabase-helpers/purchases";
import type { UserPurchaseSummary } from "./types";

export async function fetchAdminUserPurchasesAction(
  userId: string
): Promise<UserPurchaseSummary[]> {
  await requireAdmin();
  if (!userId) throw new Error("A user id is required.");

  try {
    const supabase = await createClient();
    const purchases = await fetchPurchasesForUser(supabase, userId, 5);
    return purchases.map((purchase) => ({
      id: purchase.id,
      title:
        purchase.kind === "membership"
          ? purchase.membership_types?.name || "Membership purchase"
          : purchase.events?.name || "Event ticket",
      kind: purchase.kind,
      amount_cents: purchase.amount_cents,
      currency: purchase.currency,
      status: purchase.status,
      created_at: purchase.created_at,
    }));
  } catch (error) {
    log.error("admin.user_purchases_load_failed", {
      userId,
      ...errorFields(error),
    });
    throw new Error("Unable to load recent purchases. Please try again.");
  }
}
