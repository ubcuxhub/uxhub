"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import {
  Select,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import type { RoleAccess } from "@/lib/supabase/models";
import { formatUserName } from "@/lib/user-name";
import type { MembershipTypeOption, SortDirection, SortOption, UserRecord } from "../types";
import { AdminDirectoryButton, AdminDirectorySelectTrigger, AdminDirectorySelectContent } from "./AdminDirectoryControls";
import { AdminDirectoryFilters } from "./AdminDirectoryFilters";
import { AdminDirectoryTable, type AdminDirectoryColumn } from "./AdminDirectoryTable";
import { AdminDirectoryToolbar } from "./AdminDirectoryToolbar";
import { AdminDirectoryLayout } from "./AdminDirectoryLayout";
import { formatDirectoryFilterLabel } from "../lib/directory";

interface UserDirectoryPanelProps {
  users: UserRecord[];
  membershipTypes: MembershipTypeOption[];
  searchQuery: string;
  sortOption: SortOption;
  sortDirection: SortDirection;
  onSortDirectionToggle: () => void;
  membershipFilter: Set<string>;
  roleFilter: Set<RoleAccess>;
  onSearchQueryChange: (value: string) => void;
  onSortOptionChange: (value: SortOption) => void;
  onMembershipFilterToggle: (value: string) => void;
  onRoleFilterToggle: (value: RoleAccess) => void;
  onClearFilters: () => void;
  onUserSelect: (user: UserRecord, element: HTMLTableRowElement) => void;
}

const userColumns: AdminDirectoryColumn<UserRecord>[] = [
  { id: "first-name", header: "First Name", cellClassName: "font-medium", render: (user) => user.first_name },
  { id: "last-name", header: "Last Name", cellClassName: "font-medium", render: (user) => user.last_name },
  { id: "email", header: "Email", render: (user) => user.email },
  { id: "tier", header: "Tier", render: (user) => user.membership_type_name ?? "No membership" },
  { id: "role", header: "Role Access", cellClassName: "capitalize", render: (user) => user.role_access },
  { id: "major", header: "Major", cellClassName: "max-w-64 whitespace-normal", render: (user) => user.major ?? "—" },
];

export function UserDirectoryPanel({
  users,
  membershipTypes,
  searchQuery,
  sortOption,
  sortDirection,
  onSortDirectionToggle,
  membershipFilter,
  roleFilter,
  onSearchQueryChange,
  onSortOptionChange,
  onMembershipFilterToggle,
  onRoleFilterToggle,
  onClearFilters,
  onUserSelect,
}: UserDirectoryPanelProps) {
  return (
    <AdminDirectoryLayout>
      <AdminDirectoryToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        placeholder="Search users by name or email..."
        searchLabel="Search users by name or email"
      >
        <Select value={sortOption} onValueChange={(value) => onSortOptionChange(value as SortOption)}>
          <AdminDirectorySelectTrigger aria-label="Sort by" className="sm:w-52">
            <span className="flex gap-1">Sort by <SelectValue /></span>
          </AdminDirectorySelectTrigger>
          <AdminDirectorySelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="created_at">Date created</SelectItem>
          </AdminDirectorySelectContent>
        </Select>
        <AdminDirectoryButton
          type="button"
          onClick={onSortDirectionToggle}
          aria-label={`Sort by ${sortOption === "name" ? "name" : "date created"} ${sortDirection === "ascending" ? "descending" : "ascending"}`}
        >
          {sortDirection === "ascending" ? "Ascending" : "Descending"}
          {sortDirection === "ascending" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
        </AdminDirectoryButton>
        <AdminDirectoryFilters
          groups={[
            {
              id: "user-membership-filter-heading",
              label: "Membership Tier",
              options: [
                { value: "__none__", label: "No Membership" },
                ...membershipTypes.map((membership) => ({ value: membership.id, label: formatDirectoryFilterLabel(membership.name) })),
              ],
              selectedValues: membershipFilter,
              onToggle: onMembershipFilterToggle,
            },
            {
              id: "user-role-filter-heading",
              label: "Role Access",
              options: [
                { value: "basic", label: "Basic" },
                { value: "admin", label: "Admin" },
                { value: "manager", label: "Manager" },
              ],
              selectedValues: roleFilter,
              onToggle: (value) => onRoleFilterToggle(value as RoleAccess),
            },
          ]}
          onClear={onClearFilters}
        />
      </AdminDirectoryToolbar>
      <AdminDirectoryTable
        columns={userColumns}
        rows={users}
        getRowKey={(user) => user.id}
        getRowLabel={(user) => `View details for ${formatUserName(user)}`}
        onActivate={onUserSelect}
        emptyMessage="No users match your search and filters."
      />
    </AdminDirectoryLayout>
  );
}
