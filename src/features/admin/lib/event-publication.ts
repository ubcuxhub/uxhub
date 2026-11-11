import { timestamptzToDatetimeLocal } from "@/lib/date";
import {
  formStateFromEvent,
  checkInDraftsFromRows,
  questionsFromRows,
  validateEventForm,
} from "@/features/admin/components/event-form/event-form-schema";
import type {
  CheckInSessionRow,
  EventApplicationQuestionRow,
  EventRow,
  EventStatus,
  EventUpdate,
} from "@/lib/supabase/models";

/*
 * When an event may be published, shared by the builder's save
 * (`saveAdminEventAction`) and the overview's quick edit
 * (`updateEventScheduleAction`). The database repeats the publish-date rules in
 * `guard_event_publish_schedule`; these give the readable message first.
 */

/** An ISO timestamp with an explicit zone, as `datetimeLocalToTimestamptz` writes. */
const TIMESTAMPTZ = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/;

/** Whether `value` is a timestamp the database reads the same way everywhere. */
export function isTimestamptz(value: unknown): value is string {
  return (
    typeof value === "string" &&
    TIMESTAMPTZ.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

/**
 * Why `publishAt` can't be saved with `status`, or null when it can. A publish
 * date belongs only to a draft, and only in the future; null clears it.
 */
export function publishAtProblem(
  status: EventStatus | null | undefined,
  publishAt: unknown,
  now = Date.now()
): string | null {
  if (publishAt == null) return null;
  if (!isTimestamptz(publishAt)) {
    return "Publish date must be a valid timestamp with a timezone.";
  }
  if (status !== "draft") return "Only draft events can have a publish date.";
  if (Date.parse(publishAt) <= now) return "Publish date must be in the future.";
  return null;
}

/** Throws `publishAtProblem`'s message, for actions that throw. */
export function assertPublishAt(
  status: EventStatus | null | undefined,
  publishAt: unknown,
  now = Date.now()
) {
  const problem = publishAtProblem(status, publishAt, now);
  if (problem) throw new Error(problem);
}

/** Leads every refusal to publish an event the builder wouldn't save. */
export const FINISH_IN_EDIT = "Finish the event in Edit before publishing.";

/**
 * Whether saving `next` makes the event public, now or at its publish date: a
 * draft turned active, or a draft that will be published on schedule. Either
 * needs a complete event (`publicationReadinessProblem`).
 */
export function isPublishing(
  current: Pick<EventRow, "status">,
  next: { status: EventStatus; publish_at: string | null }
) {
  if (current.status !== "draft") return false;
  return next.status === "active" || next.publish_at !== null;
}

export interface PublicationReadinessInput {
  /** The event as it will be saved. */
  event: EventRow;
  checkInSessions: Pick<CheckInSessionRow, "name" | "start_time" | "end_time">[];
  applicationQuestions: EventApplicationQuestionRow[];
}

/**
 * Why the event isn't ready to publish, or null when it is: the builder's own
 * required-field validation, run on the stored event. The message starts with
 * `FINISH_IN_EDIT` and names the first thing missing.
 *
 * Unlike the builder, an event with no check-in sessions passes: the builder
 * only requires one because its form always shows an empty session.
 */
export function publicationReadinessProblem({
  event,
  checkInSessions,
  applicationQuestions,
}: PublicationReadinessInput): string | null {
  const formState = {
    ...formStateFromEvent(event),
    // Checked by publishAtProblem, against the clock of the caller.
    publish_at: "",
  };
  const { error } = validateEventForm(
    formState,
    checkInDraftsFromRows(checkInSessions),
    questionsFromRows(applicationQuestions)
  );
  return error ? `${FINISH_IN_EDIT} ${error}` : null;
}

/** The overview's quick edit: an event's status and dates, as timestamptz. */
export interface EventScheduleInput {
  status: EventStatus;
  publish_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
}

const SCHEDULE_DATES = [
  "starts_at",
  "ends_at",
  "registration_opens_at",
  "registration_closes_at",
] as const;

/**
 * Why a quick edit's schedule can't be saved, or null when it can: the
 * builder's rules for these fields, in its words. Takes what the client sent,
 * so every value is checked for its type too.
 */
export function eventScheduleProblem(
  input: Partial<Record<keyof EventScheduleInput, unknown>>,
  now = Date.now()
): string | null {
  if (input.status !== "draft" && input.status !== "active") {
    return "Choose whether the event is a draft or active.";
  }
  for (const key of SCHEDULE_DATES) {
    const value = input[key];
    if (value != null && !isTimestamptz(value)) {
      return "Dates must be valid timestamps with a timezone.";
    }
  }
  const { starts_at, ends_at, registration_opens_at, registration_closes_at } =
    input as Partial<Record<(typeof SCHEDULE_DATES)[number], string | null>>;
  if (!starts_at || !ends_at) {
    return "Event start and end dates and times are required.";
  }
  if (Date.parse(starts_at) >= Date.parse(ends_at)) {
    return "Event end time must be after the start time.";
  }
  if (
    registration_opens_at &&
    registration_closes_at &&
    Date.parse(registration_opens_at) >= Date.parse(registration_closes_at)
  ) {
    return "Registration end time must be after the start time.";
  }
  return publishAtProblem(input.status, input.publish_at, now) ?? publicationClosingProblem(input as EventScheduleInput);
}


/** Validate the builder's proposed full event with the same rules as its UI. */
export function builderPublicationProblem(input: import("../actions").SaveAdminEventInput): string | null {
  if (input.event.status !== "active" && !input.event.publish_at) return null;
  const row = { ...input.event, status: input.event.status ?? "draft", configured_marketing_mode: input.event.configured_marketing_mode ?? "hosted" } as EventRow;
  const state = {
    ...formStateFromEvent(row),
    content: input.content ?? null,
    date_location: input.dateLocation ?? null,
    decisions_release_at: timestamptzToDatetimeLocal(input.applicationTiming?.decisions_release_at),
    confirmation_deadline: timestamptzToDatetimeLocal(input.applicationTiming?.confirmation_deadline),
  };
  const result = validateEventForm(state, checkInDraftsFromRows(input.checkInSessions.map(row => ({ ...row, id: row.id ?? undefined }))), questionsFromRows(input.applicationQuestions as EventApplicationQuestionRow[]));
  return result.error;
}

/** Publication succeeds only before a separately configured closing instant. */
export function publicationClosingProblem(event: Pick<EventUpdate, "publish_at" | "registration_closes_at">) {
  if (event.publish_at && event.registration_closes_at && Date.parse(event.publish_at) >= Date.parse(event.registration_closes_at)) return "Publish time must be before registration closes.";
  return null;
}
