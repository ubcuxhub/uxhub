import type { DbClient } from "./types";
import { TABLES } from "./tables";

/** Staff-only form configuration; not an applicant decision projection. */
export async function fetchEventApplicationSettings(client: DbClient, eventId: string) {
  const { data, error } = await client.from(TABLES.eventApplicationSettings).select("*").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  return data;
}
