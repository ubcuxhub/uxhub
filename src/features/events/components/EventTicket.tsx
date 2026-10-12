import type { ReactNode } from "react";
import { Calendar, Clock, MapPin, QrCode } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatEventTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import type {
  TicketEvent,
  TicketHolder,
  TicketStatus,
} from "@/features/events/types";

export interface EventTicketProps {
  event: TicketEvent;
  holder: TicketHolder;
  status?: TicketStatus;
  /** Most recent check-in, shown when `status` is `checked_in`. */
  checkedInAt?: string | null;
  className?: string;
}

export function EventTicket({
  event,
  holder,
  status = "valid",
  checkedInAt,
  className,
}: EventTicketProps) {
  const cancelled = status === "cancelled";

  return (
    <article
      aria-label={`Ticket for ${event.name}`}
      className={cn(
        "w-full max-w-sm overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      <div className={cn("space-y-4 p-5", cancelled && "opacity-60")}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-h3">{event.name}</h2>
          <TicketStatusBadge status={status} checkedInAt={checkedInAt} />
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
        <div className={cn("min-w-0", cancelled && "opacity-60")}>
          <p className="text-label text-muted-foreground">Ticket holder</p>
          <p className="truncate font-medium">{holder.name}</p>
          {holder.email && (
            <p className="truncate text-small text-muted-foreground">
              {holder.email}
            </p>
          )}
        </div>
        {cancelled ? (
          <p className="rounded-lg bg-muted p-4 text-center text-small text-muted-foreground">
            This ticket is no longer valid.
          </p>
        ) : (
          <QrPlaceholder />
        )}
      </div>
    </article>
  );
}

function TicketStatusBadge({
  status,
  checkedInAt,
}: {
  status: TicketStatus;
  checkedInAt?: string | null;
}) {
  if (status === "checked_in") {
    const time = formatEventTime(checkedInAt);
    return (
      <Badge
        variant="outline"
        className="shrink-0 border-transparent bg-success-bg text-success"
      >
        {time ? `Checked in ${time}` : "Checked in"}
      </Badge>
    );
  }

  if (status === "cancelled") {
    return (
      <Badge variant="secondary" className="shrink-0">
        Cancelled
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="shrink-0">
      Admit one
    </Badge>
  );
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

function QrPlaceholder() {
  return (
    <div
      role="img"
      aria-label="QR code placeholder"
      className="mx-auto flex size-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted text-muted-foreground"
    >
      <QrCode className="size-12" />
      <span className="text-label">QR code coming soon</span>
    </div>
  );
}
