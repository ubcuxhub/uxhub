"use client";

import {
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  FilePen,
  ListFilter,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatEventDate,
  formatEventTime,
  formatTimestamp,
} from "@/lib/date";
import type { EventRow, EventStatus } from "@/types/models";

export interface AdminEventTableRow {
  event: EventRow;
  registrationCount: number;
  registrationOpen: boolean;
}

type RegistrationStatus = "open" | "closed" | "not-applicable";
type SortDirection = "ascending" | "descending";

const statusConfig = {
  active: {
    className: "bg-success-bg text-success",
    icon: Check,
    label: "Active",
  },
  archived: {
    className: "",
    icon: Archive,
    label: "Archived",
  },
  draft: {
    className: "bg-warning-bg text-warning",
    icon: FilePen,
    label: "Draft",
  },
} satisfies Record<
  EventStatus,
  {
    className: string;
    icon: typeof Check;
    label: string;
  }
>;

function EventStatusBadge({ status }: { status: EventStatus }) {
  const { className, icon: Icon, label } = statusConfig[status];

  return (
    <Badge
      aria-label={label}
      variant="secondary"
      className={`size-7 justify-center p-0 sm:h-auto sm:w-auto sm:px-2.5 sm:py-0.5 ${className}`}
    >
      <Icon className="size-4 sm:hidden" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </Badge>
  );
}

const eventStatusOptions = (
  Object.entries(statusConfig) as [
    EventStatus,
    (typeof statusConfig)[EventStatus],
  ][]
).map(([value, config]) => ({ value, label: config.label }));

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

function toggleSetValue<T>(values: Set<T>, value: T) {
  const next = new Set(values);

  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }

  return next;
}

function DetailItem({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm">{children || "—"}</dd>
    </div>
  );
}

function formatSchedule(date: string | null, time: string | null) {
  const formattedDate = formatEventDate(date, { month: "short" }) ?? "—";
  const formattedTime = formatEventTime(time);
  return formattedTime ? `${formattedDate} at ${formattedTime}` : formattedDate;
}

