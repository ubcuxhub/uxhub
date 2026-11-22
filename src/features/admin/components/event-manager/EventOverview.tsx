"use client";

import Link from "next/link";
import { CalendarClock, CircleAlert, CircleCheck } from "lucide-react";

import { DetailList, DetailRow } from "@/components/shared/DetailRow";
import { PageContainer } from "@/components/shared/PageContainer";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatTimestamp } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";
import type { EventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import type { NeedsActionItem } from "../../lib/event-needs-action";
import { EventRegistrationsCard } from "../EventRegistrationsCard";
import { EventScheduleSection, useEventScheduleEditor } from "../EventScheduleEditor";

export interface EventOverviewRegistration {
  /** The ticket's id. */
  id: string;
  name: string;
}

export interface EventOverviewProps {
  event: EventRow;
  /** Tickets, and the seats nobody holds (`null` without a capacity). */
  seats: { tickets: number; seatsLeft: number | null };
  /** Ticket holders checked in to at least one agenda item. */
  checkedIn: number;
  /** Applications by status, for an event that takes them; null otherwise. */
  applications: EventApplicationStatusCounts | null;
  /** Ticket holders, newest first. */
  registrations: EventOverviewRegistration[];
  needsAction: NeedsActionItem[];
  /** When the server rendered this, so dates read the same on both sides. */
  now: string;
}

const plural = (value: number, one: string, many: string) =>
  `${value} ${value === 1 ? one : many}`;

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

function formatPrice(value: number | null) {
  if (value === null) return null;
  return Number(value) === 0 ? "Free" : currency.format(Number(value));
}

/** "Free", or "$15.00 · $10.00 for members". */
function describePrice(event: Pick<EventRow, "regular_price" | "member_price">) {
  const regular = formatPrice(event.regular_price);
  const member = formatPrice(event.member_price);
  if (!regular) return "Not set";
  if (!member || member === regular) return regular;
  return `${regular} · ${member} for members`;
}

function NeedsActionRow({ item, eventId }: { item: NeedsActionItem; eventId: string }) {
  const Icon = item.type === "todo" ? CircleAlert : CalendarClock;
  let title: string;
  let description: string | null = null;
  let action: React.ReactNode = null;
  switch (item.kind) {
    case "refund":
      title = `${plural(item.count, "paid ticket", "paid tickets")} to refund`;
      description = "The event is canceled. Issue refunds in Square; canceling doesn’t refund anyone.";
      break;
    case "review":
      title = `${plural(item.count, "application", "applications")} waiting for review`;
      action = (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/admin/events/${eventId}/review-applications`}>Review</Link>
        </Button>
      );
      break;
    case "decisions-release":
      title = `Decisions release ${formatTimestamp(item.at)}`;
      description = "Applicants see their decisions then.";
      break;
    case "registration-closes":
      title = `Registration closes ${formatTimestamp(item.at)}`;
      break;
  }
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-medium">{title}</p>
        {description ? <p className="text-small text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </li>
  );
}

function NeedsActionCard({ items, eventId }: { items: NeedsActionItem[]; eventId: string }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2>Needs action</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="flex items-center gap-3 text-muted-foreground">
            <CircleCheck aria-hidden className="size-5 shrink-0" />
            Nothing needs action
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {items.map((item) => (
              <NeedsActionRow key={item.kind} item={item} eventId={eventId} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RegistrationsListCard({ registrations }: { registrations: EventOverviewRegistration[] }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2>Registrations</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {registrations.length === 0 ? (
          <EmptyState
            size="inline"
            title="No registrations yet"
            description="People who register show up here, newest first."
          />
        ) : (
          // Its own scroll, so a long list doesn't push the rest of the page down.
          <ul
            aria-label="Registrations, newest first"
            tabIndex={0}
            className="-mx-2 flex max-h-96 flex-col overflow-y-auto rounded-md px-2 focus-visible:focus-ring"
          >
            {registrations.map((registration) => (
              <li
                key={registration.id}
                className="flex min-w-0 items-center gap-3 border-b border-border-subtle py-2.5 last:border-b-0"
              >
                <Avatar name={registration.name} size={32} decorative />
                <span className="min-w-0 flex-1 text-body-medium [overflow-wrap:anywhere]">
                  {registration.name}
                </span>
                <StatusBadge status="going" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EventDetailsCard({ event: loaded, now }: { event: EventRow; now: string }) {
  const schedule = useEventScheduleEditor(loaded);
  const { event } = schedule;
  const location = [event.location_building, event.location_room].filter(Boolean).join(", ");
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <h2>Event details</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(submit) => {
            submit.preventDefault();
            if (schedule.editing && !schedule.saving) void schedule.save();
          }}
        >
          <DetailList>
            <DetailRow label="Registration">
              {event.requires_application ? "Application required" : "Open registration"}
            </DetailRow>
            <DetailRow label="Location">{location || null}</DetailRow>
            <DetailRow label="Price">{describePrice(event)}</DetailRow>
          </DetailList>
          <EventScheduleSection editor={schedule} now={now} />
          {schedule.editing ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {schedule.error ? (
                <p role="alert" className="basis-full text-small text-destructive">
                  {schedule.error}
                </p>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                disabled={schedule.saving}
                onClick={schedule.cancel}
              >
                Cancel
              </Button>
              <Button type="submit" loading={schedule.saving}>
                Save schedule
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * The event manager's Overview tab: what needs doing and who's coming on the
 * left; the registration numbers and the event's details, with the quick edit
 * of its status and schedule, on the right.
 */
export function EventOverview({
  event,
  seats,
  checkedIn,
  applications,
  registrations,
  needsAction,
  now,
}: EventOverviewProps) {
  return (
    <PageContainer>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <NeedsActionCard items={needsAction} eventId={event.id} />
          <RegistrationsListCard registrations={registrations} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <EventRegistrationsCard
            eventId={event.id}
            capacity={event.max_capacity}
            tickets={seats.tickets}
            seatsLeft={seats.seatsLeft}
            checkedIn={checkedIn}
            applications={event.requires_application ? applications : null}
          />
          <EventDetailsCard event={event} now={now} />
        </div>
      </div>
    </PageContainer>
  );
}
