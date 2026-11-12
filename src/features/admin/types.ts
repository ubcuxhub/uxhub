import type {
  CheckInSessionRow,
  EventApplicationQuestionInsert,
  UserInfoRow,
} from "@/lib/supabase/models";

export type CheckInSession = CheckInSessionRow;

/**
 * One application question as an admin event save sends it. `id` names the
 * saved question to update, or is null for a new one; a saved question the
 * save leaves out is removed.
 */
export type ApplicationQuestionInput = Omit<
  EventApplicationQuestionInsert,
  "event_id" | "id"
> & { id: string | null };

/**
 * One check-in session as an admin event save sends it. `id` names the saved
 * session to update, or is null for a new one; a saved session the save leaves
 * out is removed, which the save refuses once anyone has checked in to it.
 */
export interface CheckInSessionInput {
  id: string | null;
  name: string;
  start_time: string;
  end_time: string;
}

/**
 * A check-in session in the admin builder. `id` is the saved session's, absent
 * until the first save; saving sends it back so the session, and the
 * check-ins to it, keep that id.
 */
export interface CheckInSessionDraft {
  id?: string;
  name: string;
  start_time: string;
  end_time: string;
}

/** The fields of a check-in session the builder edits. */
export type CheckInSessionField = Exclude<keyof CheckInSessionDraft, "id">;

/** A ticket holder on the check-in page. `id` is the ticket's. */
export interface CheckInAttendee {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
}

/** Why a scan or a manual check-in was refused. */
export type CheckInRejection = "invalid_code" | "not_found" | "wrong_event";

/** What the door sees after a scan or a manual check-in. */
export type CheckInResult =
  | { status: "checked_in"; name: string; checkedInAt: string }
  | { status: "already_checked_in"; name: string; checkedInAt: string }
  | { status: "rejected"; reason: CheckInRejection };

export type UserRecord = UserInfoRow & {
  membership_type_name?: string | null;
  order_date?: string | null;
};

export interface UserPurchaseSummary {
  id: string;
  title: string;
  kind: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string | null;
}

export interface MembershipTypeOption {
  id: string;
  name: string;
}
