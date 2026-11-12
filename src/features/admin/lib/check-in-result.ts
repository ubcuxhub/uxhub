import { formatEventTime } from "@/lib/date";
import type { CheckInRejection, CheckInResult } from "@/features/admin/types";

export interface CheckInResultCopy {
  /** The line read at arm's length: the person's name, or why it failed. */
  title: string;
  detail: string;
}

const REJECTIONS: Record<CheckInRejection, CheckInResultCopy> = {
  invalid_code: {
    title: "Not a UX Hub ticket",
    detail: "This code isn't a ticket. Ask for their ticket, or look them up.",
  },
  not_found: {
    title: "Ticket not found",
    detail: "This ticket no longer exists. Check the attendee list.",
  },
  wrong_event: {
    title: "Ticket is for a different event",
    detail: "Ask for their ticket to this event.",
  },
};

/** The words on the result card after a scan or a manual check-in. */
export function describeCheckInResult(result: CheckInResult): CheckInResultCopy {
  switch (result.status) {
    case "checked_in":
      return { title: result.name, detail: "Checked in" };
    case "already_checked_in":
      return {
        title: result.name,
        detail: `Already checked in at ${formatEventTime(result.checkedInAt)}`,
      };
    case "rejected":
      return REJECTIONS[result.reason];
  }
}
