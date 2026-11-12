import type { CheckInSessionRow, UserInfoRow } from "@/lib/supabase/models";

export type CheckInSession = CheckInSessionRow;

export interface CheckInSessionDraft {
  name: string;
  start_time: string;
  end_time: string;
}

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

export type SortOption = "name" | "created_at";

export type SortDirection = "ascending" | "descending";

export interface MembershipTypeOption {
  id: string;
  name: string;
}
