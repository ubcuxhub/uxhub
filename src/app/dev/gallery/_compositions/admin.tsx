"use client";

import { useState } from "react";
import { Download, Eye, ScanLine } from "lucide-react";

import { BackButton } from "@/components/shared/BackButton";
import { ListCard, ListRow } from "@/components/shared/ListRow";
import {
  SortFilterPanel,
  SortFilterSection,
} from "@/components/shared/SortFilterPanel";
import { TableToolbar } from "@/components/shared/TableToolbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterChip, FilterChipGroup } from "@/components/ui/filter-chip";
import { Pagination } from "@/components/ui/pagination";
import { SearchField } from "@/components/ui/search-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableCheckboxCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabNav, TabNavLink } from "@/components/ui/tab-nav";
import { useRowSelection } from "@/hooks/use-row-selection";

import { HERE, USERS } from "../_fixtures";
import { LIFT, Panel } from "./frame";
import type { Components } from "./types";

function AdminStats() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        className={LIFT}
        label="Active members"
        kind="value"
        value={312}
        change={{ delta: 24, period: "this term" }}
      />
      <StatCard
        className={LIFT}
        label="Show-up rate"
        kind="rate"
        count={96}
        total={128}
        noun="registrants"
      />
      <StatCard
        className={LIFT}
        label="Sponsor return"
        kind="insufficient"
        reason="Fewer than 3 sponsors this term."
      />
      <StatCard className={LIFT} label="Revenue" kind="loading" />
    </div>
  );
}

const STATUS_FILTERS: { status: Status; label: string }[] = [
  { status: "going", label: "Going" },
  { status: "waitlisted", label: "Waitlisted" },
  { status: "checked_in", label: "Checked in" },
];
const PAGE_SIZE = 5;

