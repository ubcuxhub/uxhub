import { notFound, redirect } from "next/navigation";

import type { EventRow } from "@/lib/supabase/models";
import { fetchEventById, fetchEventBySlug } from "@/lib/supabase-helpers/events";
import type { DbClient } from "@/lib/supabase-helpers/types";
import { isUuid } from "@/lib/uuid";
import { adminEventKey, adminEventPath } from "./admin-event-path";

/**
 * Resolves the `[event]` segment of an admin event route to its event, once
 * per request, so the page can query everything else by the event's ID.
 *
 * Admin event routes are keyed by slug (`adminEventPath`), and an ID still
 * works for links and bookmarks made before they were:
 *
 * - a slug that matches an event (of any status, so drafts resolve) returns
 *   it;
 * - an event ID redirects to the same path with the slug in its place,
 *   keeping `suffix` (the rest of the path, such as `/check-in` or `/edit`,
 *   and any query string);
 * - anything else is a 404.
 *
 * The redirect is temporary (307): a permanent one buys nothing on a signed-in
 * page, and a browser that cached it would keep sending the ID to the old slug
 * if slugs ever become editable.
 *
 * A value that is not a UUID is never queried as an ID: Postgres would throw
 * on the `uuid` column and 500 the page. Call this only after
 * `requireAdmin()`.
 */
export async function resolveAdminEvent(
  supabase: DbClient,
  param: string,
  suffix = ""
): Promise<EventRow> {
  return (await findAdminEvent(supabase, param, suffix)) ?? notFound();
}

/**
 * `resolveAdminEvent`, but returns null for a param that matches no event
 * instead of a 404: for the record drawer, which shows its own "Event not
 * found" over the list.
 */
export async function findAdminEvent(
  supabase: DbClient,
  param: string,
  suffix = ""
): Promise<EventRow | null> {
  if (isUuid(param)) {
    const event = await fetchEventById(supabase, param);
    if (event) {
      // An event whose slug is reserved keeps its ID as its key.
      if (adminEventKey(event) !== param) redirect(adminEventPath(event, suffix));
      return event;
    }
    // Not an ID; a UUID-shaped slug is still a slug.
  }

  return fetchEventBySlug(supabase, param);
}

/**
 * A page's search params as a query string (`?status=submitted`), or "", for
 * the suffix of a redirect that should keep them.
 */
export function querySuffix(
  searchParams: Record<string, string | string[] | undefined>
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, item);
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}
