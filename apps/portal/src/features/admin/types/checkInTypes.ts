export interface CheckInSession {
  id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
}

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
