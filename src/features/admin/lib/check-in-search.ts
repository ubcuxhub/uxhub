import type { CheckInAttendee } from "@/features/admin/types";

/** The attendees whose name or email contains `query`, ignoring case. */
export function searchCheckInAttendees(
  attendees: CheckInAttendee[],
  query: string
): CheckInAttendee[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return attendees;

  return attendees.filter(
    (attendee) =>
      attendee.user_name.toLowerCase().includes(needle) ||
      attendee.user_email.toLowerCase().includes(needle)
  );
}
