import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";
import {
  claimPurchaseConfirmationEmail,
  fetchPurchaseById,
  updatePurchase,
} from "@/lib/supabase-helpers/purchases";
import { fetchUserInfoContactById } from "@/lib/supabase-helpers/users";
import { sendEmail } from "@/lib/email/client";
import {
  renderEventConfirmationEmail,
  renderMembershipConfirmationEmail,
} from "@/lib/email/templates";

/**
 * Best-effort purchase confirmation email. Called from fulfillment, which runs
 * from both the synchronous checkout and the Square webhook. An atomic attempt
 * claim keeps it to one send per purchase. Never throws: the payment has
 * already succeeded by this point.
 */
export async function sendPurchaseConfirmationEmail(
  adminDb: SupabaseClient<Database>,
  purchaseId: string
) {
  try {
    const purchase = await fetchPurchaseById(adminDb, purchaseId);

    if (
      !purchase ||
      purchase.status !== "completed" ||
      purchase.confirmation_email_sent_at ||
      purchase.confirmation_email_attempted_at
    ) {
      return;
    }

    const recipient = await fetchUserInfoContactById(adminDb, purchase.user_id);

    if (!recipient?.email) {
      return;
    }

    let rendered: { html: string; subject: string } | null = null;

    if (purchase.kind === "membership" && purchase.membership_type_id) {
      const membershipType = await fetchMembershipTypeById(
        adminDb,
        purchase.membership_type_id
      );

      if (membershipType) {
        rendered = renderMembershipConfirmationEmail({
          membershipType,
          purchase,
          userName: recipient.name,
        });
      }
    } else if (purchase.kind === "event_ticket" && purchase.event_id) {
      const event = await fetchEventById(adminDb, purchase.event_id);

      if (event) {
        rendered = renderEventConfirmationEmail({
          event,
          purchase,
          userName: recipient.name,
        });
      }
    }

    if (!rendered) {
      return;
    }

    const claimedPurchase = await claimPurchaseConfirmationEmail(
      adminDb,
      purchase.id
    );

    if (!claimedPurchase) {
      return;
    }

    const emailSent = await sendEmail({
      html: rendered.html,
      subject: rendered.subject,
      to: recipient.email,
    });

    if (!emailSent) {
      return;
    }

    await updatePurchase(adminDb, claimedPurchase.id, {
      confirmation_email_sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("sendPurchaseConfirmationEmail failed:", error);
  }
}
