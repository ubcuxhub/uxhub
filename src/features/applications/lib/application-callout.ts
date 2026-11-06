import type { EventApplicationRow, EventRow } from "@/lib/supabase/models";

import { applicationWindow } from "./application-form";

/**
 * What the portal event page tells a member about their application, for an
 * event that requires one. Follows docs/event-states.md: a draft is not an
 * application yet, a ticket outranks the application, and an accepted offer
 * either still stands ("Register by") or has expired.
 */
export type ApplicationCallout =
  | { kind: "apply" }
  | { kind: "not_open" }
  | { kind: "closed" }
  | { kind: "draft" }
  | { kind: "draft_closed" }
  | { kind: "pending" }
  | { kind: "accepted"; offerExpiresAt: string }
  | { kind: "offer_expired" }
  | { kind: "waitlisted" }
  | { kind: "not_selected" };

export function applicationCallout(input: {
  event: Pick<EventRow, "registration_opens_at" | "registration_closes_at">;
  application: Pick<EventApplicationRow, "status" | "offer_expires_at"> | null;
  hasTicket: boolean;
  now?: number;
}): ApplicationCallout | null {
  const { event, application, hasTicket, now = Date.now() } = input;
  // A ticket holder is going; the page's ticket says so.
  if (hasTicket) return null;

  const state = applicationWindow(event, now);
  switch (application?.status) {
    case "submitted":
      return { kind: "pending" };
    case "waitlisted":
      return { kind: "waitlisted" };
    case "rejected":
      return { kind: "not_selected" };
    case "accepted": {
      const expiresAt = application.offer_expires_at;
      return expiresAt && Date.parse(expiresAt) > now
        ? { kind: "accepted", offerExpiresAt: expiresAt }
        : { kind: "offer_expired" };
    }
    case "draft":
      return state === "closed" ? { kind: "draft_closed" } : { kind: "draft" };
    default:
      return state === "open"
        ? { kind: "apply" }
        : state === "not_open"
          ? { kind: "not_open" }
          : { kind: "closed" };
  }
}
