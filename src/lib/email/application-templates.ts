import { formatEventDate, formatEventTime } from "@/lib/date";
import type { ApplicationEmailKind } from "@/lib/supabase-helpers/application-emails";

import { ctaButton, escapeHtml, renderEmailLayout } from "./layout";

/**
 * The plain, fixed-copy emails applicants get: `received` right after they
 * submit, and the decision emails once their decision is released and a day
 * before an offer runs out (docs/event-states.md, "Application emails"). Each
 * says what the portal already shows and promises nothing else.
 */

export interface ApplicationEmailInput {
  /** `received` is sent on submit; the rest by the scheduled decision job. */
  kind: ApplicationEmailKind | "received";
  firstName: string;
  eventName: string;
  /**
   * Absolute: the portal event page, or for `received` the application page,
   * which shows a submitted application read-only.
   */
  eventUrl: string;
  /** The offer deadline, for an acceptance or a reminder. */
  offerExpiresAt: string | null;
  /**
   * For `received`: when decisions are released, if that is still ahead.
   * Null or absent when it isn't set.
   */
  decisionsReleaseAt?: string | null;
}

/** "Wed, Nov 25, 2026 at 11:45 PM Pacific time". */
export function formatOfferDeadline(value: string) {
  const date = formatEventDate(value, { weekday: "short", month: "short" });
  const time = formatEventTime(value);
  return time ? `${date} at ${time} Pacific time` : `${date}`;
}

function paragraph(text: string) {
  return `<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4b5563;">${escapeHtml(text)}</p>`;
}

function greeting(firstName: string) {
  const name = firstName.trim();
  return name ? `Hi ${name}` : "Hi there";
}

export function renderApplicationEmail({
  kind,
  firstName,
  eventName,
  eventUrl,
  offerExpiresAt,
  decisionsReleaseAt = null,
}: ApplicationEmailInput): { subject: string; html: string } {
  const hi = greeting(firstName);
  // The URL is built from our own origin and an encoded slug; escaping it
  // keeps the attribute well formed whatever it holds.
  const button = (label: string) => ctaButton({ label, url: escapeHtml(eventUrl) });
  const deadline = offerExpiresAt ? formatOfferDeadline(offerExpiresAt) : null;

  switch (kind) {
    case "received": {
      const releaseDate = formatEventDate(decisionsReleaseAt, { weekday: "short", month: "short" });
      return {
        subject: `We received your application to ${eventName}`,
        html: renderEmailLayout({
          heading: "Application received",
          intro: `${hi}, thanks for applying to ${eventName}. We’ve received your application.`,
          body: [
            paragraph(
              releaseDate
                ? `UX Hub execs will review it, and you’ll hear from us by ${releaseDate}.`
                : "UX Hub execs will review it and let you know."
            ),
            paragraph("You can’t edit your answers now that you’ve submitted, but you can still view them."),
            button("View your application"),
          ].join(""),
        }),
      };
    }
    case "accepted":
      return {
        subject: `You’re in: ${eventName}`,
        html: renderEmailLayout({
          heading: `You’re accepted to ${eventName}`,
          intro: `${hi}, congratulations! Your application to ${eventName} was accepted.`,
          body: [
            paragraph(
              deadline
                ? `Confirm your spot in the portal by ${deadline}. If you don’t confirm in time, you may lose your spot.`
                : "Confirm your spot in the portal. If you don’t confirm in time, you may lose your spot."
            ),
            button("Confirm your spot"),
          ].join(""),
        }),
      };
    case "waitlisted":
      return {
        subject: `You’re on the waitlist for ${eventName}`,
        html: renderEmailLayout({
          heading: "You’re on the waitlist",
          intro: `${hi}, thanks for applying to ${eventName}. You’re on the waitlist for now.`,
          body: [
            paragraph("If a spot opens up, it’ll show on the event page in the portal."),
            button("View the event"),
          ].join(""),
        }),
      };
    case "rejected":
      return {
        subject: `Your application to ${eventName}`,
        html: renderEmailLayout({
          heading: "Thanks for applying",
          intro: `${hi}, thank you for applying to ${eventName}. We weren’t able to offer you a spot this time.`,
          body: paragraph(
            "We know this isn’t the news you hoped for, and we’re grateful you applied. Keep an eye out for upcoming events. We’d love to see you at the next one."
          ),
        }),
      };
    case "offer_reminder":
      return {
        subject: `Reminder: confirm your spot at ${eventName}`,
        html: renderEmailLayout({
          heading: "Your spot is waiting",
          intro: `${hi}, your offer for ${eventName} runs out in less than a day.`,
          body: [
            paragraph(
              deadline
                ? `Confirm your spot in the portal by ${deadline}. If you don’t confirm in time, you may lose your spot.`
                : "Confirm your spot in the portal soon. If you don’t confirm in time, you may lose your spot."
            ),
            button("Confirm your spot"),
          ].join(""),
        }),
      };
  }
}

/** The portal event page for `slug` on `origin` ("https://www.ubcuxhub.ca"). */
export function portalEventUrl(origin: string, slug: string) {
  return `${origin}/portal/events/${encodeURIComponent(slug)}`;
}

/**
 * The event's application page: read-only once submitted, and a redirect to
 * the event page once a decision is released.
 */
export function portalApplicationUrl(origin: string, slug: string) {
  return `${portalEventUrl(origin, slug)}/apply`;
}
