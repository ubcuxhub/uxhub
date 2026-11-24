import { formatEventDateTimeLines } from "@/lib/date";
import type { ParticipantLocation } from "@/lib/location";
import type { EventReminderKind } from "@/lib/supabase-helpers/event-reminders";

import { ctaButton, escapeHtml, renderEmailLayout } from "./layout";
import { detailRow, formatEventLocation } from "./templates";

/**
 * The reminder ticket holders get a day or two hours before an event starts
 * (supabase/README.md, "Event reminder emails"): when and where, and one
 * button to the portal event page, which shows the ticket and its QR code.
 * Recipients hold a ticket, so the location is the full one, even when the
 * event hides it from people who haven't registered.
 */

export interface EventReminderEmailInput {
  kind: EventReminderKind;
  firstName: string;
  eventName: string;
  /** The portal event page, absolute. */
  eventUrl: string;
  startsAt: string;
  endsAt: string | null;
  location: ParticipantLocation | null;
}

/**
 * "Sat, Jan 9, 9:00 AM–7:00 PM Pacific time". A multi-day event shows its
 * first day and start time: the reminder is for that day.
 */
export function formatReminderWhen(startsAt: string, endsAt: string | null) {
  const [first] = formatEventDateTimeLines(startsAt, endsAt);
  return first ? `${first.day}, ${first.time} Pacific time` : null;
}

/** Where to go, as the receipt shows it, plus the street address. */
export function formatReminderWhere(location: ParticipantLocation | null) {
  if (!location) return { where: null, address: null };
  const place = formatEventLocation(location.building, location.room);
  if (location.type === "online") return { where: "Online", address: null };
  if (location.type === "hybrid") {
    return { where: place ? `${place}, or online` : "Online", address: location.address ?? null };
  }
  return { where: place || null, address: location.address ?? null };
}

function paragraph(text: string) {
  return `<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4b5563;">${escapeHtml(text)}</p>`;
}

function greeting(firstName: string) {
  const name = firstName.trim();
  return name ? `Hi ${name}` : "Hi there";
}

export function renderEventReminderEmail({
  kind,
  firstName,
  eventName,
  eventUrl,
  startsAt,
  endsAt,
  location,
}: EventReminderEmailInput): { subject: string; html: string } {
  const hi = greeting(firstName);
  const { where, address } = formatReminderWhere(location);
  const details = [
    detailRow("When", formatReminderWhen(startsAt, endsAt)),
    detailRow("Where", where),
    detailRow("Address", address),
  ].join("");
  const title = kind === "1d" ? `See you tomorrow at ${eventName}` : `${eventName} starts soon`;
  const intro = kind === "1d"
    ? `${hi}, a quick reminder that ${eventName} is tomorrow. Here are the details.`
    : `${hi}, ${eventName} starts in about two hours. Here are the details.`;

  return {
    subject: title,
    html: renderEmailLayout({
      heading: title,
      hubbo: "curious",
      intro,
      body: [
        details ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${details}</table>` : "",
        paragraph("Your ticket and its QR code are on the event page. Show the code to a UX Hub exec when you check in."),
        // The URL is built from our own origin and an encoded slug; escaping
        // it keeps the attribute well formed whatever it holds.
        ctaButton({ label: "View your ticket", url: escapeHtml(eventUrl) }),
      ].join(""),
    }),
  };
}
