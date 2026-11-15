import type { EventRow } from "@/lib/supabase/models";

const LIST_HREF = "/admin/events";

/**
 * Names under `/admin/events/` that are routes of their own. An event whose
 * slug is one of them can't be reached by it (the static route wins), so its
 * admin URLs keep its ID.
 */
export const RESERVED_ADMIN_EVENT_SEGMENTS: ReadonlySet<string> = new Set([
  "create-new",
  "drafts",
]);

type EventKeyFields = Pick<EventRow, "id"> & { slug: string | null };

/**
 * The `[event]` segment of an event's admin URLs: its slug, or its ID when it
 * has no usable slug (a reserved name, or none).
 */
export function adminEventKey(event: EventKeyFields): string {
  return event.slug && !RESERVED_ADMIN_EVENT_SEGMENTS.has(event.slug)
    ? event.slug
    : event.id;
}

/**
 * An event's admin URL: `/admin/events/<slug>` (the overview drawer), plus
 * `suffix` for the pages below it (`/edit`, `/check-in`,
 * `/review-applications`). Every link to an admin event page goes through
 * this, so the slug is the URL everywhere.
 */
export function adminEventPath(event: EventKeyFields, suffix = ""): string {
  return `${LIST_HREF}/${encodeURIComponent(adminEventKey(event))}${suffix}`;
}
