import type { Status } from "@/components/ui/status-badge";

export interface User {
  id: string;
  name: string;
  email: string;
  membership: string | null;
  major: string | null;
  status: Status;
}

export const USERS: User[] = [
  { id: "u1", name: "Alex Chen", email: "alex.chen@student.ubc.ca", membership: "Innovator", major: "Cognitive Systems", status: "going" },
  { id: "u2", name: "Priya Raman", email: "priya.raman@student.ubc.ca", membership: "Innovator", major: "Psychology", status: "checked_in" },
  { id: "u3", name: "Jordan Lee", email: "jordan.lee@gmail.com", membership: null, major: "Business", status: "waitlisted" },
  { id: "u4", name: "Sam Okafor", email: "sam.okafor@student.ubc.ca", membership: "Explorer", major: null, status: "pending" },
  { id: "u5", name: "Mei Tanaka", email: "mei.tanaka@student.ubc.ca", membership: "Explorer", major: "Computer Science", status: "accepted" },
  { id: "u6", name: "Noah Williams", email: "noah.w@student.ubc.ca", membership: null, major: "Design", status: "not_selected" },
  { id: "u7", name: "Fatima Hassan", email: "fatima.hassan@student.ubc.ca", membership: "Innovator", major: "Information Design", status: "going" },
  { id: "u8", name: "Lucas Moreau", email: "lucas.moreau@student.ubc.ca", membership: "Explorer", major: "Cognitive Systems", status: "full" },
  { id: "u9", name: "Hana Kim", email: "hana.kim@student.ubc.ca", membership: null, major: null, status: "past" },
  { id: "u10", name: "Omar Aziz", email: "omar.aziz@student.ubc.ca", membership: "Innovator", major: "Psychology", status: "going" },
  { id: "u11", name: "Ivy Zhang", email: "ivy.zhang@student.ubc.ca", membership: "Explorer", major: "Business", status: "registration_open" },
  { id: "u12", name: "Diego Alvarez", email: "diego.alvarez@student.ubc.ca", membership: null, major: "Computer Science", status: "waitlisted" },
];
