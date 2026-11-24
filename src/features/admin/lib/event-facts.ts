import type { EventRow } from "@/lib/supabase/models";

/**
 * As the database's `event_has_ended`: a published event whose end (or start,
 * without one) is at or before `now`. A draft never reads as ended.
 */
export function eventHasEnded(
  event: { status: string; starts_at?: string | null; ends_at?: string | null },
  now: Date | number = Date.now(),
): boolean {
  const end = event.ends_at || event.starts_at;
  return event.status === "active" && !!end && Date.parse(end) <= Number(now);
}

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

/** "Free" or "$15.00", or null without a price. */
export function formatEventPrice(value: number | null): string | null {
  if (value === null) return null;
  return Number(value) === 0 ? "Free" : currency.format(Number(value));
}

/** "Free", "$15.00", or "$15.00 · $10.00 for members"; "Not set" without a price. */
export function describeEventPrice(event: Pick<EventRow, "regular_price" | "member_price">): string {
  const regular = formatEventPrice(event.regular_price);
  const member = formatEventPrice(event.member_price);
  if (!regular) return "Not set";
  if (!member || member === regular) return regular;
  return `${regular} · ${member} for members`;
}
