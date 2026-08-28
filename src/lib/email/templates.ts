import { formatEventDate, formatEventTime } from "@/lib/date";
import type { EventRow, MembershipTypeRow, PurchaseRow } from "@/types/models";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAmount(amountCents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
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

function renderEmailLayout({
  body,
  heading,
  intro,
}: {
  body: string;
  heading: string;
  intro: string;
}) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#4b5563;">${escapeHtml(intro)}</p>
        ${body}
        <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;">UBC UX Hub</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function renderMembershipConfirmationEmail({
  membershipType,
  purchase,
  userName,
}: {
  membershipType: Pick<MembershipTypeRow, "name">;
  purchase: Pick<PurchaseRow, "amount_cents" | "created_at" | "id">;
  userName: string;
}) {
  const details = [
    detailRow("Membership", membershipType.name),
    detailRow("Amount paid", formatAmount(purchase.amount_cents)),
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
  purchase: Pick<PurchaseRow, "amount_cents" | "created_at" | "id">;
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
  purchase: Pick<PurchaseRow, "amount_cents" | "created_at" | "id">,
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
    detailRow("Amount paid", formatAmount(purchase.amount_cents)),
    detailRow("Order ID", purchase.id),
  ].join("");
}
