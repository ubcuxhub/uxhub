import * as React from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleMinus,
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
export type Status =
  | "registration_open"
  | "going"
  | "checked_in"
  | "accepted"
  | "pending"
  | "waitlisted"
  | "full"
  | "not_selected"
  | "past";

type Tone = NonNullable<BadgeProps["variant"]>;

const STATUS_CONFIG: Record<
  Status,
  { tone: Tone; label: string; icon: LucideIcon }
> = {
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

export const STATUSES = Object.keys(STATUS_CONFIG) as Status[];

export interface StatusBadgeProps
  extends Omit<BadgeProps, "variant" | "children"> {
  status: Status;
}

function StatusBadge({ status, ...props }: StatusBadgeProps) {
  const { tone, label, icon: Icon } = STATUS_CONFIG[status];
  return (
    <Badge variant={tone} {...props}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}

export { StatusBadge };
