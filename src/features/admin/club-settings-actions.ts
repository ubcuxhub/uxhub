"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth/guards";
import {
  adminUpdateMembershipTermEndsAt,
  adminUpdateMembershipTypeById,
} from "@/lib/supabase-helpers/admin-server";
import { datetimeLocalToTimestamptz } from "@/lib/date";
import {
  validateMembershipTypeInput,
  type MembershipTypeInput,
} from "@/features/admin/lib/membership-type";

/**
 * Sets or clears the club-wide membership term end date.
 *
 * `date` is a bare `YYYY-MM-DD` from a date input, or null to clear the
 * ceiling. It is stored as the last second of that day in Pacific time — the
 * date a manager picks means "through the end of that day" to a member in
 * Vancouver, and storing UTC midnight would cut them off the previous
 * afternoon.
 *
 * The whole app reads this, so the revalidation is layout-wide.
 */
export async function setMembershipTermEndsAtAction(date: string | null) {
  const manager = await requireManager();

  let value: string | null = null;

  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Enter a valid date.");
    }

    value = datetimeLocalToTimestamptz(`${date}T23:59:59`);
    if (!value) throw new Error("Enter a valid date.");
  }

  await adminUpdateMembershipTermEndsAt(value, manager.id);
  revalidatePath("/", "layout");

  return value;
}

/**
 * Edits one membership tier from Club Settings.
 *
 * The update is built here from three named columns rather than from the
 * caller's payload, in the spirit of `managerUserUpdate`'s allowlist: `slug`
 * is absent because checkout URLs are `/portal/membership/<slug>/checkout` and
 * a rename breaks live links; `name` because it is already printed on sent
 * receipts; `eligible_user_types` because emptying it would silently make a
 * tier unpurchasable for everyone. An invalid tier or a missing one comes back
 * as a refusal.
 */
export async function updateMembershipTypeAction(
  id: string,
  input: MembershipTypeInput
): Promise<{ ok: true; tier: { active: boolean; description: string; price: number } } | { ok: false; error: string }> {
  await requireManager();

  if (!id) return { ok: false, error: "Membership tier not found." };

  const description = input.description.trim();
  const problem = validateMembershipTypeInput({ ...input, description });
  if (problem) return { ok: false, error: problem };

  const updated = await adminUpdateMembershipTypeById(id, {
    active: input.active,
    description,
    price: input.price,
  });

  // Tier copy and price render on the portal home card, the membership plans
  // dialog, and the checkout summary, which sit under different layouts.
  revalidatePath("/", "layout");

  const row = updated?.[0] as
    | { active: boolean; description: string; price: number }
    | undefined;

  if (!row) return { ok: false, error: "Membership tier not found." };

  return {
    ok: true,
    tier: {
      active: row.active,
      description: row.description,
      price: Number(row.price),
    },
  };
}
