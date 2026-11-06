"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatEventDate } from "@/lib/date";
import type { EventRow, EventStatus } from "@/lib/supabase/models";
import { toggleSetValue } from "../lib/directory";
import { AdminDirectoryLayout } from "./AdminDirectoryLayout";
import { AdminDirectoryToolbar } from "./AdminDirectoryToolbar";
import {
  AdminDirectoryTable,
  type AdminDirectoryColumn,
} from "./AdminDirectoryTable";
import { AdminDirectoryButton } from "./AdminDirectoryControls";
import { AdminDirectoryFilters } from "./AdminDirectoryFilters";
import { EVENT_STATUS_LABELS, EventStatusBadge } from "./EventStatusBadge";

export interface AdminEventTableRow {
  event: EventRow;
  registrationCount: number;
  registrationOpen: boolean;
}

type RegistrationStatus = "open" | "closed" | "not-applicable";
type SortDirection = "ascending" | "descending";

const eventStatusOptions = (
  Object.entries(EVENT_STATUS_LABELS) as [EventStatus, string][]
).map(([value, label]) => ({ value, label }));

const registrationStatusOptions: {
  value: RegistrationStatus;
  label: string;
}[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "not-applicable", label: "N/A" },
];

function getRegistrationStatus(
  row: AdminEventTableRow
): RegistrationStatus {
  if (row.event.status === "draft") {
    return "not-applicable";
  }

  return row.registrationOpen ? "open" : "closed";
}

const eventColumns: AdminDirectoryColumn<AdminEventTableRow>[] = [
  {
    id: "status",
    header: "Status",
    render: (row) => (
      <EventStatusBadge
        status={row.event.status}
        publishAt={row.event.publish_at}
      />
    ),
  },
  {
    id: "name",
    header: "Name",
    cellClassName: "font-medium",
    rowLink: true,
    render: (row) => row.event.name,
  },
  {
    id: "date",
    header: "Date",
    headerClassName: "whitespace-nowrap",
    cellClassName: "whitespace-nowrap text-muted-foreground",
    render: (row) =>
      formatEventDate(row.event.starts_at, { month: "short" }) ?? "—",
  },
  {
    id: "registered",
    header: "Registered",
    render: (row) => (
      <>
        {row.registrationCount}{" "}
        <span className="text-muted-foreground">/ {row.event.max_capacity}</span>
      </>
    ),
  },
  {
    id: "registration-status",
    header: "Registration Status",
    render: (row) => (
      <Badge
        variant={
          row.event.status === "draft"
            ? "neutral"
            : row.registrationOpen
              ? "success"
              : "neutral"
        }
      >
        {row.event.status === "draft"
          ? "N/A"
          : row.registrationOpen
            ? "Open"
            : "Closed"}
      </Badge>
    ),
  },
];

export function AdminEventsTable({
  rows,
}: {
  rows: AdminEventTableRow[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("descending");
  const [eventStatuses, setEventStatuses] = useState<Set<EventStatus>>(
    new Set()
  );
  const [registrationStatuses, setRegistrationStatuses] = useState<
    Set<RegistrationStatus>
  >(new Set());

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    return rows
      .filter((row) => {
        const matchesName =
          !normalizedQuery ||
          row.event.name.toLocaleLowerCase().includes(normalizedQuery);
        const matchesEventStatus =
          eventStatuses.size === 0 || eventStatuses.has(row.event.status);
        const matchesRegistrationStatus =
          registrationStatuses.size === 0 ||
          registrationStatuses.has(getRegistrationStatus(row));

        return (
          matchesName && matchesEventStatus && matchesRegistrationStatus
        );
      })
      .sort((a, b) => {
        const aDate = a.event.starts_at;
        const bDate = b.event.starts_at;

        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;

        const comparison = Date.parse(aDate) - Date.parse(bDate);
        return sortDirection === "ascending" ? comparison : -comparison;
      });
  }, [
    eventStatuses,
    registrationStatuses,
    rows,
    searchQuery,
    sortDirection,
  ]);

  return (
    <AdminDirectoryLayout>
      <AdminDirectoryToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        placeholder="Search events by name..."
        searchLabel="Search events by name"
      >
        <AdminDirectoryButton
          type="button"
          onClick={() =>
            setSortDirection((current) =>
              current === "descending" ? "ascending" : "descending"
            )
          }
          aria-label={`Sort by date ${
            sortDirection === "descending" ? "ascending" : "descending"
          }`}
        >
          Sort by date
          {sortDirection === "descending" ? (
            <ArrowDown aria-hidden="true" />
          ) : (
            <ArrowUp aria-hidden="true" />
          )}
        </AdminDirectoryButton>

        <AdminDirectoryFilters
          groups={[
            {
              id: "event-status-filter-heading",
              label: "Status",
              options: eventStatusOptions,
              selectedValues: eventStatuses,
              onToggle: (value) =>
                setEventStatuses((current) =>
                  toggleSetValue(current, value as EventStatus)
                ),
            },
            {
              id: "registration-status-filter-heading",
              label: "Registration status",
              options: registrationStatusOptions,
              selectedValues: registrationStatuses,
              onToggle: (value) =>
                setRegistrationStatuses((current) =>
                  toggleSetValue(current, value as RegistrationStatus)
                ),
            },
          ]}
          onClear={() => {
            setEventStatuses(new Set());
            setRegistrationStatuses(new Set());
          }}
        />
      </AdminDirectoryToolbar>

      <AdminDirectoryTable
        columns={eventColumns}
        rows={filteredRows}
        getRowKey={(row) => row.event.id}
        getRowLabel={(row) => `View details for ${row.event.name}`}
        getRowHref={(row) => `/admin/events/${row.event.id}`}
        listHref="/admin/events"
        emptyMessage="No events match your search and filters."
      />
    </AdminDirectoryLayout>
  );
}
