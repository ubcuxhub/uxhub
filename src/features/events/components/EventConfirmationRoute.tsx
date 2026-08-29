import { notFound, redirect } from "next/navigation";

import { EventConfirmation } from "./EventConfirmation";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchPurchaseForUser } from "@/lib/supabase-helpers/purchases";
import { withReturnTo } from "@/lib/auth/paths";

export async function EventConfirmationRoute({
  purchaseId,
  returnTo,
  slug,
}: {
  purchaseId: string;
  returnTo?: string;
  slug: string;
}) {
  const user = await requireAuth(
    withReturnTo(
      `/portal/events/${slug}/confirmation/${purchaseId}`,
      returnTo,
    ),
  );
  const supabase = await createClient();
  const purchase = await fetchPurchaseForUser(supabase, user.id, purchaseId);

  if (!purchase || purchase.kind !== "event_ticket") notFound();

  if (purchase.events?.slug && purchase.events.slug !== slug) {
    redirect(`/portal/events/${purchase.events.slug}/confirmation/${purchase.id}`);
  }

  return <EventConfirmation purchase={purchase} slug={slug} />;
}
