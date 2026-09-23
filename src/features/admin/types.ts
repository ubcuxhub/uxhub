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
  id?: string;
  membership_type_name?: string | null;
  order_date?: string | null;
};

export type SortOption = "name" | "email";

export type SearchOption = "name" | "email";

export interface MembershipTypeOption {
  id: string;
  name: string;
}
