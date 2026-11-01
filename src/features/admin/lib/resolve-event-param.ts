import { notFound, redirect } from "next/navigation";

import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import type { DbClient } from "@/lib/supabase-helpers/types";
import { isUuid } from "@/lib/uuid";

/**
 * Resolves the `[event]` segment of an admin event route to an event ID.
 *
 * Admin event routes are keyed by ID, but a slug is an easy thing to paste
 * into the URL. Passed to a query against the `uuid` column it makes Postgres
 * throw, which would 500 the page before it could reach `notFound()`. So a
 * value that is not a UUID is never queried as one:
 *
 * - a UUID is returned unchanged;
 * - a slug that matches an event (of any status, so drafts resolve) redirects
 *   to the same path with the ID in its place;
 * - anything else is a 404.
 *
 * `suffix` is the rest of the path after the event segment (for example
 * `/check-in`), kept on the redirect. Call this before any query that takes
 * the param, and only after `requireAdmin()`.
 */
export async function resolveAdminEventId(
  supabase: DbClient,
  param: string,
  suffix = ""
): Promise<string> {
  if (isUuid(param)) return param;

  const event = await fetchEventBySlug(supabase, param);
  if (!event) notFound();

  redirect(`/admin/events/${event.id}${suffix}`);
}
