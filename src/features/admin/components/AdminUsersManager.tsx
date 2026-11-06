"use client";

import { useMemo, useState } from "react";

import { PageContainer } from "@/components/shared/PageContainer";
import { UserDirectoryPanel } from "@/features/admin/components/UserDirectoryPanel";
import type {
  MembershipTypeOption,
  SortDirection,
  SortOption,
  UserRecord,
} from "@/features/admin/types";
import type { RoleAccess } from "@/lib/supabase/models";
import { formatUserName } from "@/lib/user-name";
import { toggleSetValue } from "../lib/directory";

interface AdminUsersManagerProps {
  /** Every user, from the server. A save re-renders the page with fresh rows. */
  users: UserRecord[];
  /** Active tiers. Tiers only past members hold are added for filtering. */
  membershipTypes: MembershipTypeOption[];
}

/**
 * Manage users: search, sort and filter the directory. Each row links to the
 * user's record, which opens in a drawer beside the list.
 */
export function AdminUsersManager({ users, membershipTypes }: AdminUsersManagerProps) {
  const [membershipFilter, setMembershipFilter] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<Set<RoleAccess>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const [sortOption, setSortOption] = useState<SortOption>("name");

  const directoryMembershipTypes = useMemo(() => {
    const options = new Map(membershipTypes.map((tier) => [tier.id, tier]));
    for (const user of users) {
      if (user.membership_type_id && user.membership_type_name && !options.has(user.membership_type_id)) {
        options.set(user.membership_type_id, { id: user.membership_type_id, name: user.membership_type_name });
      }
    }
    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [membershipTypes, users]);

  const query = searchQuery.trim().toLowerCase();
  const filtering = query !== "" || membershipFilter.size > 0 || roleFilter.size > 0;

  const filteredUsers = useMemo(() => {
    const filtered = users.filter(
      (user) =>
        (membershipFilter.size === 0 || membershipFilter.has(user.membership_type_id ?? "__none__")) &&
        (roleFilter.size === 0 || roleFilter.has(user.role_access)) &&
        (!query ||
          formatUserName(user).toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query))
    );

    return filtered.sort((a, b) => {
      const nameComparison = a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
      let comparison = nameComparison;
      if (sortOption === "created_at") {
        if (!a.created_at && !b.created_at) return nameComparison;
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        comparison = Date.parse(a.created_at) - Date.parse(b.created_at);
      }
      return sortDirection === "ascending" ? comparison : -comparison;
    });
  }, [users, query, sortDirection, sortOption, membershipFilter, roleFilter]);

  return (
    <PageContainer className="flex flex-col gap-8">
      <header>
        <h1 className="mb-2 text-h1 tracking-tight">User Directory</h1>
        <p className="text-muted-foreground">Search and manage all users</p>
      </header>
      <UserDirectoryPanel
        users={filteredUsers}
        totalUsers={users.length}
        filtering={filtering}
        membershipTypes={directoryMembershipTypes}
        searchQuery={searchQuery}
        sortOption={sortOption}
        sortDirection={sortDirection}
        membershipFilter={membershipFilter}
        roleFilter={roleFilter}
        onSearchQueryChange={setSearchQuery}
        onSortOptionChange={setSortOption}
        onSortDirectionToggle={() =>
          setSortDirection((current) => (current === "ascending" ? "descending" : "ascending"))
        }
        onMembershipFilterToggle={(value) => setMembershipFilter((current) => toggleSetValue(current, value))}
        onRoleFilterToggle={(value) => setRoleFilter((current) => toggleSetValue(current, value))}
        onClearFilters={() => {
          setMembershipFilter(new Set());
          setRoleFilter(new Set());
        }}
        onClearSearchAndFilters={() => {
          setSearchQuery("");
          setMembershipFilter(new Set());
          setRoleFilter(new Set());
        }}
      />
    </PageContainer>
  );
}
