"use client";

import { useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";

import { PageContainer } from "@/components/shared/PageContainer";
import { SortFilterPanel, SortFilterSection } from "@/components/shared/SortFilterPanel";
import { formatRowCount, TableRowCount, TableToolbar } from "@/components/shared/TableToolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchField } from "@/components/ui/search-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableNone,
  TableRow,
  TableRowLink,
} from "@/components/ui/table";
import type { MembershipTypeOption, UserRecord } from "@/features/admin/types";
import { formatMembershipTypeName } from "@/features/memberships/lib/display";
import type { RoleAccess } from "@/lib/supabase/models";
import { formatUserName } from "@/lib/user-name";
import { useListPage } from "../hooks/use-list-page";
import { useRecordRows } from "../hooks/use-record-rows";
import { toggleSetValue } from "../lib/directory";
import { ChipFilterSection } from "./ChipFilterSection";

interface AdminUsersManagerProps {
  /** Every user, from the server. A save re-renders the page with fresh rows. */
  users: UserRecord[];
  /** Active tiers. Tiers only past members hold are added for filtering. */
  membershipTypes: MembershipTypeOption[];
}

type UserSort = "name-asc" | "name-desc" | "newest" | "oldest";

const DEFAULT_SORT: UserSort = "name-asc";

const SORTS: { value: UserSort; label: string }[] = [
  { value: "name-asc", label: "Name, A to Z" },
  { value: "name-desc", label: "Name, Z to A" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

/** The tier filter's value for users without a membership. */
const NO_MEMBERSHIP = "__none__";

const ROLE_OPTIONS: { value: RoleAccess; label: string }[] = [
  { value: "basic", label: "Basic" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
];

const USER_NOUN = { one: "user", other: "users" };
const LIST_HREF = "/admin/users";
const COLUMNS = 6;

const userHref = (user: UserRecord) => `${LIST_HREF}/${user.id}`;

function compareNames(a: UserRecord, b: UserRecord) {
  return a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
}

/** Sorts in place. Users without a creation date come last either way. */
function sortUsers(users: UserRecord[], sort: UserSort) {
  return users.sort((a, b) => {
    if (sort === "name-asc") return compareNames(a, b);
    if (sort === "name-desc") return compareNames(b, a);
    if (!a.created_at || !b.created_at) {
      if (a.created_at) return -1;
      if (b.created_at) return 1;
      return compareNames(a, b);
    }
    const difference = Date.parse(a.created_at) - Date.parse(b.created_at);
    return (sort === "oldest" ? difference : -difference) || compareNames(a, b);
  });
}

/**
 * Manage users: search, sort, filter and page the directory. Each row links
 * to the user's record, which opens in a drawer over the list.
 */
export function AdminUsersManager({ users, membershipTypes }: AdminUsersManagerProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<UserSort>(DEFAULT_SORT);
  const [tierFilter, setTierFilter] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<Set<RoleAccess>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const records = useRecordRows(LIST_HREF);

  const tierOptions = useMemo(() => {
    const options = new Map(membershipTypes.map((tier) => [tier.id, tier]));
    for (const user of users) {
      if (user.membership_type_id && user.membership_type_name && !options.has(user.membership_type_id)) {
        options.set(user.membership_type_id, { id: user.membership_type_id, name: user.membership_type_name });
      }
    }
    return [
      { value: NO_MEMBERSHIP, label: "No membership" },
      ...[...options.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tier) => ({ value: tier.id, label: formatMembershipTypeName(tier.name) })),
    ];
  }, [membershipTypes, users]);

  const search = query.trim().toLowerCase();
  const filterCount = tierFilter.size + roleFilter.size;
  const filtering = search !== "" || filterCount > 0;

  const results = useMemo(
    () =>
      sortUsers(
        users.filter(
          (user) =>
            (tierFilter.size === 0 || tierFilter.has(user.membership_type_id ?? NO_MEMBERSHIP)) &&
            (roleFilter.size === 0 || roleFilter.has(user.role_access)) &&
            (!search ||
              formatUserName(user).toLowerCase().includes(search) ||
              user.email.toLowerCase().includes(search)),
        ),
        sort,
      ),
    [users, search, sort, tierFilter, roleFilter],
  );

  const view = JSON.stringify([search, sort, [...tierFilter].sort(), [...roleFilter].sort()]);
  const paging = useListPage(results, view, {
    startIndex: results.findIndex((user) => userHref(user) === records.activePath),
  });

  const count = { shown: results.length, total: users.length, noun: USER_NOUN, filtered: filtering };

  const clearFilters = () => {
    setTierFilter(new Set());
    setRoleFilter(new Set());
  };
  const showAll = () => {
    setQuery("");
    clearFilters();
    // Show all goes with the filters; keep focus in the toolbar.
    searchRef.current?.focus();
  };

  return (
    <PageContainer className="flex flex-col gap-8">
      <header>
        <h1 className="mb-2 text-h1 tracking-tight">User Directory</h1>
        <p className="text-muted-foreground">Search and manage all users</p>
      </header>
      {users.length === 0 ? (
        <TableCard>
          <EmptyState
            size="page"
            icon={<Users aria-hidden />}
            title="No users yet"
            description="People show up here once they sign up."
          />
        </TableCard>
      ) : (
        <div className="flex flex-col gap-4">
          <TableToolbar
            search={
              <SearchField
                ref={searchRef}
                label="Search users"
                placeholder="Search by name or email"
                value={query}
                onValueChange={setQuery}
              />
            }
            actions={
              <SortFilterPanel
                activeCount={filterCount + (sort === DEFAULT_SORT ? 0 : 1)}
                summary={formatRowCount(count)}
                onClearAll={() => {
                  clearFilters();
                  setSort(DEFAULT_SORT);
                }}
              >
                <SortFilterSection title="Sort by">
                  <Select value={sort} onValueChange={(value) => setSort(value as UserSort)}>
                    <SelectTrigger aria-label="Sort by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORTS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SortFilterSection>
                <ChipFilterSection
                  title="Membership tier"
                  options={tierOptions}
                  selected={tierFilter}
                  onToggle={(value) => setTierFilter((current) => toggleSetValue(current, value))}
                />
                <ChipFilterSection
                  title="Role access"
                  options={ROLE_OPTIONS}
                  selected={roleFilter}
                  onToggle={(value) => setRoleFilter((current) => toggleSetValue(current, value))}
                />
              </SortFilterPanel>
            }
          />
          <TableCard>
            <Table stickyFirstColumn className="min-w-[56rem]">
              <TableHeader>
                <TableRow>
                  {/* No checkbox column: it is for bulk actions (§3.16), and there are none yet. A CSV export would add one here. */}
                  <TableHead>First name</TableHead>
                  <TableHead>Last name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Role access</TableHead>
                  <TableHead>Major</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paging.pageRows.length === 0 ? (
                  <TableEmpty colSpan={COLUMNS}>No users match your search and filters.</TableEmpty>
                ) : (
                  paging.pageRows.map((user) => {
                    const href = userHref(user);
                    return (
                      <TableRow key={user.id} {...records.rowProps(href)}>
                        <TableCell className="max-w-48 truncate">
                          <TableRowLink {...records.linkProps(href)} aria-label={formatUserName(user)}>
                            {user.first_name}
                          </TableRowLink>
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{user.last_name}</TableCell>
                        <TableCell className="max-w-64 truncate text-muted-foreground">{user.email}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {user.membership_type_name != null
                            ? formatMembershipTypeName(user.membership_type_name)
                            : "No membership"}
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">{user.role_access}</TableCell>
                        <TableCell className="max-w-64 truncate text-muted-foreground">
                          {user.major ?? <TableNone />}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <Pagination
              page={paging.page}
              pageSize={paging.pageSize}
              total={results.length}
              onPageChange={paging.setPage}
              summary={
                <TableRowCount count={{ ...count, range: paging.range }} onClearFilters={showAll} />
              }
            />
          </TableCard>
        </div>
      )}
    </PageContainer>
  );
}
