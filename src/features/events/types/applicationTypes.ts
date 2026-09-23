import type { ApplicationStatus } from "@/lib/supabase/models";

export interface GroupedRegistration {
  user_id: string;
  name: string;
  email: string;
  applicationDate: string;
  status: ApplicationStatus;
  registrationId: string;
}
