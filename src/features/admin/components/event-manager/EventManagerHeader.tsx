import Link from "next/link";
import { ExternalLink, Pencil, Scan } from "lucide-react";

import { BackButton } from "@/components/shared/BackButton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TabNav, TabNavLink } from "@/components/ui/tab-nav";
import { formatEventDateTimeRange } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";
import { checkInPath } from "../../lib/item-check-in";
import type { EventManagerTabLink } from "../../lib/event-manager";
import { eventMarketingHref } from "../../lib/event-presentation";
import { EventStatusBadge } from "../EventStatusBadge";

/** The column every manager tab's `PageContainer` uses, so the header lines up with them. */
export const EVENT_MANAGER_COLUMN = "mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-16";

export interface EventManagerHeaderProps {
  event: EventRow;
  tabs: EventManagerTabLink[];
  /** Whether the public event pages are live (the student events flag). */
  publicPages: boolean;
  /** Pins the active tab, for the dev gallery and tests. Defaults to the current path. */
  pathname?: string;
}

/**
 * The event manager's header: back to the list, the event's name and status,
 * its actions (the public page, the builder, the scanner), and the tabs.
 * Each tab's page renders below it in its own `PageContainer`.
 */
export function EventManagerHeader({ event, tabs, publicPages, pathname }: EventManagerHeaderProps) {
  const liveHref = eventMarketingHref(event, publicPages);
  const when = formatEventDateTimeRange(event.starts_at, event.ends_at);
  const where = [event.location_building, event.location_room].filter(Boolean).join(" ");
  const subtitle = [when, where].filter(Boolean).join(" · ");

  return (
    <header className={`${EVENT_MANAGER_COLUMN} flex flex-col gap-6 pt-8 sm:pt-10`}>
      <BackButton link="/admin/events" label="Back to Manage Events" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="min-w-0 text-h1 tracking-tight break-words">{event.name}</h1>
            <EventStatusBadge status={event.status} publishAt={event.publish_at} />
            {event.canceled_at ? <StatusBadge status="canceled" /> : null}
          </div>
          {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {liveHref ? (
            <Button asChild variant="secondary">
              <a href={liveHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                {event.status === "draft" ? "Preview site" : "View live site"}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href={`/admin/events/${event.id}/edit`}>
              <Pencil aria-hidden />
              Edit event
            </Link>
          </Button>
          <Button asChild>
            <Link href={checkInPath(event.id, null, true, `/admin/events/${event.id}/overview`)}>
              <Scan aria-hidden />
              Scan tickets
            </Link>
          </Button>
        </div>
      </div>
      <TabNav aria-label="Event pages" pathname={pathname} className="-mx-1">
        {tabs.map((tab) => (
          <TabNavLink key={tab.href} href={tab.href} count={tab.count}>
            {tab.label}
          </TabNavLink>
        ))}
      </TabNav>
    </header>
  );
}
