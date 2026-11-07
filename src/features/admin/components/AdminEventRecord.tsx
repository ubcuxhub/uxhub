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
  useRecordMorphTypes,
} from "@/components/shared/RecordDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DateTimeField,
  type DateTimeValue,
} from "@/components/ui/date-time-field";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLabelRow,
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
import type { IsoDate, WallTime } from "@/lib/date-input";
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
import { isCompleteDateTime } from "./event-form/event-form-schema";
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

type MomentKey = Exclude<keyof ScheduleDraft, "status">;

/** A draft's `YYYY-MM-DDTHH:mm` as the field's two halves. */
function splitMoment(value: string): DateTimeValue {
  const [date = "", time = ""] = value.split("T");
  return {
    date: date ? (date as IsoDate) : null,
    time: time ? (time as WallTime) : null,
  };
}

/**
 * Back to `YYYY-MM-DDTHH:mm`, as the builder joins them: a half left empty
 * stays visible (`2026-11-19T`), so `incompleteDateProblem` can name it.
 */
function joinMoment({ date, time }: DateTimeValue): string {
  if (!date && !time) return "";
  return `${date ?? ""}T${time ?? ""}`;
}

/** Whether a complete `end` falls at or before a complete `start`, as the server checks. */
function endsTooEarly(start: string, end: string) {
  const from = datetimeLocalToTimestamptz(start);
  const to = datetimeLocalToTimestamptz(end);
  return Boolean(from && to && Date.parse(from) >= Date.parse(to));
}

/**
 * One moment in the quick edit: its label (with a Clear action when it's
 * optional and set), the date and time, then its help and error.
 */
function MomentField({
  id,
  label,
  dateLabel,
  timeLabel,
  value,
  onChange,
  onValidityChange,
  start,
  description,
  error,
  clearLabel,
}: {
  id: string;
  label: string;
  dateLabel: string;
  timeLabel: string;
  value: string;
  onChange: (value: string) => void;
  onValidityChange: (error: string | null) => void;
  /** The moment this one must come after: its date is the earliest, and on that day its time leads. */
  start?: string;
  description?: React.ReactNode;
  error?: string | null;
  /** Shows a Clear action, named this, while the value is set. */
  clearLabel?: string;
}) {
  const parts = splitMoment(value);
  const from = start ? splitMoment(start) : null;
  const sameDay = Boolean(from?.date && from.date === parts.date);
  return (
    <Field aria-labelledby={`${id}-label`} data-invalid={error ? true : undefined}>
      <FieldLabelRow
        action={
          clearLabel && value ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              aria-label={clearLabel}
              onClick={() => onChange("")}
            >
              Clear
            </Button>
          ) : null
        }
      >
        <FieldLabel id={`${id}-label`} htmlFor={id}>
          {label}
        </FieldLabel>
      </FieldLabelRow>
      <DateTimeField
        id={id}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        value={parts}
        onValueChange={(next) => onChange(joinMoment(next))}
        onValidityChange={onValidityChange}
        min={from?.date ?? undefined}
        after={sameDay ? (from?.time ?? undefined) : undefined}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
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
  // What each date and time field reports about its own text ("Use a real date").
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<MomentKey, string>>>({});
  const editing = draft !== null;
  const dirty = draft !== null && !sameDraft(draft, draftFrom(event));

  const base = `/admin/events/${event.id}`;
  // "Edit event" grows the drawer into the builder, as expand does.
  const expandTypes = useRecordMorphTypes("expand");
  const registration = registrationWindow(event, new Date(now));

  const startEditing = () => {
    setError(null);
    setFieldErrors({});
    setDraft(draftFrom(event));
  };

  const cancel = () => {
    setDraft(null);
    setError(null);
    setFieldErrors({});
  };

  const reportField = (field: MomentKey) => (problem: string | null) =>
    setFieldErrors((current) => {
      if ((current[field] ?? null) === problem) return current;
      const next = { ...current };
      if (problem) next[field] = problem;
      else delete next[field];
      return next;
    });

  const update = <K extends keyof ScheduleDraft>(field: K, value: ScheduleDraft[K]) => {
    setError(null);
    // The publish field goes with the draft status, and so does what it reported.
    if (field === "status" && value !== "draft") reportField("publish_at")(null);
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
    // Text a field couldn't read would save as the value it last held.
    if (Object.keys(fieldErrors).length > 0) {
      setError("Fix the dates and times marked above.");
      return;
    }
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
  const momentError = (field: MomentKey) => {
    if (!draft) return null;
    if (fieldErrors[field]) return fieldErrors[field];
    if (field === "ends_at" && endsTooEarly(draft.starts_at, draft.ends_at)) {
      return "Event end time must be after the start time.";
    }
    if (
      field === "registration_closes_at" &&
      endsTooEarly(draft.registration_opens_at, draft.registration_closes_at)
    ) {
      return "Registration end time must be after the start time.";
    }
    return null;
  };

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
          <Link href={`${base}/edit`} transitionTypes={expandTypes}>
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
              // Locked while saving: the save sends the values as they were
              // when it started, and closes the editor when it finishes.
              <fieldset disabled={saving} className="flex min-w-0 flex-col gap-5 pt-2">
                <p className="text-small text-muted-foreground">All times are Pacific.</p>
                <Field>
                  <FieldLabel htmlFor={`${ids}-status`}>Status</FieldLabel>
                  <Select
                    value={draft.status}
                    disabled={saving}
                    onValueChange={(value) => update("status", value as EventStatus)}
                  >
                    <SelectTrigger id={`${ids}-status`} className="w-full">
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
                {draft.status === "draft" ? (
                  <MomentField
                    id={`${ids}-publish`}
                    label="Publishes"
                    dateLabel="Publish date"
                    timeLabel="Publish time"
                    value={draft.publish_at}
                    onChange={(value) => update("publish_at", value)}
                    onValidityChange={reportField("publish_at")}
                    description="Draft events become Active at this time. Leave empty to keep in Draft."
                    error={momentError("publish_at")}
                    clearLabel="Clear publish date"
                  />
                ) : null}
                <MomentField
                  id={`${ids}-starts`}
                  label="Starts"
                  dateLabel="Start date"
                  timeLabel="Start time"
                  value={draft.starts_at}
                  onChange={(value) => update("starts_at", value)}
                  onValidityChange={reportField("starts_at")}
                  error={momentError("starts_at")}
                />
                <MomentField
                  id={`${ids}-ends`}
                  label="Ends"
                  dateLabel="End date"
                  timeLabel="End time"
                  value={draft.ends_at}
                  onChange={(value) => update("ends_at", value)}
                  onValidityChange={reportField("ends_at")}
                  start={draft.starts_at}
                  error={momentError("ends_at")}
                />
                <MomentField
                  id={`${ids}-opens`}
                  label="Registration opens"
                  dateLabel="Registration opening date"
                  timeLabel="Registration opening time"
                  value={draft.registration_opens_at}
                  onChange={(value) => update("registration_opens_at", value)}
                  onValidityChange={reportField("registration_opens_at")}
                  error={momentError("registration_opens_at")}
                  clearLabel="Clear registration opens"
                />
                <MomentField
                  id={`${ids}-closes`}
                  label="Registration closes"
                  dateLabel="Registration closing date"
                  timeLabel="Registration closing time"
                  value={draft.registration_closes_at}
                  onChange={(value) => update("registration_closes_at", value)}
                  onValidityChange={reportField("registration_closes_at")}
                  start={draft.registration_opens_at}
                  error={momentError("registration_closes_at")}
                  clearLabel="Clear registration closes"
                />
              </fieldset>
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
