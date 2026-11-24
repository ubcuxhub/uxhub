import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { EventLinkRow } from "@/lib/supabase/models";

/**
 * The event's links the viewer may see, in order. RLS filters by visibility:
 * `everyone` for anyone who can see the event, `going` for ticket holders,
 * and `after_event` once the event has ended. Pass the viewer's own client.
 */
export async function fetchEventLinks(
  supabase: DbClient,
  eventId: string
): Promise<EventLinkRow[]> {
  const { data, error } = await supabase
    .from(TABLES.eventLinks)
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
