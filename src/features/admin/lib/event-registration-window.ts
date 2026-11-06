import type { EventRow } from "@/lib/supabase/models";

/**
 * Where an event's registration window stands. A draft has none: nobody can
 * see it to register. An unset bound is open-ended.
 */
export type RegistrationWindow = "not-applicable" | "upcoming" | "open" | "closed";

export function registrationWindow(
  event: Pick<EventRow, "status" | "registration_opens_at" | "registration_closes_at">,
  now: Date
): RegistrationWindow {
  if (event.status === "draft") return "not-applicable";
  const opens = event.registration_opens_at ? Date.parse(event.registration_opens_at) : null;
  const closes = event.registration_closes_at ? Date.parse(event.registration_closes_at) : null;
  if (opens !== null && now.getTime() < opens) return "upcoming";
  if (closes !== null && now.getTime() > closes) return "closed";
  return "open";
}
