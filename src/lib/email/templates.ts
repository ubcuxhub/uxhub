import { formatEventDate, formatEventTime } from "@/lib/date";
import type { EventRow, MembershipTypeRow, PurchaseRow } from "@/types/models";

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
  membershipType,
  purchase,
  userName,
}: {
  membershipType: Pick<MembershipTypeRow, "name">;
  purchase: Pick<
    PurchaseRow,
    "amount_cents" | "created_at" | "currency" | "id"
  >;
  userName: string;
}) {
  const details = [
    detailRow("Membership", membershipType.name),
    detailRow("Amount paid", formatAmount(purchase.amount_cents, purchase.currency)),
    detailRow("Purchased on", formatEventDate(purchase.created_at)),
    detailRow("Order ID", purchase.id),
  ].join("");

  return {
    html: renderEmailLayout({
      heading: "Your UX Hub membership is active",
      intro: `Hi ${userName}, thanks for joining. Your ${membershipType.name} membership is confirmed and active for the next year.`,
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
    | "end_time"
    | "location_address_url"
    | "location_building"
    | "location_room"
    | "name"
    | "start_date"
    | "start_time"
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
    | "end_time"
    | "location_address_url"
    | "location_building"
    | "location_room"
    | "name"
    | "start_date"
    | "start_time"
  >,
  purchase: Pick<
    PurchaseRow,
    "amount_cents" | "created_at" | "currency" | "id"
  >,
) {
  const timeRange = [
    formatEventTime(event.start_time),
    formatEventTime(event.end_time),
  ]
    .filter(Boolean)
    .join(" – ");
  const location = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(" ");

  return [
    detailRow("Date", formatEventDate(event.start_date)),
    detailRow("Time", timeRange),
    detailRow("Location", location),
    detailRow("Address", event.location_address_url),
    detailRow("Amount paid", formatAmount(purchase.amount_cents, purchase.currency)),
    detailRow("Order ID", purchase.id),
  ].join("");
}
