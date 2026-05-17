export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  student_number?: number | null;
  membership_type_id?: string | null;
  membership_type?: string;
  membership_expires_at?: string;
  membership_pre_ordered_type_id?: string;
  newsletter: boolean;
  auth_user_id: string;
  faculty?: string | null;
  major?: string | null;
  year?: string | null;
  role_access: string;
  dietary_restrictions?: string | null;
  preferred_pronouns?: string | null;
  user_type: "ubcStudent" | "faculty" | "nonUbc";
}
