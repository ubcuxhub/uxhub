"use server";

import { loadCurrentUser } from "@/lib/auth/current-user";
import { hasAdminAccess } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { fetchItemCheckInSnapshot, mutateItemCheckIn } from "@/lib/supabase-helpers/item-check-in";
import { isUuid } from "@/lib/uuid";

export async function fetchItemCheckInAction(eventId: string, itemId: string | null) {
  if (!await canCheckIn())
    return { status: "forbidden" as const };
  if (!isUuid(eventId) || (itemId !== null && !isUuid(itemId)))
    throw new Error("Check-in item unavailable.");
  return fetchItemCheckInSnapshot(await createClient(), eventId, itemId);
}
export async function mutateItemCheckInAction(input: { eventId: string; itemId: string; ticketId?: string; code?: string; undoVersion?: string }) {
  if (!await canCheckIn())
    return { status: "forbidden" as const };
  if (!isUuid(input.eventId) || !isUuid(input.itemId) || (input.ticketId !== undefined && !isUuid(input.ticketId)) || (input.undoVersion !== undefined && !isUuid(input.undoVersion)))
    throw new Error("Check-in request unavailable.");
  return mutateItemCheckIn(await createClient(), input);
}

/** Pages redirect through requireAdmin; mounted tools retain context on access loss. */
async function canCheckIn() {
  const current = await loadCurrentUser();
  return current.status === "authenticated" && hasAdminAccess(current.user.role_access);
}
