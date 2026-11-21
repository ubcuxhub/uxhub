import { hasAdminAccess } from "@/lib/auth/roles";
import type { EventRow, EventStatus, RoleAccess } from "@/lib/supabase/models";

const MEMBER_STATUSES = ["active"] as const satisfies readonly EventStatus[];
const STAFF_STATUSES = ["active", "draft"] as const satisfies readonly EventStatus[];

/**
 * The event statuses the portal events timeline lists for a viewer: published
 * (`active`) events for everyone, plus drafts for admins and managers so they
 * can preview them (docs/event-states.md, "Drafts for admins").
 *
 * Pass the role of the server-side user (`requireAuth()`), never a client
 * value. This filter only narrows the query: RLS still returns drafts to
 * `is_admin()` alone, so a member never gets one whatever the filter says.
 */
export function portalEventStatuses(
  role: RoleAccess | null | undefined
): readonly EventStatus[] {
  return hasAdminAccess(role) ? STAFF_STATUSES : MEMBER_STATUSES;
}

/** True for an unpublished event, which only admins and managers can see. */
export function isDraftEvent(event: Pick<EventRow, "status">): boolean {
  return event.status === "draft";
}

/**
 * Whether the timeline tells the viewer that members don't see drafts: only
 * staff, and only when the list holds at least one draft.
 */
export function showsDraftEventsNote(
  role: RoleAccess | null | undefined,
  events: Pick<EventRow, "status">[]
): boolean {
  return hasAdminAccess(role) && events.some(isDraftEvent);
}

/**
 * Whether the database takes registrations on this draft: free events only,
 * as `event_ticket_eligibility` enforces (docs/event-states.md, "Drafts for
 * admins"). A paid draft takes none, so no card is ever charged on an
 * unpublished event. Applying needs no payment, so any draft takes applications.
 */
export function draftTakesRegistrations(
  event: Pick<EventRow, "status" | "regular_price" | "member_price">
): boolean {
  return isDraftEvent(event) && event.regular_price === 0 && (event.member_price ?? 0) === 0;
}

/** Why Register and Confirm are off on a paid draft. */
export const PAID_DRAFT_REGISTRATION_REASON = "Paid events take registrations once they’re published.";

/** Why Register is off on a draft while the checkout is behind `FLAGS.studentEvents`. */
export const DRAFT_REGISTRATION_UNLAUNCHED_REASON = "Registration opens once student events launch.";

/** Why Apply is off on a draft while the form is behind `FLAGS.studentEvents`. */
export const DRAFT_APPLICATION_UNLAUNCHED_REASON = "Applications open once student events launch.";

/**
 * Which of the registration panel's buttons can't work on this event, and
 * why: nothing for a published event. A draft shows the same panel a member
 * sees on the published event, but the checkout and the application form are
 * behind `studentEvents`, and the database refuses registrations on a paid
 * draft, so those buttons show disabled with the reason.
 */
export function draftRegistrationBlocks(
  event: Pick<EventRow, "status" | "regular_price" | "member_price">,
  studentEvents: boolean
): { register?: string; apply?: string } | undefined {
  if (!isDraftEvent(event)) return undefined;
  if (!studentEvents) {
    return {
      register: DRAFT_REGISTRATION_UNLAUNCHED_REASON,
      apply: DRAFT_APPLICATION_UNLAUNCHED_REASON,
    };
  }
  return draftTakesRegistrations(event) ? undefined : { register: PAID_DRAFT_REGISTRATION_REASON };
}

/** The note shown to staff on the timeline and on a draft's event page. */
export const DRAFT_EVENTS_NOTE = "Draft events are only visible to admins and managers.";
