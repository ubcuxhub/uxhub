import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { EmailSendError, sendEmail } from "@/lib/email/client";
import {
  purchaseHistoryUrl,
  renderRefundIssuedEmail,
} from "@/lib/email/refund-templates";
import { errorFields, log } from "@/lib/log";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchEventTicketByPurchaseId } from "@/lib/supabase-helpers/event-tickets";
import { fetchMembershipTypeById } from "@/lib/supabase-helpers/memberships";
import {
  claimPurchaseRefundEmail,
  fetchPurchaseById,
  markPurchaseRefundEmailSent,
  releasePurchaseRefundEmailClaim,
} from "@/lib/supabase-helpers/purchases";
import { fetchUserInfoContactById } from "@/lib/supabase-helpers/users";
import { formatUserName } from "@/lib/user-name";
import type { EmailableRefund } from "./fulfillment-rules";

/**
 * Best-effort "your refund is on its way" email, one per completed Square
 * refund (a purchase can take several partial ones). The refund sync calls it
 * on every pass that sees the refund completed, so a send that failed is
 * retried by a later webhook delivery; an atomic claim on the refund's row
 * keeps repeated and concurrent passes to one send. Never throws: the refund
 * has already been recorded by this point.
 *
 * `origin` is the site the buyer's purchase history link points at; null
 * leaves the link out rather than skipping the email.
 */
export async function sendRefundIssuedEmail(
  adminDb: SupabaseClient<Database>,
  purchaseId: string,
  refund: EmailableRefund,
  origin: string | null
): Promise<void> {
  try {
    const claimed = await claimPurchaseRefundEmail(adminDb, {
      squareRefundId: refund.id,
      purchaseId,
      amountCents: refund.amountCents,
      currency: refund.currency,
    });
    if (!claimed) return;

    let sent = false;
    try {
      const rendered = await renderForPurchase(adminDb, purchaseId, refund, origin);
      if (!rendered) return;
      sent = await sendEmail(rendered);
    } finally {
      if (!sent) {
        await releasePurchaseRefundEmailClaim(adminDb, refund.id).catch((error) => {
          log.warn("payment.refund_email_claim_release_failed", {
            purchaseId,
            ...errorFields(error),
          });
        });
      }
    }

    // False: no RESEND_API_KEY (local), which `sendEmail` already logs.
    if (!sent) return;
    await markPurchaseRefundEmailSent(adminDb, refund.id);
    log.info("payment.refund_email_sent", { purchaseId });
  } catch (error) {
    log.warn("payment.refund_email_failed", {
      purchaseId,
      ...(error instanceof EmailSendError ? { code: error.code } : {}),
      ...errorFields(error),
    });
  }
}

async function renderForPurchase(
  adminDb: SupabaseClient<Database>,
  purchaseId: string,
  refund: EmailableRefund,
  origin: string | null
) {
  const purchase = await fetchPurchaseById(adminDb, purchaseId);
  if (!purchase) return null;

  const recipient = await fetchUserInfoContactById(adminDb, purchase.user_id);
  if (!recipient?.email) return null;

  let kind: "event_ticket" | "membership" | null = null;
  let itemName: string | null = null;
  let ticketNoLongerValid = false;

  if (purchase.kind === "event_ticket" && purchase.event_id) {
    kind = "event_ticket";
    const [event, ticket] = await Promise.all([
      fetchEventById(adminDb, purchase.event_id),
      fetchEventTicketByPurchaseId(adminDb, purchase.id),
    ]);
    itemName = event?.name ?? null;
    // Gone after a full refund (unless it was checked in) or an exec's void.
    ticketNoLongerValid = !ticket;
  } else if (purchase.kind === "membership" && purchase.membership_type_id) {
    kind = "membership";
    const membershipType = await fetchMembershipTypeById(adminDb, purchase.membership_type_id);
    itemName = membershipType?.name ?? null;
  }

  if (!kind || !itemName) return null;

  const { subject, html } = renderRefundIssuedEmail({
    kind,
    itemName,
    userName: formatUserName(recipient),
    refundCents: refund.amountCents,
    paidCents: purchase.amount_cents,
    totalRefundedCents: Math.max(purchase.refunded_cents, refund.amountCents),
    currency: refund.currency,
    ticketNoLongerValid,
    purchasesUrl: origin ? purchaseHistoryUrl(origin) : null,
    orderId: purchase.id,
  });

  return { subject, html, to: recipient.email };
}
