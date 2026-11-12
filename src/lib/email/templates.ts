import { formatEventDate, formatEventTime } from "@/lib/date";
import type { EventRow, MembershipTypeRow, PurchaseRow } from "@/lib/supabase/models";

import { escapeHtml, renderEmailLayout } from "./layout";

function formatAmount(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

/** One label/value line inside the details block. Skipped when value is empty. */
export function detailRow(label: string, value: string | null | undefined) {
  if (!value) return "";

  return `<tr>
    <td style="padding:6px 16px 6px 0;color:#6b7280;font-size:14px;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${escapeHtml(value)}</td>
  </tr>`;
}

export function renderMembershipConfirmationEmail({
  expiresAt,
  membershipType,
  purchase,
  userName,
}: {
  /**
   * The member's effective expiry, already capped by the club-wide term end.
   * Null when it could not be read, in which case the email falls back to the
   * general "a year from purchase" wording rather than naming a wrong date.
   */
  expiresAt?: string | null;
  membershipType: Pick<MembershipTypeRow, "name">;
  purchase: Pick<
    PurchaseRow,
    "amount_cents" | "created_at" | "currency" | "id"
  >;
  userName: string;
}) {
  const expiryDate = formatEventDate(expiresAt);
  const details = [
    detailRow("Membership", membershipType.name),
    detailRow("Amount paid", formatAmount(purchase.amount_cents, purchase.currency)),
    detailRow("Purchased on", formatEventDate(purchase.created_at)),
    detailRow("Expires on", expiryDate),
    detailRow("Order ID", purchase.id),
  ].join("");

  return {
    html: renderEmailLayout({
      heading: "Your UX Hub membership is active",
      intro: `Hi ${userName}, thanks for joining. Your ${membershipType.name} membership is confirmed and active ${
        expiryDate ? `until ${expiryDate}` : "for the next year"
      }.`,
      body: `<table role="presentation" cellpadding="0" cellspacing="0">${details}</table>`,
    }),
    subject: `Your ${membershipType.name} membership is confirmed`,
  };
}

export function renderEventConfirmationEmail({
  event,
  purchase,
  userName,
}: {
  event: Pick<
    EventRow,
    | "ends_at"
    | "location_address_url"
    | "location_building"
    | "location_room"
    | "name"
    | "starts_at"
  >;
  purchase: Pick<
    PurchaseRow,
    "amount_cents" | "created_at" | "currency" | "id"
  >;
  userName: string;
}) {
  return {
    html: renderEmailLayout({
      heading: "You’re registered",
      intro: `Hi ${userName}, your ticket for ${event.name} is confirmed. Here are the details.`,
      body: `<table role="presentation" cellpadding="0" cellspacing="0">${renderEventDetailRows(
        event,
        purchase,
      )}</table>`,
    }),
    subject: `You’re registered for ${event.name}`,
  };
}

function renderEventDetailRows(
  event: Pick<
    EventRow,
    | "ends_at"
    | "location_address_url"
    | "location_building"
    | "location_room"
    | "name"
    | "starts_at"
  >,
  purchase: Pick<
    PurchaseRow,
    "amount_cents" | "created_at" | "currency" | "id"
  >,
) {
  const timeRange = [
    formatEventTime(event.starts_at),
    formatEventTime(event.ends_at),
  ]
    .filter(Boolean)
    .join(" – ");
  const location = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(" ");

  return [
    detailRow("Date", formatEventDate(event.starts_at)),
    detailRow("Time", timeRange),
    detailRow("Location", location),
    detailRow("Address", event.location_address_url),
    detailRow("Amount paid", formatAmount(purchase.amount_cents, purchase.currency)),
    detailRow("Order ID", purchase.id),
  ].join("");
}

/**
 * The 6-digit code that proves a UBC address (docs/design/ubc-email-verification.md).
 * The code stays out of the subject so it doesn't land in notification
 * previews and mail logs, and sits in the body as plain text so mail clients
 * and iOS can offer it for autofill.
 */
export function renderUbcVerificationCodeEmail({
  code,
  expiresInMinutes = 10,
}: {
  code: string;
  expiresInMinutes?: number;
}) {
  const codeBlock = `<p style="margin:0 0 24px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:600;letter-spacing:8px;color:#111827;">${escapeHtml(code)}</p>`;
  const notes = [
    `It expires in ${expiresInMinutes} minutes.`,
    "If you didn't request this, ignore this email. Someone may have typed your address by mistake. UX Hub will never ask you for this code.",
  ]
    .map(
      (line) =>
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#4b5563;">${escapeHtml(line)}</p>`,
    )
    .join("");

  return {
    html: renderEmailLayout({
      heading: "Your verification code",
      intro: "Use this code to verify your UBC email for UX Hub.",
      body: `${codeBlock}${notes}`,
    }),
    subject: "Your UX Hub verification code",
  };
}
