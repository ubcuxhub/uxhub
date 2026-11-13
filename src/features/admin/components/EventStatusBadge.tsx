import { CalendarClock, Check, FilePen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatEventDate } from "@/lib/date";
import type { EventStatus } from "@/lib/supabase/models";

/** The admin label for each stored status, for filters and copy. */
export const EVENT_STATUS_LABELS = {
  active: "Active",
  draft: "Draft",
} satisfies Record<EventStatus, string>;

/**
 * An event's publication state for admins: Active, Draft, or a draft that
 * publishes itself on a date ("Scheduled Nov 20").
 */
export function EventStatusBadge({
  status,
  publishAt = null,
}: {
  status: EventStatus;
  publishAt?: string | null;
}) {
  if (status === "active") {
    return (
      <Badge variant="success">
        <Check aria-hidden="true" />
        {EVENT_STATUS_LABELS.active}
      </Badge>
    );
  }

  const scheduled = formatEventDate(publishAt, { month: "short", year: undefined });
  if (scheduled) {
    return (
      <Badge variant="info">
        <CalendarClock aria-hidden="true" />
        Scheduled {scheduled}
      </Badge>
    );
  }

  return (
    <Badge variant="neutral">
      <FilePen aria-hidden="true" />
      {EVENT_STATUS_LABELS.draft}
    </Badge>
  );
}
