import type { UserInfoRow } from "@/types/models";

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
