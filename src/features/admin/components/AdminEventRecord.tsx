"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX, ClipboardList, ExternalLink, Pencil, QrCode } from "lucide-react";

import { CopyCode } from "@/components/shared/CopyCode";
import {
  RecordField,
  RecordSection,
  RecordThumbnail,
  RecordView,
  useRecordMorphTypes,
} from "@/components/shared/RecordDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatEventDateTimeRange, formatTimestamp } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";
import type { EventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import { registrationWindow } from "../lib/event-registration-window";
import { eventManagerHref } from "../lib/event-manager";
import { EventStatusBadge } from "./EventStatusBadge";
import { CancelEventDialog } from "./CancelEventDialog";
import {
  EventScheduleSection,
  RegistrationBadge,
  hasEnded,
  useEventScheduleEditor,
} from "./EventScheduleEditor";
import { eventMarketingHref } from "../lib/event-presentation";

export interface AdminEventRecordProps {
  event: EventRow;
  seats: { tickets: number; seatsLeft: number };
  applications: EventApplicationStatusCounts;
  /** When the server rendered this, so the registration window reads the same on both sides. */
  now: string;
  /** Whether the public event pages are live (the student events flag). */
  publicPages: boolean;
}

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

function formatPrice(value: number | null) {
  if (value === null) return "Not set";
  return Number(value) === 0 ? "Free" : currency.format(Number(value));
}

/**
 * An event's admin overview, in the drawer over Manage events: who's
 * coming, the links to run the event, its details, and a quick edit of its
 * status and dates. "Edit event" opens the builder (`/edit`) for the rest.
 */
export function AdminEventRecord({
  event: loaded,
  seats,
  applications,
  now,
  publicPages,
}: AdminEventRecordProps) {
  const router = useRouter();
  const schedule = useEventScheduleEditor(loaded);
  const { event, editing } = schedule;
  const [canceling, setCanceling] = useState(false);
  // Canceled for good, or over: the drawer shows the record but edits nothing.
  const canceled = event.canceled_at !== null;
  const ended = event.status === "active" && hasEnded(event, new Date(now));

  const base = `/admin/events/${event.id}`;
  // "Edit event" grows the drawer into the builder, as expand does.
  const expandTypes = useRecordMorphTypes("expand");
  const registration = registrationWindow(event, new Date(now));

  return (
    <RecordView
      title={event.name}
      subtitle={formatEventDateTimeRange(event.starts_at, event.ends_at) ?? "No date set"}
      media={<RecordThumbnail src={event.image_url} />}
      status={
        <>
          <EventStatusBadge status={event.status} publishAt={event.publish_at} />
          {canceled ? (
            <StatusBadge status="canceled" />
          ) : (
            <RegistrationBadge state={registration} opensAt={event.registration_opens_at} />
          )}
        </>
      }
      fullPageHref={eventManagerHref(event.id)}
      actions={
        <>
        <Button asChild variant="secondary" size="sm">
          <Link href={`${base}/edit`} transitionTypes={expandTypes}>
            <Pencil aria-hidden />
            Edit event
          </Link>
        </Button>
        {eventMarketingHref(event, publicPages) && <Button asChild variant="outline" size="sm"><a href={eventMarketingHref(event, publicPages)!} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden />View marketing page<span className="sr-only"> (opens in a new tab)</span></a></Button>}
        </>
      }
      editing={editing}
      dirty={schedule.dirty}
      saving={schedule.saving}
      error={schedule.error}
      onCancel={schedule.cancel}
      onSave={() => void schedule.save()}
      saveLabel="Save schedule"
      details={
        <>
          <RecordSection title="At a glance" kind="content" className="gap-4">
            <div
              className={
                event.requires_application
                  ? "grid gap-3 sm:grid-cols-3"
                  : "grid gap-3 sm:grid-cols-2"
              }
            >
              <StatCard
                kind="rate"
                label="Registered"
                count={seats.tickets}
                total={event.max_capacity ?? 0}
                noun="seats"
              />
              {event.max_capacity == null ? <StatCard kind="insufficient" label="Seats left" reason="Capacity is not set" /> : <StatCard kind="value" label="Seats left" value={Math.max(0, seats.seatsLeft)} />}
              {event.requires_application ? (
                <StatCard kind="value" label="Applications" value={applications.total} />
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm"><Link href={`${base}/agenda`}><ClipboardList aria-hidden />Agenda</Link></Button>
              <Button asChild variant="secondary" size="sm">
                <Link href={`${base}/check-in?returnTo=${encodeURIComponent(base)}`}>
                  <QrCode aria-hidden />
                  Check-in
                </Link>
              </Button>
              {event.requires_application ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`${base}/review-applications`}>
                    <ClipboardList aria-hidden />
                    Review applications
                    {applications.submitted > 0 ? (
                      <Badge variant="warning" className="tabular-nums">
                        {applications.submitted}
                        <span className="sr-only"> to review</span>
                      </Badge>
                    ) : null}
                  </Link>
                </Button>
              ) : null}
            </div>
          </RecordSection>

          <EventScheduleSection editor={schedule} now={now} />

          {canceled ? (
            <RecordSection title="Canceled">
              <RecordField label="Canceled" value={formatTimestamp(event.canceled_at)} />
              <RecordField label="Note to attendees" value={event.cancellation_note ?? "No note"} />
              <RecordField label="Refunds" value="Issue refunds in Square" />
            </RecordSection>
          ) : event.status === "active" && !ended ? (
            <RecordSection
              title="Cancel event"
              kind="content"
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={editing}
                  onClick={() => setCanceling(true)}
                >
                  <CalendarX aria-hidden />
                  Cancel event
                </Button>
              }
            >
              <p className="text-small text-muted-foreground">
                For an event that won’t happen. Ticket holders keep it in their portal, marked canceled. It can’t be undone, and refunds are issued in Square.
              </p>
            </RecordSection>
          ) : null}

          <CancelEventDialog
            eventId={event.id}
            eventName={event.name}
            open={canceling}
            onOpenChange={setCanceling}
            onCanceled={(row) => {
              schedule.showSaved(row);
              setCanceling(false);
              router.refresh();
            }}
          />

          <RecordSection title="Venue">
            <RecordField label="Building" value={event.location_building} />
            <RecordField label="Room" value={event.location_room} />
            <RecordField
              label="Map link"
              value={
                event.location_address_url ? (
                  <a
                    href={event.location_address_url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-primary underline-offset-4 hover:underline"
                  >
                    {event.location_address_url}
                  </a>
                ) : null
              }
            />
          </RecordSection>

          <RecordSection title="Tickets">
            <RecordField label="Regular price" value={formatPrice(event.regular_price)} />
            <RecordField label="Member price" value={formatPrice(event.member_price)} />
            <RecordField label="Capacity" value={event.max_capacity == null ? "Not set" : `${event.max_capacity} seats`} />
            <RecordField
              label="Event type"
              value={event.event_type === "flagship" ? "Flagship" : "Regular"}
            />
            <RecordField
              label="Applications"
              value={event.requires_application ? "Required to register" : "Not required"}
            />
          </RecordSection>

          <RecordSection title="Record">
            <RecordField label="Slug" value={<CopyCode code={event.slug} label="Copy slug" />} />
            <RecordField label="Event ID" value={<CopyCode code={event.id} label="Copy event ID" />} />
            <RecordField label="Created" value={formatTimestamp(event.created_at)} />
            <RecordField label="Updated" value={formatTimestamp(event.updated_at)} />
          </RecordSection>
        </>
      }
    />
  );
}
