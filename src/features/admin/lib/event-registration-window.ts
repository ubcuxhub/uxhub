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

/**
 * What the window's dates are called. On an event that takes applications,
 * `registration_opens_at` and `registration_closes_at` bound applying, and
 * accepted applicants register until their own offer deadline.
 */
export function windowLabels(requiresApplication: boolean) {
  return requiresApplication
    ? {
        window: "Application window",
        opens: "Applications open",
        closes: "Applications close",
        openingDate: "Applications opening date",
        openingTime: "Applications opening time",
        closingDate: "Applications closing date",
        closingTime: "Applications closing time",
        incomplete: "Application dates require both a date and time.",
        reversed: "Applications must close after they open.",
      }
    : {
        window: "Registration window",
        opens: "Registration opens",
        closes: "Registration closes",
        openingDate: "Registration opening date",
        openingTime: "Registration opening time",
        closingDate: "Registration closing date",
        closingTime: "Registration closing time",
        incomplete: "Registration dates require both a date and time.",
        reversed: "Registration end time must be after the start time.",
      };
}
