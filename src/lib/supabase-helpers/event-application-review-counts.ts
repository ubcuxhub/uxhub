import { TABLES } from "./tables";
import type { DbClient } from "./types";

const PAGE = 1000;

/**
 * How many submitted applications await a decision, for each of several
 * events, in one query. "Submitted" is the same `status = 'submitted'` that
 * `fetchEventApplicationStatusCounts` reports for an event's overview, so the
 * list and the drawer agree. Drafts never count. Events with none are absent
 * from the map. Under RLS a non-admin sees no applications, so pass an
 * admin's client.
 */
export async function fetchSubmittedApplicationCounts(
  supabase: DbClient,
  eventIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (eventIds.length === 0) return counts;

  // One row per application, counted here, paged past PostgREST's row cap.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(TABLES.eventApplications)
      .select("event_id")
      .eq("status", "submitted")
      .in("event_id", eventIds)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const { event_id } of data ?? []) {
      counts.set(event_id, (counts.get(event_id) ?? 0) + 1);
    }
    if ((data?.length ?? 0) < PAGE) return counts;
  }
}
