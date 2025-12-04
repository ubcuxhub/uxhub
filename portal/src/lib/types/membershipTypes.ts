export type MembershipTier = {
  id: string;
  name: string;
  description: string;
  features: string[];
  price: number;
  created_at: string;
  updated_at: string;
};

export interface User {
  id: string; // UUID from user_info table
  email: string;
  name: string;
  phone: string;
  student_number?: number | null;
  membership_type_id?: string;
  membership_type?: string; // Ideally joined
  membership_expires_at?: string;
  membership_pre_ordered_type_id?: string;
  newsletter: boolean;
  auth_user_id: string; // UUID linked to auth.users.id
  faculty?: string | null;
  major?: string | null;
  year?: string | null;
  role_access: string;
  dietary_restrictions?: string | null;
  preferred_pronouns?: string | null;
  user_type: "ubcStudent" | "faculty" | "nonUbc";
}
