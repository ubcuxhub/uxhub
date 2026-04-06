export type ApplicationStatus = "pending" | "declined" | "accepted";

export interface GroupedRegistration {
  user_id: string;
  name: string;
  email: string;
  applicationDate: string;
  status: ApplicationStatus;
  registrationId: string;
}
