import { datetimeLocalToTimestamptz } from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";
import type { EventWorkingDocument } from "./event-working-document";

export interface AdminEventTableRow {
  event: EventRow;
  registrationCount: number;
  registrationOpen: boolean;
  /** Submitted applications awaiting a decision for application events. */
  applicationsToReview?: number;
}

export interface AdminEventDraftTableRow {
  draftId: string;
  eventId: string | null;
  event: Pick<EventRow, "id" | "name" | "starts_at" | "requires_application"> & {
    status: "draft";
    max_capacity: number | null;
  };
  registrationCount: number;
  registrationOpen: false;
  applicationsToReview?: number;
}

export type AdminEventDirectoryRow = AdminEventTableRow | AdminEventDraftTableRow;

interface WorkingDraft {
  id: string;
  event_id: string | null;
  document: EventWorkingDocument;
}

/** Project incomplete working documents into the list without fabricating event rows. */
export function buildAdminEventTableRows(
  events: AdminEventTableRow[],
  drafts: WorkingDraft[]
): AdminEventDirectoryRow[] {
  const byEvent = new Map(drafts.filter(draft => draft.event_id).map(draft => [draft.event_id, draft]));
  const draftRow = (draft: WorkingDraft, source?: AdminEventTableRow): AdminEventDraftTableRow => {
    const state = draft.document.formState;
    const capacity = state.max_capacity.trim() ? Number(state.max_capacity) : NaN;
    return {
      draftId: draft.id,
      eventId: draft.event_id,
      event: {
        id: draft.id,
        name: state.name.trim() || "Untitled event",
        status: "draft",
        requires_application: source?.event.requires_application ?? state.requires_application,
        starts_at: datetimeLocalToTimestamptz(state.starts_at),
        max_capacity: Number.isInteger(capacity) && capacity >= 0 ? capacity : null,
      },
      registrationCount: source?.registrationCount ?? 0,
      applicationsToReview: source?.applicationsToReview,
      registrationOpen: false,
    };
  };
  return [
    ...events.map(row => {
      const draft = byEvent.get(row.event.id);
      return draft && row.event.status === "draft" && !row.event.publish_at
        ? draftRow(draft, row)
        : row;
    }),
    ...drafts.filter(draft => !draft.event_id).map(draft => draftRow(draft)),
  ];
}
