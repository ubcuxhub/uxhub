import { describe, expect, it } from "vitest";

import { renderApplicationEmail } from "./application-templates";
import { renderConfirmationEmail, renderRecoveryEmail } from "./auth-templates";
import type { HubboEmotion } from "./layout";
import { renderRefundIssuedEmail } from "./refund-templates";
import { renderEventReminderEmail } from "./reminder-templates";
import { renderEventConfirmationEmail, renderMembershipConfirmationEmail } from "./templates";

const purchase = { amount_cents: 1500, created_at: "2026-08-01T00:00:00Z", currency: "CAD", id: "purchase-1" };
const event = {
  ends_at: "2025-09-13T03:00:00+00:00",
  location_address_url: null,
  location_building: "Buchanan",
  location_room: "A101",
  name: "Portfolio Night",
  starts_at: "2025-09-13T01:00:00+00:00",
};
const application = {
  firstName: "Priya",
  eventName: "UXathon 2027",
  eventUrl: "https://www.ubcuxhub.ca/portal/events/uxathon-2027",
  offerExpiresAt: "2026-11-26T06:45:00Z",
};
const reminder = {
  firstName: "Priya",
  eventName: "Design Jam",
  eventUrl: "https://www.ubcuxhub.ca/portal/events/design-jam",
  startsAt: "2026-11-28T01:00:00Z",
  endsAt: "2026-11-28T04:00:00Z",
  location: null,
};

/** Every email UX Hub sends, and the Hubbo it shows (null for none). */
const emails: [string, () => string, HubboEmotion | null][] = [
  ["confirm your email", renderConfirmationEmail, "welcoming"],
  ["password recovery", renderRecoveryEmail, null],
  ["registration confirmed", () => renderEventConfirmationEmail({ event, purchase, userName: "Ada" }).html, "excited"],
  [
    "membership confirmed",
    () => renderMembershipConfirmationEmail({ membershipType: { name: "Innovator" }, purchase, userName: "Ada" }).html,
    "proud",
  ],
  ["application received", () => renderApplicationEmail({ ...application, kind: "received" }).html, "thinking"],
  ["accepted", () => renderApplicationEmail({ ...application, kind: "accepted" }).html, "excited"],
  ["waitlisted", () => renderApplicationEmail({ ...application, kind: "waitlisted" }).html, "resting"],
  ["not selected", () => renderApplicationEmail({ ...application, kind: "rejected" }).html, null],
  ["confirm-your-spot reminder", () => renderApplicationEmail({ ...application, kind: "offer_reminder" }).html, "curious"],
  ["event reminder, 1 day", () => renderEventReminderEmail({ ...reminder, kind: "1d" }).html, "curious"],
  ["event reminder, 2 hours", () => renderEventReminderEmail({ ...reminder, kind: "2h" }).html, "curious"],
  [
    "refund issued",
    () =>
      renderRefundIssuedEmail({
        kind: "event_ticket",
        itemName: "Design Sprint",
        userName: "Ada",
        refundCents: 2500,
        paidCents: 2500,
        totalRefundedCents: 2500,
        currency: "CAD",
        ticketNoLongerValid: true,
        purchasesUrl: null,
        orderId: "purchase-1",
      }).html,
    "resting",
  ],
];

describe("Hubbo in each email", () => {
  it.each(emails)("%s", (_name, render, emotion) => {
    const images = render().match(/<img [^>]*>/g) ?? [];

    if (emotion === null) {
      expect(images).toEqual([]);
    } else {
      expect(images).toHaveLength(1);
      expect(images[0]).toContain(`src="https://www.ubcuxhub.ca/email/hubbo-${emotion}.png"`);
    }
  });
});
