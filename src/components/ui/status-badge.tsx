import * as React from "react";
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  ClockAlert,
  DoorClosed,
  DoorOpen,
  History,
  Hourglass,
  Lock,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";

/**
 * The nine statuses of the design system (§3.3, §4.3). One badge per item,
 * showing the current status only.
 */
export type CoreStatus =
  | "registration_open"
  | "going"
  | "checked_in"
  | "accepted"
  | "pending"
  | "waitlisted"
  | "full"
  | "not_selected"
  | "past";

/**
 * The student event-card labels of §3.3 that the nine core statuses can't say.
 * "Opens" and "Register by" carry the event's own date (`date`).
 */
export type StudentEventStatus =
  | "opens"
  | "registration_closed"
  | "under_review"
  | "register_by"
  | "offer_expired";

export type Status = CoreStatus | StudentEventStatus;

type Tone = NonNullable<BadgeProps["variant"]>;

interface StatusConfig {
  tone: Tone;
  label: string;
  icon: LucideIcon;
}

const STATUS_CONFIG: Record<CoreStatus, StatusConfig> = {
  registration_open: {
    tone: "success",
    label: "Registration open",
    icon: DoorOpen,
  },
  going: { tone: "success", label: "Going", icon: CircleCheck },
  checked_in: { tone: "success", label: "Checked in", icon: UserCheck },
  accepted: { tone: "info", label: "Accepted", icon: CircleAlert },
  pending: { tone: "warning", label: "Pending", icon: Hourglass },
  waitlisted: { tone: "warning", label: "Waitlisted", icon: Hourglass },
  full: { tone: "error", label: "Full", icon: Lock },
  not_selected: { tone: "neutral", label: "Not selected", icon: CircleMinus },
  past: { tone: "neutral", label: "Past", icon: History },
};

/** The student event-card labels (§3.3). A `date` completes "Opens" and "Register by". */
const STUDENT_STATUS_CONFIG: Record<
  StudentEventStatus,
  Omit<StatusConfig, "label"> & { label: (date?: string) => string }
> = {
  opens: {
    tone: "info",
    label: (date) => (date ? `Opens ${date}` : "Opens soon"),
    icon: CalendarDays,
  },
  registration_closed: {
    tone: "neutral",
    label: () => "Registration closed",
    icon: DoorClosed,
  },
  under_review: {
    tone: "warning",
    label: () => "Under review",
    icon: Hourglass,
  },
  register_by: {
    tone: "info",
    label: (date) => (date ? `Register by ${date}` : "Register now"),
    icon: CircleAlert,
  },
  offer_expired: {
    tone: "neutral",
    label: () => "Offer expired",
    icon: ClockAlert,
  },
};

/** The nine core statuses; the gallery lists these. */
export const STATUSES = Object.keys(STATUS_CONFIG) as CoreStatus[];
/** The student event-card statuses. */
export const STUDENT_EVENT_STATUSES = Object.keys(
  STUDENT_STATUS_CONFIG,
) as StudentEventStatus[];

function resolveStatus(status: Status, date?: string): StatusConfig {
  if (status in STUDENT_STATUS_CONFIG) {
    const { label, ...rest } = STUDENT_STATUS_CONFIG[status as StudentEventStatus];
    return { ...rest, label: label(date) };
  }
  return STATUS_CONFIG[status as CoreStatus];
}

export interface StatusBadgeProps
  extends Omit<BadgeProps, "variant" | "children"> {
  /** A named status. Leave out to give a fully custom `label` and `tone`. */
  status?: Status;
  /** The date for `opens` and `register_by`, already formatted ("Oct 20"). */
  date?: string;
  /** Replaces the status's label, or names a custom badge. */
  label?: string;
  /** Replaces the status's tone. Required with a custom `label` and no `status`. */
  tone?: Tone;
  /** Replaces the status's icon. A custom badge falls back to an info circle. */
  icon?: LucideIcon;
}

/** What a StatusBadge needs, without the DOM props: a status name, or a custom label and tone. */
export type StatusBadgeSpec = Pick<
  StatusBadgeProps,
  "status" | "date" | "label" | "tone" | "icon"
>;

/**
 * One state badge: an icon and a label, always (§2.10). Pass a `status`, or a
 * custom `label` and `tone` for states the list doesn't cover.
 */
function StatusBadge({
  status,
  date,
  label,
  tone,
  icon,
  ...props
}: StatusBadgeProps) {
  const base = status ? resolveStatus(status, date) : null;
  const text = label ?? base?.label;
  if (!text) return null;
  const Icon = icon ?? base?.icon ?? CircleAlert;
  return (
    <Badge variant={tone ?? base?.tone ?? "neutral"} {...props}>
      <Icon aria-hidden />
      {text}
    </Badge>
  );
}

export { StatusBadge };
