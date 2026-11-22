import "server-only";

import type { DbClient } from "./types";

/** Service-only RPC; grant, fulfillment marker and award commit together. */
export async function fulfillMembershipGrant(db: DbClient, purchaseId: string, expiresAt: string) {
  const { data, error } = await db.rpc("fulfill_membership_purchase", {
    p_purchase_id: purchaseId, p_expires_at: expiresAt,
  });
  if (error) throw error;
  return data;
}
