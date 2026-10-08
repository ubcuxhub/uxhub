import type { CheckInSessionRow, UserInfoRow } from "@/lib/supabase/models";

export type CheckInSession = CheckInSessionRow;

export interface CheckInSessionDraft {
  name: string;
  start_time: string;
  end_time: string;
}

export interface AttendingRegistration {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
}

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
