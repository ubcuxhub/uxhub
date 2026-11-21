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
 * Whether staff may test-register on this draft: free events only, as
 * `event_ticket_eligibility` enforces (docs/event-states.md, "Drafts for
 * admins"). A paid draft takes no registrations, so no card is ever held.
 */
export function allowsStaffTestRegistration(
  event: Pick<EventRow, "status" | "regular_price" | "member_price">
): boolean {
  return isDraftEvent(event) && event.regular_price === 0 && (event.member_price ?? 0) === 0;
}

/** The staff test registration button on a draft. */
export const STAFF_TEST_REGISTRATION_LABEL = "Test registration (UX Hub execs only)";

/** Shown beside every staff test registration control. */
export const STAFF_TEST_REGISTRATION_WARNING =
  "This creates a real registration, ticket and $0 purchase. Delete the event or keep it in Draft afterwards; members never see a draft.";

/** The note shown to staff on the timeline and on a draft's event page. */
export const DRAFT_EVENTS_NOTE = "Draft events are only visible to admins and managers.";
