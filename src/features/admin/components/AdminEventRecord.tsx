"use client";

import Link from "next/link";
import { ClipboardList, ExternalLink, Pencil, QrCode } from "lucide-react";

import { CopyCode } from "@/components/shared/CopyCode";
import {
  RecordField,
  RecordSection,
  RecordView,
} from "@/components/shared/RecordDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatEventDate,
  formatEventDateTimeRange,
  formatTimestamp,
} from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";
import type { EventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import {
  registrationWindow,
  type RegistrationWindow,
} from "../lib/event-registration-window";
import { EventStatusBadge } from "./EventStatusBadge";

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

function formatPrice(value: number) {
  return Number(value) === 0 ? "Free" : currency.format(Number(value));
}

function RegistrationBadge({
  state,
  opensAt,
}: {
  state: RegistrationWindow;
  opensAt: string | null;
}) {
  // TODO(#244): use eventBadgeFor() once it lands, so this can also say Full
  // and Past the way the student pages do.
  switch (state) {
    case "open":
      return <StatusBadge status="registration_open" />;
    case "upcoming":
      return (
        <StatusBadge
          status="opens"
          date={formatEventDate(opensAt, { month: "short", year: undefined }) ?? undefined}
        />
      );
    case "closed":
      return <StatusBadge status="registration_closed" />;
    default:
      return null;
  }
}

/**
 * An event's admin overview, in the record drawer or on its own page: who's
 * coming, the links to run the event, and its details. It's edited in the
 * builder (`/edit`).
 */
export function AdminEventRecord({
  event,
  seats,
  applications,
  now,
  publicPages,
}: AdminEventRecordProps) {
  const base = `/admin/events/${event.id}`;
  const registration = registrationWindow(event, new Date(now));

  return (
    <RecordView
      recordHref={base}
      title={event.name}
      subtitle={formatEventDateTimeRange(event.starts_at, event.ends_at) ?? "No date set"}
      cover={
        event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage URLs, as on EventCard
          <img
            src={event.image_url}
            alt=""
            className="aspect-video w-full bg-muted object-cover"
          />
        ) : undefined
      }
      status={
        <>
          <EventStatusBadge status={event.status} publishAt={event.publish_at} />
          <RegistrationBadge state={registration} opensAt={event.registration_opens_at} />
        </>
      }
      actions={
        <Button asChild variant="secondary" size="sm">
          <Link href={`${base}/edit`}>
            <Pencil aria-hidden />
            Edit event
          </Link>
        </Button>
      }
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
                total={event.max_capacity}
                noun="seats"
              />
              <StatCard kind="value" label="Seats left" value={Math.max(0, seats.seatsLeft)} />
              {event.requires_application ? (
                <StatCard kind="value" label="Applications" value={applications.total} />
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href={`${base}/check-in`}>
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
              {publicPages && event.status === "active" ? (
                <Button asChild variant="ghost" size="sm">
                  <a href={`/events/${event.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden />
                    View public page
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </Button>
              ) : null}
            </div>
          </RecordSection>

          <RecordSection title="Status and schedule">
            <RecordField
              label="Status"
              value={<EventStatusBadge status={event.status} publishAt={event.publish_at} />}
            />
            {event.status === "draft" ? (
              <RecordField
                label="Publishes"
                value={formatTimestamp(event.publish_at) ?? "When you set it to Active"}
              />
            ) : null}
            <RecordField label="Starts" value={formatTimestamp(event.starts_at)} />
            <RecordField label="Ends" value={formatTimestamp(event.ends_at)} />
            <RecordField
              label="Registration"
              value={
                registration === "not-applicable" ? (
                  "Opens once the event is active"
                ) : (
                  <RegistrationBadge state={registration} opensAt={event.registration_opens_at} />
                )
              }
            />
            <RecordField
              label="Registration opens"
              value={formatTimestamp(event.registration_opens_at) ?? "As soon as it’s active"}
            />
            <RecordField
              label="Registration closes"
              value={formatTimestamp(event.registration_closes_at) ?? "No closing date"}
            />
          </RecordSection>

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
            <RecordField label="Capacity" value={`${event.max_capacity} seats`} />
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
