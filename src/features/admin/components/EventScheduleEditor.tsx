"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { RecordField, RecordSection } from "@/components/shared/RecordDrawer";
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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  datetimeLocalToTimestamptz,
  formatEventDate,
  formatTimestamp,
  timestamptzToDatetimeLocal,
} from "@/lib/date";
import type { IsoDate, WallTime } from "@/lib/date-input";
import type { EventRow, EventStatus } from "@/lib/supabase/models";
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
import { EventUnpublishDialog } from "./EventUnpublishDialog";

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
  if ([draft.starts_at, draft.ends_at].some(value => value && !isCompleteDateTime(value)) || ((draft.status === "active" || draft.publish_at) && (!isCompleteDateTime(draft.starts_at) || !isCompleteDateTime(draft.ends_at)))) {
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

export function RegistrationBadge({
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
 * The quick edit of an event's status and registration schedule, shared by
 * the event manager's Overview (the record drawer shows it read-only). Holds the draft, saves
 * it through `updateEventScheduleAction`, and shows the saved row until the
 * refreshed props arrive. Render it with `EventScheduleSection`; the caller
 * places the Cancel / Save buttons (`cancel`, `save`).
 */
export function useEventScheduleEditor(loaded: EventRow) {
  const router = useRouter();
  // The row the last save returned, shown until the revalidated props arrive.
  const [saved, setSaved] = useState<{ from: EventRow; row: EventRow } | null>(null);
  const event = saved && saved.from === loaded ? saved.row : loaded;

  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingOperation = useRef<{ key: string; id: string } | null>(null);
  const editRevision = useRef(event.revision);
  // What each date and time field reports about its own text ("Use a real date").
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<MomentKey, string>>>({});
  const [unpublishing, setUnpublishing] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | null>(null);

  const startEditing = () => {
    editRevision.current = event.revision;
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

  const commit = async (input: EventScheduleInput) => {
    setSaving(true);
    setError(null);
    const key = JSON.stringify([event.id, editRevision.current, input]);
    if (pendingOperation.current?.key !== key) pendingOperation.current = { key, id: crypto.randomUUID() };
    try {
      const result = await updateEventScheduleAction(event.id, { ...input, operationId: pendingOperation.current.id, expectedRevision: editRevision.current });
      if (!result.ok) {
        setError(result.error);
        if (unpublishing) setUnpublishError(result.error);
        return;
      }
      setSaved({ from: loaded, row: result.event });
      pendingOperation.current = null;
      setDraft(null);
      setUnpublishing(false);
      router.refresh();
    } catch {
      setError("Couldn’t save the schedule. Try again.");
      if (unpublishing) setUnpublishError("Couldn’t save the schedule. Try again.");
    } finally {
      setSaving(false);
    }
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
    // Active → Draft hides the event from members: confirm it first.
    if (event.status === "active" && input.status === "draft") {
      setUnpublishError(null);
      setUnpublishing(true);
      return;
    }
    await commit(input);
  };

  const momentError = (field: MomentKey) => {
    if (!draft) return null;
    if (fieldErrors[field]) return fieldErrors[field];
    if (
      field === "registration_closes_at" &&
      endsTooEarly(draft.registration_opens_at, draft.registration_closes_at)
    ) {
      return "Registration end time must be after the start time.";
    }
    return null;
  };

  return {
    /** The event as last saved here, or as loaded. */
    event,
    draft,
    editing: draft !== null,
    dirty: draft !== null && !sameDraft(draft, draftFrom(event)),
    saving,
    error,
    startEditing,
    cancel,
    save,
    /** Shows a row saved elsewhere (a cancel) until the refreshed props arrive. */
    showSaved: (row: EventRow) => setSaved({ from: loaded, row }),
    // For EventScheduleSection.
    update,
    reportField,
    momentError,
    commit,
    unpublishing,
    setUnpublishing,
    unpublishError,
  };
}

export type EventScheduleEditor = ReturnType<typeof useEventScheduleEditor>;

/** The event's status and registration schedule as read-only rows. */
export function EventScheduleFields({ event, now }: { event: EventRow; now: string }) {
  const registration = registrationWindow(event, new Date(now));
  return (
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
  );
}

/**
 * "Status and registration schedule": the event's status and dates with a
 * Change button, or, while editing, the quick edit's fields. Also holds the
 * confirmation an Active → Draft save asks for.
 */
export function EventScheduleSection({
  editor,
  now,
}: {
  editor: EventScheduleEditor;
  /** When the server rendered this, so the registration window reads the same on both sides. */
  now: string;
}) {
  const ids = useId();
  const { event, draft, editing, saving, update, reportField, momentError } = editor;
  const canceled = event.canceled_at !== null;
  const publishingNow = draft !== null && event.status === "draft" && draft.status === "active";
  const unpublishingNow = draft !== null && event.status === "active" && draft.status === "draft";

  return (
    <>
      <RecordSection
        title="Status and registration schedule"
        kind={editing ? "content" : "fields"}
        action={
          editing || canceled ? null : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={editor.startEditing}
              aria-label="Change status and registration schedule"
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
              ) : unpublishingNow ? (
                <FieldDescription>
                  Members lose access until you publish it again. You’ll confirm before it saves.
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
            <FieldDescription>Event timing comes from agenda items. <Link href={`/admin/events/${event.id}/edit#builder-agenda`}>Edit the agenda</Link> to change dates and times.</FieldDescription>
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
          <EventScheduleFields event={event} now={now} />
        )}
      </RecordSection>

      <EventUnpublishDialog
        eventId={event.id}
        open={editor.unpublishing}
        onOpenChange={(open) => {
          if (!open && !saving) editor.setUnpublishing(false);
        }}
        pending={saving}
        error={editor.unpublishError}
        onConfirm={() => {
          if (draft) void editor.commit(toInput(draft));
        }}
      />
    </>
  );
}
