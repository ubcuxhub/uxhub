import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";
import { fetchPurchaseById } from "@/lib/supabase-helpers/purchases";

export async function revalidatePurchasePaths(
  adminDb: SupabaseClient<Database>,
  purchaseId: string
) {
  const purchase = await fetchPurchaseById(adminDb, purchaseId);
  if (!purchase) return;

  if (purchase.kind === "membership" && purchase.membership_type_id) {
    const membershipType = await fetchMembershipTypeById(
      adminDb,
      purchase.membership_type_id
    );
    revalidatePath("/portal/membership");
    if (membershipType?.slug) {
      revalidatePath(`/portal/membership/${membershipType.slug}/checkout`);
    }
  }

  if (purchase.kind === "event_ticket" && purchase.event_id) {
    const event = await fetchEventById(adminDb, purchase.event_id);
    revalidatePath("/portal");
    if (event?.slug) {
      revalidatePath(`/events/${event.slug}`);
      revalidatePath(`/portal/events/${event.slug}/checkout`);
    }
  }
}
