import type { ReactNode } from "react";
import { Calendar, Clock, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { QrCode } from "@/features/events/components/QrCode";
import type {
  TicketBadge,
  TicketEvent,
  TicketHolder,
} from "@/features/events/types";

export interface EventTicketProps {
  event: TicketEvent;
  holder: TicketHolder;
  /** Student-facing event badge. Defaults to `going`. */
  badge?: TicketBadge;
  /** Date in the "Register by Oct 20" badge, such as "Oct 20". */
  registerBy?: string | null;
  /**
   * The ticket's `qr_token`, drawn as the QR code. Shown only for `going` and
   * `checked_in`.
   */
  qrToken?: string | null;
  className?: string;
}

export function EventTicket({
  event,
  holder,
  badge = "going",
  registerBy,
  qrToken,
  className,
}: EventTicketProps) {
  const hasCode = badge === "going" || badge === "checked_in";

  return (
    <article
      aria-label={`Ticket for ${event.name}`}
      className={cn(
        "w-full max-w-sm overflow-hidden rounded-xl border bg-card text-card-foreground",
        className
      )}
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-h3">{event.name}</h2>
          <TicketStatusBadge badge={badge} registerBy={registerBy} />
        </div>
        <dl className="space-y-2 text-small">
          <TicketDetail icon={<Calendar />} label="Date">
            {event.date ?? "TBD"}
          </TicketDetail>
          {event.time && (
            <TicketDetail icon={<Clock />} label="Time">
              {event.time}
            </TicketDetail>
          )}
          <TicketDetail icon={<MapPin />} label="Location">
            {event.location ?? "TBD"}
          </TicketDetail>
        </dl>
      </div>

      <TicketPerforation />

      <div className="space-y-4 p-5">
        <div className="min-w-0">
          <p className="text-label text-muted-foreground">Ticket holder</p>
          <p className="truncate text-body-medium">{holder.name}</p>
          {holder.email && (
            <p className="truncate text-small text-muted-foreground">
              {holder.email}
            </p>
          )}
        </div>
        {hasCode && qrToken && <QrCode value={qrToken} label="Check-in QR code" />}
      </div>
    </article>
  );
}

/**
 * Ticket badges that are one of the design system's statuses. "Under review"
 * reads as "Pending". The rest are dated or one-off states with no status of
 * their own, so they render as a tag.
 */
const BADGE_STATUS: Partial<Record<TicketBadge, Status>> = {
  under_review: "pending",
  waitlisted: "waitlisted",
  not_selected: "not_selected",
  going: "going",
  checked_in: "checked_in",
};

const TAG_LABEL: Partial<Record<TicketBadge, string>> = {
  register_by: "Register by",
  offer_expired: "Offer expired",
};

function TicketStatusBadge({
  badge,
  registerBy,
}: {
  badge: TicketBadge;
  registerBy?: string | null;
}) {
  const status = BADGE_STATUS[badge];
  if (status) return <StatusBadge status={status} />;

  const label =
    badge === "register_by" && registerBy
      ? `Register by ${registerBy}`
      : TAG_LABEL[badge];

  return <Badge variant="tag">{label}</Badge>;
}

function TicketDetail({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <dt className="mt-0.5 text-muted-foreground [&_svg]:size-4">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function TicketPerforation() {
  return (
    <div aria-hidden className="relative">
      <div className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full border bg-background" />
      <div className="mx-5 border-t border-dashed" />
      <div className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full border bg-background" />
    </div>
  );
}
