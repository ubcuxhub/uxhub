import type { CheckInSessionRow } from "@/types/models";

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
