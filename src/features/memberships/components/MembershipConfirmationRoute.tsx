import { notFound } from "next/navigation";

import { MembershipConfirmation } from "./MembershipConfirmation";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchPurchaseForUser } from "@/lib/supabase-helpers/purchases";
import { withReturnTo } from "@/lib/auth/paths";

export async function MembershipConfirmationRoute({
  purchaseId,
  returnTo,
}: {
  purchaseId: string;
  returnTo?: string;
}) {
  const user = await requireAuth(
    withReturnTo(
      `/portal/membership/confirmation/${purchaseId}`,
      returnTo,
    ),
  );
  const supabase = await createClient();
  const purchase = await fetchPurchaseForUser(supabase, user.id, purchaseId);

  if (!purchase || purchase.kind !== "membership") notFound();
  return <MembershipConfirmation purchase={purchase} />;
}
