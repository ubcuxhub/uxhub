import { formatCents } from "@/lib/money";

import { ctaButton, escapeHtml, renderEmailLayout } from "./layout";
import { detailRow } from "./templates";

/**
 * The email a buyer gets for each completed Square refund on one of their
 * purchases (docs/event-states.md, "Refunds"). It says what was refunded and
 * when to expect it, and nothing the purchase history doesn't already show.
 * No card details or Square IDs.
 */

export interface RefundIssuedEmailInput {
  kind: "event_ticket" | "membership";
  /** The event's or membership tier's name. */
  itemName: string;
  /** Empty when unknown: the greeting falls back to "Hi there". */
  userName: string;
  /** This refund's amount. */
  refundCents: number;
  /** What the buyer paid for the purchase. */
  paidCents: number;
  /** Everything refunded on the purchase so far, this refund included. */
  totalRefundedCents: number;
  currency: string;
  /**
   * An event ticket that no longer exists: taken back by a full refund, or
   * voided by UX Hub execs. A ticket kept because it was already checked in
   * is still valid.
   */
  ticketNoLongerValid: boolean;
  /** Absolute link to the buyer's purchase history, or null to leave it out. */
  purchasesUrl: string | null;
  /** The purchase's own ID, as the receipt shows it. */
  orderId: string;
}

/** "$12.50 CAD": the receipts' amount, with the currency spelled out. */
export function formatRefundAmount(amountCents: number, currency: string) {
  return formatCents(amountCents, { currency, withCode: true });
}

/** The buyer's purchase history: the Purchases tab of the settings dialog. */
export function purchaseHistoryUrl(origin: string) {
  return `${origin}/portal#settings/purchases`;
}

function paragraph(text: string) {
  return `<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4b5563;">${escapeHtml(text)}</p>`;
}

export function renderRefundIssuedEmail({
  kind,
  itemName,
  userName,
  refundCents,
  paidCents,
  totalRefundedCents,
  currency,
  ticketNoLongerValid,
  purchasesUrl,
  orderId,
}: RefundIssuedEmailInput): { subject: string; html: string } {
  const full = refundCents >= paidCents;
  const amount = formatRefundAmount(refundCents, currency);
  const name = userName.trim();
  const hi = name ? `Hi ${name}` : "Hi there";
  const what = kind === "event_ticket" ? `your ticket for ${itemName}` : `your ${itemName} membership`;

  const details = [
    detailRow(kind === "event_ticket" ? "Event" : "Membership", itemName),
    detailRow("Amount refunded", amount),
    detailRow("Refund", full ? "Full refund" : "Partial refund"),
    full
      ? ""
      : detailRow(
          "Refunded so far",
          `${formatRefundAmount(Math.min(totalRefundedCents, paidCents), currency)} of ${formatRefundAmount(paidCents, currency)}`
        ),
    detailRow("Order ID", orderId),
  ].join("");

  return {
    subject: `Your refund for ${itemName}`,
    html: renderEmailLayout({
      heading: "Your refund is on its way",
      hubbo: "resting",
      intro: full
        ? `${hi}, we’ve refunded ${what} in full.`
        : `${hi}, we’ve refunded part of what you paid for ${what}.`,
      body: [
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">${details}</table>`,
        kind === "event_ticket" && ticketNoLongerValid
          ? paragraph(`Your ticket for ${itemName} is no longer valid.`)
          : "",
        paragraph("Refunds usually take 5–10 business days to appear, depending on your bank."),
        purchasesUrl ? ctaButton({ label: "View your purchases", url: escapeHtml(purchasesUrl) }) : "",
      ].join(""),
    }),
  };
}
