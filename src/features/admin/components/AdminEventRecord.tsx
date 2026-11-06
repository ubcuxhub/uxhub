"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, ExternalLink, Pencil, QrCode } from "lucide-react";

import { CopyCode } from "@/components/shared/CopyCode";
import {
  RecordField,
  RecordSection,
  RecordView,
} from "@/components/shared/RecordDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  datetimeLocalToTimestamptz,
  formatEventDate,
  formatEventDateTimeRange,
  formatTimestamp,
  timestamptzToDatetimeLocal,
} from "@/lib/date";
import type { EventRow, EventStatus } from "@/lib/supabase/models";
import type { EventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import { updateEventScheduleAction } from "../event-overview-actions";
import {
  eventScheduleProblem,
  type EventScheduleInput,
} from "../lib/event-publication";
import {
  registrationWindow,
  type RegistrationWindow,
} from "../lib/event-registration-window";
import { EventSchedule } from "./event-form/EventSchedule";
import { isCompleteDateTime } from "./event-form/event-form-schema";
import { PublicationPicker } from "./event-form/PublicationPicker";
import { RegistrationTimes } from "./event-form/RegistrationTimes";
import { EventStatusBadge, EVENT_STATUS_LABELS } from "./EventStatusBadge";

export interface AdminEventRecordProps {
  event: EventRow;
  seats: { tickets: number; seatsLeft: number };
  applications: EventApplicationStatusCounts;
  /** When the server rendered this, so the registration window reads the same on both sides. */
  now: string;
  /** Whether the public event pages are live (the student events flag). */
  publicPages: boolean;
}

/** The quick edit's fields, as the builder's Pacific `YYYY-MM-DDTHH:mm` strings. */
interface ScheduleDraft {
  status: EventStatus;
  publish_at: string;
  starts_at: string;
  ends_at: string;
  registration_opens_at: string;
  registration_closes_at: string;
}

function draftFrom(event: EventRow): ScheduleDraft {
  return {
    status: event.status,
    publish_at: timestamptzToDatetimeLocal(event.publish_at),
    starts_at: timestamptzToDatetimeLocal(event.starts_at),
    ends_at: timestamptzToDatetimeLocal(event.ends_at),
    registration_opens_at: timestamptzToDatetimeLocal(event.registration_opens_at),
    registration_closes_at: timestamptzToDatetimeLocal(event.registration_closes_at),
  };
}

function sameDraft(a: ScheduleDraft, b: ScheduleDraft) {
  return (Object.keys(a) as (keyof ScheduleDraft)[]).every((key) => a[key] === b[key]);
}

/**
 * A field the pickers left half filled (a date without a time) reads as empty
 * once converted, so it's caught here, before the conversion hides it.
 */
function incompleteDateProblem(draft: ScheduleDraft): string | null {
  if (!isCompleteDateTime(draft.starts_at) || !isCompleteDateTime(draft.ends_at)) {
    return "Event start and end dates and times are required.";
  }
  if (
    [draft.registration_opens_at, draft.registration_closes_at].some(
      (value) => value && !isCompleteDateTime(value)
    )
  ) {
    return "Registration dates require both a date and time.";
  }
  if (draft.status === "draft" && draft.publish_at && !isCompleteDateTime(draft.publish_at)) {
    return "Publish date must be a valid date and time in Pacific time.";
  }
  return null;
}

function toInput(draft: ScheduleDraft): EventScheduleInput {
  return {
    status: draft.status,
    publish_at:
      draft.status === "draft" ? datetimeLocalToTimestamptz(draft.publish_at) : null,
    starts_at: datetimeLocalToTimestamptz(draft.starts_at),
    ends_at: datetimeLocalToTimestamptz(draft.ends_at),
    registration_opens_at: datetimeLocalToTimestamptz(draft.registration_opens_at),
    registration_closes_at: datetimeLocalToTimestamptz(draft.registration_closes_at),
  };
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
  const ids = useId();
  // The row the last save returned, shown until the revalidated props arrive.
  const [saved, setSaved] = useState<{ from: EventRow; row: EventRow } | null>(null);
  const event = saved && saved.from === loaded ? saved.row : loaded;

  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = draft !== null;
  const dirty = draft !== null && !sameDraft(draft, draftFrom(event));

  const base = `/admin/events/${event.id}`;
  const registration = registrationWindow(event, new Date(now));

  const startEditing = () => {
    setError(null);
    setDraft(draftFrom(event));
  };

  const cancel = () => {
    setDraft(null);
    setError(null);
  };

  const update = <K extends keyof ScheduleDraft>(field: K, value: ScheduleDraft[K]) => {
    setError(null);
    setDraft((current) =>
      current
        ? {
            ...current,
            [field]: value,
            // Only a draft has a publish date, as in the builder.
            ...(field === "status" && value !== "draft" ? { publish_at: "" } : {}),
          }
        : current
    );
  };

  const save = async () => {
    if (!draft) return;
    const input = toInput(draft);
    const problem = incompleteDateProblem(draft) ?? eventScheduleProblem(input);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updateEventScheduleAction(event.id, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved({ from: loaded, row: result.event });
      setDraft(null);
      router.refresh();
    } catch {
      setError("Couldn’t save the schedule. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const publishingNow = draft !== null && event.status === "draft" && draft.status === "active";

  return (
    <RecordView
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
      fullPageHref={`${base}/edit`}
      actions={
        <Button asChild variant="secondary" size="sm">
          <Link href={`${base}/edit`}>
            <Pencil aria-hidden />
            Edit event
          </Link>
        </Button>
      }
      editing={editing}
      dirty={dirty}
      saving={saving}
      error={error}
      onCancel={cancel}
      onSave={save}
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

          <RecordSection
            title="Status and schedule"
            kind={editing ? "content" : "fields"}
            action={
              editing ? null : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={startEditing}
                  aria-label="Change status and schedule"
                >
                  <Pencil aria-hidden />
                  Change
                </Button>
              )
            }
          >
            {draft ? (
              <FieldGroup className="gap-6 pt-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`${ids}-status`}>Event Status</FieldLabel>
                    <Select
                      value={draft.status}
                      disabled={saving}
                      onValueChange={(value) => update("status", value as EventStatus)}
                    >
                      <SelectTrigger id={`${ids}-status`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="draft">{EVENT_STATUS_LABELS.draft}</SelectItem>
                          <SelectItem value="active">{EVENT_STATUS_LABELS.active}</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {publishingNow ? (
                      <FieldDescription>
                        Students can see the event as soon as you save.
                      </FieldDescription>
                    ) : null}
                  </Field>
                  <PublicationPicker
                    value={draft.publish_at}
                    disabled={saving || draft.status !== "draft"}
                    onChange={(value) => update("publish_at", value)}
                  />
                </div>
                <EventSchedule
                  starts_at={draft.starts_at}
                  ends_at={draft.ends_at}
                  onFieldChange={update}
                />
                <RegistrationTimes
                  registration_opens_at={draft.registration_opens_at}
                  registration_closes_at={draft.registration_closes_at}
                  onFieldChange={update}
                />
              </FieldGroup>
            ) : (
              <>
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
              </>
            )}
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