function Attendees() {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [members, setMembers] = useState(false);
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);

  const needle = query.trim().toLowerCase();
  const results = USERS.filter(
    (user) =>
      (!needle || `${user.name} ${user.email}`.toLowerCase().includes(needle)) &&
      (statuses.length === 0 || statuses.includes(user.status)) &&
      (!members || user.membership),
  ).sort((a, b) =>
    sort === "status" ? a.status.localeCompare(b.status) : a.name.localeCompare(b.name),
  );
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const selection = useRowSelection(results.map((user) => user.id));
  const countOf = (status: Status) => USERS.filter((user) => user.status === status).length;

  return (
    <TableCard className={`border-border-subtle ${LIFT}`}>
      <div className="flex flex-col gap-3 p-4">
        <TableToolbar
          // The card is phone-width on a desktop viewport: keep the phone stack.
          className="sm:flex-col sm:items-stretch sm:[&>div]:flex-wrap"
          search={
            <SearchField
              label="Search attendees"
              placeholder="Search attendees"
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              resultCount={results.length}
            />
          }
          actions={
            <SortFilterPanel
              activeCount={members ? 1 : 0}
              summary={`${results.length} attendees`}
              onClearAll={() => {
                setMembers(false);
                setSort("name");
              }}
            >
              <SortFilterSection title="Sort by">
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger aria-label="Sort by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name, A to Z</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </SortFilterSection>
              <SortFilterSection title="Membership">
                <FilterChipGroup aria-label="Membership">
                  <FilterChip pressed={members} onPressedChange={setMembers}>
                    Members only
                  </FilterChip>
                </FilterChipGroup>
              </SortFilterSection>
            </SortFilterPanel>
          }
          selectedCount={selection.selected.size}
          bulkActions={
            <Button variant="secondary" size="sm">
              <Download aria-hidden />
              CSV
            </Button>
          }
          onClearSelection={selection.clear}
        />
        <FilterChipGroup aria-label="Filter attendees by status">
          {STATUS_FILTERS.map(({ status, label }) => (
            <FilterChip
              key={status}
              count={countOf(status)}
              pressed={statuses.includes(status)}
              onPressedChange={(on) => {
                setStatuses((previous) =>
                  on ? [...previous, status] : previous.filter((s) => s !== status),
                );
                setPage(1);
              }}
            >
              {label}
            </FilterChip>
          ))}
        </FilterChipGroup>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableCheckboxCell
              header
              checked={selection.allState}
              onCheckedChange={selection.toggleAll}
              aria-label="Select all results"
            />
            <TableHead>Name</TableHead>
            <TableHead className="w-28">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={3}>No attendees match.</TableEmpty>
          ) : (
            rows.map((user) => (
              <TableRow
                key={user.id}
                data-state={selection.isSelected(user.id) ? "selected" : undefined}
              >
                <TableCheckboxCell
                  checked={selection.isSelected(user.id)}
                  onCheckedChange={() => selection.toggle(user.id)}
                  aria-label={`Select ${user.name}`}
                />
                <TableCell className="max-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={user.name} size={28} decorative />
                    <span className="truncate">{user.name}</span>
                  </div>
                </TableCell>
                <TableCell className="w-28 pl-0">
                  <StatusBadge status={user.status} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <Pagination
        page={current}
        pageSize={PAGE_SIZE}
        total={results.length}
        onPageChange={setPage}
      />
    </TableCard>
  );
}

function EventHeader() {
  const base = "/admin/events/uxathon";
  return (
    <Panel>
      <CardContent className="flex flex-col gap-5">
        <BackButton link={HERE} label="Back to Manage Events" />
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-h2">UXathon 2027</h3>
            <Badge variant="neutral">Draft</Badge>
          </div>
          <p className="text-small text-muted-foreground">Saved 2 minutes ago</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1">
            <Eye aria-hidden />
            Preview
          </Button>
          <Button className="flex-1">Publish</Button>
        </div>
        <TabNav aria-label="Event pages" pathname={base}>
          <TabNavLink href={base} exact>
            Overview
          </TabNavLink>
          <TabNavLink href={`${base}/review-applications`} count={12}>
            Review
          </TabNavLink>
          <TabNavLink href={`${base}/check-in`}>Check-in</TabNavLink>
        </TabNav>
      </CardContent>
    </Panel>
  );
}

function Mentors() {
  const linkedIn = {
    href: "https://linkedin.com",
    label: "LinkedIn",
    // eslint-disable-next-line @next/next/no-img-element
    icon: <img src="/icons/linkedin.svg" alt="" className="size-4" />,
  };
  return (
    <ListCard title="Mentors" summary="Displaying 4 mentors" className={`border-border-subtle ${LIFT}`}>
      <ListRow
        name="Alex Chen"
        description="Senior product designer · Acme"
        lead={{ kind: "person", src: "/people/david.jpg" }}
        link={linkedIn}
      />
      <ListRow
        name="Jordan Lee"
        description="Research lead · Contoso"
        lead={{ kind: "person", src: "/people/elaine.jpg" }}
        link={linkedIn}
      />
      <ListRow name="Priya Patel" description="Design director · Northwind" lead={{ kind: "person" }} />
      <ListRow
        name="Microsoft"
        description="Design studio, Vancouver"
        lead={{ kind: "organization", logoSrc: "/sponsor-logos/microsoft.png" }}
      />
    </ListCard>
  );
}

function Loading() {
  return (
    <Panel aria-busy>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-3.5 w-56 rounded-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {["w-32", "w-40", "w-28", "w-36"].map((width) => (
          <div key={width} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className={`h-3.5 rounded-full ${width}`} />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
        <div className="flex items-center justify-center gap-2 pt-1 text-small text-muted-foreground">
          <Spinner size="sm" />
          Loading attendees
        </div>
      </CardContent>
    </Panel>
  );
}

const ARRIVED: Record<string, string> = { u2: "10:02 AM", u7: "10:14 AM" };

function CheckIn() {
  const [query, setQuery] = useState("");
  const [arrived, setArrived] = useState(ARRIVED);
  const needle = query.trim().toLowerCase();
  const people = USERS.filter(
    (user) => user.status !== "not_selected" && user.status !== "waitlisted",
  );
  const shown = people
    .filter((user) => !needle || user.name.toLowerCase().includes(needle))
    .slice(0, 4);
  const count = Object.keys(arrived).length;

  return (
    <Panel>
      <CardHeader>
        <CardTitle>Check-in</CardTitle>
        <CardDescription>
          {count} of {people.length} checked in · UXathon 2027
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="info" icon={<ScanLine />}>
          <AlertTitle>Priya Raman is already checked in</AlertTitle>
          <AlertDescription>Scanned at 10:02 AM. No need to scan again.</AlertDescription>
        </Alert>
        <SearchField
          label="Find an attendee"
          placeholder="Find an attendee"
          value={query}
          onValueChange={setQuery}
          resultCount={shown.length}
        />
        <ul className="flex flex-col gap-3">
          {shown.map((user) => (
            <li key={user.id} className="flex items-center gap-3">
              <Avatar name={user.name} size={32} decorative />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-small font-medium">{user.name}</span>
                <span className="truncate text-label font-normal text-muted-foreground">
                  {arrived[user.id] ? `Checked in at ${arrived[user.id]}` : user.membership ?? "Guest"}
                </span>
              </div>
              {arrived[user.id] ? (
                <StatusBadge status="checked_in" />
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setArrived((current) => ({ ...current, [user.id]: "Just now" }))}
                >
                  Check in
                </Button>
              )}
            </li>
          ))}
          {shown.length === 0 ? (
            <li className="py-2 text-center text-small text-muted-foreground">
              No one on the list matches “{query.trim()}”.
            </li>
          ) : null}
        </ul>
      </CardContent>
    </Panel>
  );
}

export const ADMIN_COMPONENTS = {
  "admin-stats": AdminStats,
  "attendee-table": Attendees,
  "admin-event-header": EventHeader,
  "mentors": Mentors,
  "loading": Loading,
  "check-in": CheckIn,
} satisfies Components;
