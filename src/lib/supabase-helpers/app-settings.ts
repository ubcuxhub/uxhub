import type { DbClient } from "./types";
import { TABLES } from "./tables";

/**
 * Reads the club-wide membership term end date.
 *
 * `app_settings` is a single-row table (see the `add_app_settings` migration),
 * so this always targets the one row rather than filtering. Returns null when
 * no ceiling is set, which is the "memberships last a year from purchase"
 * behavior the app had before terms existed.
 *
 * Readable with the anon key, so this works from the browser client as well as
 * from server components.
 */
export async function fetchMembershipTermEndsAt(
  supabase: DbClient
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.appSettings)
    .select("membership_term_ends_at")
    .maybeSingle();

  if (error) throw error;
  return data?.membership_term_ends_at ?? null;
}
