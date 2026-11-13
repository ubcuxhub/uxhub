"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { SortFilterPanel, SortFilterSection } from "@/components/shared/SortFilterPanel";
import { formatRowCount, TableRowCount, TableToolbar } from "@/components/shared/TableToolbar";
import { Badge } from "@/components/ui/badge";
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
import { formatEventDate } from "@/lib/date";
import type { EventStatus } from "@/lib/supabase/models";
import { useListPage } from "../hooks/use-list-page";
import { useRecordRows } from "../hooks/use-record-rows";
import type { AdminEventDirectoryRow } from "../lib/admin-event-table";
import { toggleSetValue } from "../lib/directory";
import { ChipFilterSection } from "./ChipFilterSection";
import { EVENT_STATUS_LABELS, EventStatusBadge } from "./EventStatusBadge";

export type { AdminEventTableRow } from "../lib/admin-event-table";

type RegistrationStatus = "open" | "closed" | "not-applicable";
type EventSort = "newest" | "oldest";

const DEFAULT_SORT: EventSort = "newest";

const SORTS: { value: EventSort; label: string }[] = [
  { value: "newest", label: "Date, newest first" },
  { value: "oldest", label: "Date, oldest first" },
];

const STATUS_OPTIONS = (Object.entries(EVENT_STATUS_LABELS) as [EventStatus, string][]).map(
  ([value, label]) => ({ value, label }),
);

const REGISTRATION_LABELS = {
  open: "Open",
  closed: "Closed",
  "not-applicable": "N/A",
} satisfies Record<RegistrationStatus, string>;

const REGISTRATION_OPTIONS = (Object.entries(REGISTRATION_LABELS) as [RegistrationStatus, string][]).map(
  ([value, label]) => ({ value, label }),
);

const EVENT_NOUN = { one: "event", other: "events" };
const LIST_HREF = "/admin/events";
const COLUMNS = 5;

const eventHref = (row: AdminEventDirectoryRow) => {
  if ("draftId" in row) {
    return row.eventId
      ? `${LIST_HREF}/${row.eventId}/edit`
      : `${LIST_HREF}/drafts/${row.draftId}`;
  }
  return `${LIST_HREF}/${row.event.id}`;
};

/** A working draft still belongs to its source event when its drawer is open. */
const eventRecordHref = (row: AdminEventDirectoryRow) => {
  const eventId = "draftId" in row ? row.eventId : row.event.id;
  return eventId ? `${LIST_HREF}/${eventId}` : eventHref(row);
};

/** A draft takes no registrations, so it has no registration status. */
function getRegistrationStatus(row: AdminEventDirectoryRow): RegistrationStatus {
  if (row.event.status === "draft") return "not-applicable";
  return row.registrationOpen ? "open" : "closed";
}

/** Sorts in place by start date. Undated events come last either way. */
function sortEvents(rows: AdminEventDirectoryRow[], sort: EventSort) {
  return rows.sort((a, b) => {
    const aDate = a.event.starts_at;
    const bDate = b.event.starts_at;
    if (!aDate || !bDate) return aDate ? -1 : bDate ? 1 : 0;
    const difference = Date.parse(aDate) - Date.parse(bDate);
    return sort === "oldest" ? difference : -difference;
  });
}

/**
 * Manage events: search, sort, filter and page the events. Each row links to
 * the event's overview drawer, or resumes a working draft in its editor.
 */
