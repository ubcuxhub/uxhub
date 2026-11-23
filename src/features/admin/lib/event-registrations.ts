import {
  EMPTY_REVIEW_FILTERS,
  serializeReviewListQuery,
  type ApplicationReviewState,
  DEFAULT_REVIEW_SORT,
} from "./application-review";

/**
 * Ticket holders checked in to at least one agenda item, each counted once.
 * `statuses` is keyed `${ticketId}_${sessionId}` (`fetchCheckInStatuses`,
 * which only returns check-ins on the event's own tickets). Pass `holders`
 * to count only those tickets.
 */
export function countCheckedInTickets(
  statuses: Map<string, string | null>,
  holders?: Iterable<string>
): number {
  const only = holders ? new Set(holders) : null;
  const checkedIn = new Set<string>();
  for (const [key, checkedInAt] of statuses) {
    const ticketId = key.slice(0, key.indexOf("_"));
    if (checkedInAt && (!only || only.has(ticketId))) checkedIn.add(ticketId);
  }
  return checkedIn.size;
}

/**
 * The review chips an application with status `accepted` lands on: an open
 * offer, a ticket (Going), or a lapsed offer. The Registrations card's
 * Accepted row counts them all, and links to the three together.
 */
export const ACCEPTED_REVIEW_STATES: readonly ApplicationReviewState[] = [
  "accepted",
  "registered",
  "offer_expired",
];

/**
 * The review list filtered to `statuses` (every state when empty), for a
 * link from a count to the applicants behind it.
 */
export function reviewListHref(
  eventId: string,
  statuses: readonly ApplicationReviewState[]
): string {
  return `/admin/events/${eventId}/review-applications${serializeReviewListQuery({
    ...EMPTY_REVIEW_FILTERS,
    statuses: [...statuses],
    sort: DEFAULT_REVIEW_SORT,
    q: "",
    page: 1,
  })}`;
}
