import type { DbClient } from "./types";
import { TABLES } from "./tables";
import type { EventLinkRow, EventPrivateDetailsRow } from "@/lib/supabase/models";

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

/**
 * The event's online meeting details, or null when there are none or the
 * viewer holds no ticket (RLS). Pass the viewer's own client.
 */
export async function fetchEventPrivateDetails(
  supabase: DbClient,
  eventId: string
): Promise<EventPrivateDetailsRow | null> {
  const { data, error } = await supabase
    .from(TABLES.eventPrivateDetails)
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
