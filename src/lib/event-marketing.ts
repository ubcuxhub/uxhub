import type { EventRow } from "@/lib/supabase/models";
import { safeContentUrl } from "@/features/admin/lib/event-content";

export type MarketingDestination =
  | { kind: "hosted" }
  | { kind: "external"; url: string }
  | { kind: "none" };

type MarketingColumns = Pick<EventRow, "configured_marketing_mode" | "configured_marketing_url" | "marketing_url">;

/**
 * Where an event's public marketing page lives. Rows saved before the
 * marketing setting existed have no mode: an external URL means external,
 * anything else is the hosted page. An external setting without a usable
 * http(s) URL has nowhere to send people, so it counts as none.
 */
export function publicMarketingDestination(event: MarketingColumns): MarketingDestination {
  const mode = event.configured_marketing_mode ?? (event.marketing_url ? "external" : "hosted");
  if (mode === "hosted") return { kind: "hosted" };
  if (mode === "external") {
    const url = event.configured_marketing_url || event.marketing_url;
    return url && safeContentUrl(url) ? { kind: "external", url } : { kind: "none" };
  }
  return { kind: "none" };
}
