import type { SaveAdminEventInput } from "../actions";
import type { EventRow } from "@/lib/supabase/models";
import { datetimeLocalToTimestamptz, timestamptzToDatetimeLocal } from "@/lib/date";
import { toApplicationQuestionInputs, toCheckInSessionInputs } from "../components/event-form/event-form-schema";
import { dateSessions } from "./event-date-location";
import { eventWorkingDocument } from "./event-presentation";
import type { EventScheduleInput } from "./event-publication";
import type { Json } from "@/lib/supabase/database.types";

/** Quick publication applies the complete saved document through the builder's
 * transaction. It cannot publish a lossy projection of unfinished sections.
 */
export function workingDocumentSaveInput(event: EventRow, schedule: EventScheduleInput): SaveAdminEventInput | null {
  const document = eventWorkingDocument(event);
  if (!document) return null;
  const s = document.formState;
  const start = timestamptzToDatetimeLocal(schedule.starts_at);
  const end = timestamptzToDatetimeLocal(schedule.ends_at);
  const dateLocation = s.date_location?.version !== 2 && s.date_location?.dates.length === 1 ? {
    ...s.date_location,
    dates: s.date_location.dates.map(row => ({ ...row, date: start.split("T")[0], start: start.split("T")[1] ?? "", end: end.split("T")[1] ?? "" })),
  } : s.date_location;
  return {
    eventId: event.id, draftId: event.id, draftRevision: event.working_revision,
    operationId: schedule.operationId ?? crypto.randomUUID(), expectedRevision: schedule.expectedRevision ?? event.revision,
    expectedPublication: { status: event.status, publish_at: event.publish_at },
    expectedImageUrl: event.image_url, expectedHeaderImageUrl: event.header_image_url,
    event: { name: s.name, description: s.description || null, short_description: s.short_description || null,
      description_rich: s.description_rich as unknown as Json,
      image_url: s.image_url || null, header_image_url: s.header_image_url || null,
      header_colour: s.header_image_url ? null : s.header_colour || null, event_colour: s.event_colour,
      event_type: s.event_type, mentors_enabled: s.mentors_enabled, sponsors_enabled: s.sponsors_enabled,
      requires_application: s.requires_application, agenda_enabled: s.agenda_enabled,
      teams_enabled: s.teams_enabled, min_team_size: s.min_team_size ? Number(s.min_team_size) : null,
      max_team_size: s.max_team_size ? Number(s.max_team_size) : null, team_deadline: datetimeLocalToTimestamptz(s.team_deadline),
      max_capacity: s.max_capacity ? Number(s.max_capacity) : null, reminder_schedule: s.reminder_schedule,
      configured_marketing_mode: s.marketing_mode, configured_marketing_url: s.marketing_url || null,
      configured_slug: s.page_slug, configured_slug_edited: s.slug_edited, is_featured: s.is_featured,
      ...(s.pricing_mode === "legacy" ? { regular_price: s.regular_price ? Number(s.regular_price) : null, member_price: s.member_price ? Number(s.member_price) : null } : {
        configured_pricing_mode: s.pricing_mode, configured_price: s.pricing_mode === "free" ? 0 : s.pricing_amount ? Number(s.pricing_amount) : null,
      }),
      location_building: s.location_building || null, location_room: s.location_room || null, location_address_url: s.location_address_url || null,
      ...schedule,
    },
    content: s.content ?? undefined, dateLocation, dateLocationRevision: s.date_location_revision,
    checkInSessions: dateLocation ? dateSessions(dateLocation) : toCheckInSessionInputs(document.checkInEvents),
    applicationQuestions: toApplicationQuestionInputs(document.applicationTemplate),
    mentorIds: document.mentors.flatMap(row => row.id ? [row.id] : []),
    sponsorIds: document.sponsors.flatMap(row => row.id ? [row.id] : []),
    applicationTiming: { decisions_release_at: datetimeLocalToTimestamptz(s.decisions_release_at), confirmation_deadline: datetimeLocalToTimestamptz(s.confirmation_deadline) },
  };
}
