import type { EventRow } from "@/lib/supabase/models";

export interface AdminEventTableRow {
  event: EventRow;
  registrationCount: number;
  registrationOpen: boolean;
  /** Submitted applications awaiting a decision for application events. */
  applicationsToReview?: number;
}