export function AdminEventsTable({ rows }: { rows: AdminEventDirectoryRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<EventSort>(DEFAULT_SORT);
  const [statusFilter, setStatusFilter] = useState<Set<EventStatus>>(new Set());
  const [registrationFilter, setRegistrationFilter] = useState<Set<RegistrationStatus>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const records = useRecordRows(LIST_HREF);

  const search = query.trim().toLocaleLowerCase();
  const filterCount = statusFilter.size + registrationFilter.size;
  const filtering = search !== "" || filterCount > 0;

  const results = useMemo(
    () =>
      sortEvents(
        rows.filter(
          (row) =>
            (!search || row.event.name.toLocaleLowerCase().includes(search)) &&
            (statusFilter.size === 0 || statusFilter.has(row.event.status)) &&
            (registrationFilter.size === 0 || registrationFilter.has(getRegistrationStatus(row))),
        ),
        sort,
      ),
    [rows, search, sort, statusFilter, registrationFilter],
  );

  const view = JSON.stringify([search, sort, [...statusFilter].sort(), [...registrationFilter].sort()]);
  const paging = useListPage(results, view, {
    startIndex: results.findIndex((row) => eventRecordHref(row) === records.activePath),
  });

  const count = { shown: results.length, total: rows.length, noun: EVENT_NOUN, filtered: filtering };

  const clearFilters = () => {
    setStatusFilter(new Set());
    setRegistrationFilter(new Set());
  };
  const showAll = () => {
    setQuery("");
    clearFilters();
    // Show all goes with the filters; keep focus in the toolbar.
    searchRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <TableToolbar
        search={
          <SearchField
            ref={searchRef}
            label="Search events"
            placeholder="Search by name"
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
              <Select value={sort} onValueChange={(value) => setSort(value as EventSort)}>
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
              title="Status"
              options={STATUS_OPTIONS}
              selected={statusFilter}
              onToggle={(value) => setStatusFilter((current) => toggleSetValue(current, value))}
            />
            <ChipFilterSection
              title="Registration"
              options={REGISTRATION_OPTIONS}
              selected={registrationFilter}
              onToggle={(value) => setRegistrationFilter((current) => toggleSetValue(current, value))}
            />
          </SortFilterPanel>
        }
      />
      <TableCard>
        <Table stickyFirstColumn className="min-w-[48rem]">
          <TableHeader>
            <TableRow>
              {/* No checkbox column: it is for bulk actions (§3.16), and there are none yet. A CSV export would add one here. */}
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registration</TableHead>
              <TableHead>Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paging.pageRows.length === 0 ? (
              <TableEmpty colSpan={COLUMNS}>No events match your search and filters.</TableEmpty>
            ) : (
              paging.pageRows.map((row) => {
                const workingDraft = "draftId" in row;
                const href = eventHref(row);
                const reviewEventId = workingDraft ? row.eventId : row.event.id;
                const registration = getRegistrationStatus(row);
                const recordHref = eventRecordHref(row);
                const linkProps = records.linkProps(recordHref);
                return (
                  <TableRow key={workingDraft ? `draft:${row.draftId}` : row.event.id} {...records.rowProps(recordHref)}>
                    <TableCell className="max-w-72 truncate">
                      <TableRowLink {...linkProps} href={href} replace={workingDraft ? false : linkProps.replace} aria-current={workingDraft ? undefined : linkProps["aria-current"]}>{row.event.name}</TableRowLink>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatEventDate(row.event.starts_at, { month: "short" }) ?? <TableNone />}
                    </TableCell>
                    <TableCell>
                      <EventStatusBadge status={row.event.status} publishAt={workingDraft ? null : row.event.publish_at} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={registration === "open" ? "success" : "neutral"}>
                        {REGISTRATION_LABELS[registration]}
                      </Badge>
                      {row.event.requires_application ? (
                        <div className="mt-1 whitespace-nowrap text-small text-muted-foreground">By application</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {workingDraft && !row.eventId ? <TableNone /> : (
                        <>
                          {row.registrationCount}{" "}
                          <span className="text-muted-foreground">/ {row.event.max_capacity ?? <TableNone />}</span>
                        </>
                      )}
                      {reviewEventId && row.event.requires_application && (row.applicationsToReview ?? 0) > 0 ? (
                        <div className="mt-1">
                          <Link
                            href={`${LIST_HREF}/${reviewEventId}/review-applications?status=submitted`}
                            aria-label={`${row.applicationsToReview} ${
                              row.applicationsToReview === 1 ? "application" : "applications"
                            } to review for ${row.event.name}`}
                            className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Badge variant="warning">{row.applicationsToReview} to review</Badge>
                          </Link>
                        </div>
                      ) : null}
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
          summary={<TableRowCount count={{ ...count, range: paging.range }} onClearFilters={showAll} />}
        />
      </TableCard>
    </div>
  );
}
