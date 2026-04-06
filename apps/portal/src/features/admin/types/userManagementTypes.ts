import type { User } from "@/features/auth/types/userTypes";

export type UserRecord = User & {
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