function EventDetails({
  row,
}: {
  row: AdminEventTableRow;
}) {
  const { event, registrationCount, registrationOpen } = row;
  const agenda =
    event.agenda &&
    (Array.isArray(event.agenda) || typeof event.agenda === "object")
      ? JSON.stringify(event.agenda, null, 2)
      : event.agenda;

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      <DetailItem label="Status">{statusConfig[event.status].label}</DetailItem>
      <DetailItem label="Event type">{event.event_type}</DetailItem>
      <DetailItem label="Start">
        {formatSchedule(event.start_date, event.start_time)}
      </DetailItem>
      <DetailItem label="End">
        {formatSchedule(event.end_date, event.end_time)}
      </DetailItem>
      <DetailItem label="Registration opens">
        {formatTimestamp(event.registration_start_time) ?? "—"}
      </DetailItem>
      <DetailItem label="Registration closes">
        {formatTimestamp(event.registration_end_time) ?? "—"}
      </DetailItem>
      <DetailItem label="Registration status">
        {event.status === "draft"
          ? "N/A"
          : registrationOpen
            ? "Open"
            : "Closed"}
      </DetailItem>
      <DetailItem label="Attendees">
        {registrationCount} / {event.max_capacity}
      </DetailItem>
      <DetailItem label="Regular price">
        ${Number(event.regular_price).toFixed(2)}
      </DetailItem>
      <DetailItem label="Member price">
        ${Number(event.member_price).toFixed(2)}
      </DetailItem>
      <DetailItem label="Building">{event.location_building}</DetailItem>
      <DetailItem label="Room">{event.location_room}</DetailItem>
      <DetailItem label="Location URL" wide>
        {event.location_address_url ? (
          <a
            href={event.location_address_url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary hover:underline"
          >
            {event.location_address_url}
          </a>
        ) : (
          "—"
        )}
      </DetailItem>
      <DetailItem label="Short description" wide>
        {event.short_description}
      </DetailItem>
      <DetailItem label="Description" wide>
        {event.description}
      </DetailItem>
      <DetailItem label="Applications enabled">
        {event.applications_enabled ? "Yes" : "No"}
      </DetailItem>
      <DetailItem label="Mentors enabled">
        {event.mentors_enabled ? "Yes" : "No"}
      </DetailItem>
      <DetailItem label="Sponsors enabled">
        {event.sponsors_enabled ? "Yes" : "No"}
      </DetailItem>
      <DetailItem label="Slug">{event.slug}</DetailItem>
      <DetailItem label="Cover image" wide>
        {event.image_url ? (
          <a
            href={event.image_url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary hover:underline"
          >
            {event.image_url}
          </a>
        ) : (
          "—"
        )}
      </DetailItem>
      <DetailItem label="Description images" wide>
        {event.description_images?.length
          ? event.description_images.join("\n")
          : "—"}
      </DetailItem>
      <DetailItem label="Agenda" wide>
        {agenda ? (
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {String(agenda)}
          </pre>
        ) : (
          "—"
        )}
      </DetailItem>
      <DetailItem label="Created">
        {formatTimestamp(event.created_at) ?? "—"}
      </DetailItem>
      <DetailItem label="Updated">
        {formatTimestamp(event.updated_at) ?? "—"}
      </DetailItem>
      <DetailItem label="Event ID" wide>
        <span className="break-all">{event.id}</span>
      </DetailItem>
    </dl>
  );
}

export function AdminEventsTable({
  rows,
}: {
  rows: AdminEventTableRow[];
}) {
  const [selectedRow, setSelectedRow] = useState<AdminEventTableRow | null>(
    null
  );
  const [open, setOpen] = useState(false);
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
        const aDate = a.event.start_date;
        const bDate = b.event.start_date;

        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;

        const comparison = aDate.localeCompare(bDate);
        return sortDirection === "ascending" ? comparison : -comparison;
      });
  }, [
    eventStatuses,
    registrationStatuses,
    rows,
    searchQuery,
    sortDirection,
  ]);

  const activeFilterCount = eventStatuses.size + registrationStatuses.size;

  const selectRow = (row: AdminEventTableRow) => {
    setSelectedRow(row);
    setOpen(true);
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    row: AdminEventTableRow
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectRow(row);
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search events by name..."
            aria-label="Search events by name"
            className="pl-9"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setSortDirection((current) =>
              current === "descending" ? "ascending" : "descending"
            )
          }
          aria-label={`Sort by date ${
            sortDirection === "descending" ? "ascending" : "descending"
          }`}
          className="justify-between sm:justify-center"
        >
          Sort by date
          {sortDirection === "descending" ? (
            <ArrowDown aria-hidden="true" />
          ) : (
            <ArrowUp aria-hidden="true" />
          )}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="justify-between sm:justify-center"
            >
              <ListFilter aria-hidden="true" />
              Filters
              {activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="min-w-5 justify-center px-1.5"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-0">
            <div
              role="group"
              aria-labelledby="event-status-filter-heading"
              className="p-4 pt-5"
            >
              <h3
                id="event-status-filter-heading"
                className="mb-3 text-sm font-medium"
              >
                Status
              </h3>
              <div className="space-y-2">
                {eventStatusOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={eventStatuses.has(option.value)}
                      onCheckedChange={() =>
                        setEventStatuses((current) =>
                          toggleSetValue(current, option.value)
                        )
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div
              role="group"
              aria-labelledby="registration-status-filter-heading"
              className="border-t p-4 pt-5"
            >
              <h3
                id="registration-status-filter-heading"
                className="mb-3 text-sm font-medium"
              >
                Registration status
              </h3>
              <div className="space-y-2">
                {registrationStatusOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={registrationStatuses.has(option.value)}
                      onCheckedChange={() =>
                        setRegistrationStatuses((current) =>
                          toggleSetValue(current, option.value)
                        )
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setEventStatuses(new Set());
                    setRegistrationStatuses(new Set());
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                Date
              </th>
              <th className="px-4 py-3 text-left font-medium">Registered</th>
              <th className="px-4 py-3 text-left font-medium">
                Registration Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={row.event.id}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${row.event.name}`}
                className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
                onClick={() => selectRow(row)}
                onKeyDown={(event) => handleRowKeyDown(event, row)}
              >
                <td className="px-4 py-3">
                  <EventStatusBadge status={row.event.status} />
                </td>
                <td className="px-4 py-3 font-medium">{row.event.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatEventDate(row.event.start_date, { month: "short" }) ??
                    "—"}
                </td>
                <td className="px-4 py-3">
                  {row.registrationCount}{" "}
                  <span className="text-muted-foreground">
                    / {row.event.max_capacity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      row.event.status === "draft"
                        ? "destructive"
                        : "secondary"
                    }
                    className={
                      row.event.status !== "draft" && row.registrationOpen
                        ? "bg-success-bg text-success"
                        : undefined
                    }
                  >
                    {row.event.status === "draft"
                      ? "N/A"
                      : row.registrationOpen
                        ? "Open"
                        : "Closed"}
                  </Badge>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No events match your search and filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedRow && (
            <>
              <SheetHeader className="pr-10">
                <SheetTitle className="text-2xl">
                  {selectedRow.event.name}
                </SheetTitle>
                <SheetDescription>
                  View event details and management actions.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-wrap gap-2 px-4">
                <Button asChild variant="outline">
                  <Link href={`/admin/events/${selectedRow.event.id}`}>
                    Edit
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link
                    href={`/admin/events/${selectedRow.event.id}/check-in`}
                  >
                    Check-In
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link
                    href={`/admin/events/${selectedRow.event.id}/review-applications`}
                  >
                    Apps
                  </Link>
                </Button>
              </div>
              <div className="border-t px-4 py-5">
                <EventDetails row={selectedRow} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
