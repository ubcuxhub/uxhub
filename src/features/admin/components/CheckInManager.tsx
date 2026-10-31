"use client";

import { useEffect, useState, useMemo } from "react";
import { CheckInTable } from "@/features/admin/components/CheckInTable";
import {
  type CheckInAttendee,
  type CheckInSession,
} from "@/features/admin/types";
import type { EventRow } from "@/lib/supabase/models";
import { createClient } from "@/lib/supabase/client";
import { TABLES } from "@/lib/supabase-helpers/tables";
import {
  fetchAdminCheckInSnapshotAction,
  toggleCheckInAction,
} from "@/features/admin/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { formatEventDate, formatEventTime } from "@/lib/date";

// Stat card component
function StatCard({
  title,
  value,
  subtitle,
  valueClassName,
}: {
  title: string;
  value: number;
  subtitle?: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-label text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-h2 ${valueClassName || ""}`}>
          {value}
        </div>
        {subtitle && (
          <p className="mt-1 text-label text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface CheckInManagerProps {
  eventId: string;
  event: EventRow;
  initialCheckInSessions: CheckInSession[];
  initialAttendees: CheckInAttendee[];
  initialCheckInStatuses: [string, string | null][];
}

export function CheckInManager({
  eventId,
  event,
  initialCheckInSessions,
  initialAttendees,
  initialCheckInStatuses,
}: CheckInManagerProps) {
  const supabase = useMemo(() => createClient(), []);

  const [checkInSessions, setCheckInSessions] = useState<CheckInSession[]>(
    initialCheckInSessions
  );
  const [attendees, setAttendees] =
    useState<CheckInAttendee[]>(initialAttendees);
  const [checkInStatuses, setCheckInStatuses] = useState<
    Map<string, string | null>
  >(new Map(initialCheckInStatuses));
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingCells, setUpdatingCells] = useState<Set<string>>(new Set());

  // Fetch all data
  useEffect(() => {
    // Set up realtime subscriptions
    const channel = supabase
      .channel(`check-in-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLES.checkIns,
        },
        async () => {
          try {
            const snapshot = await fetchAdminCheckInSnapshotAction(eventId);
            setCheckInStatuses(new Map(snapshot.statuses));
          } catch (err) {
            console.error("Error refetching check-in statuses:", err);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLES.eventTickets,
          filter: `event_id=eq.${eventId}`,
        },
        async () => {
          try {
            const snapshot = await fetchAdminCheckInSnapshotAction(eventId);
            setAttendees(snapshot.attendees);
          } catch (err) {
            console.error("Error refetching tickets:", err);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLES.checkInSessions,
          filter: `event_id=eq.${eventId}`,
        },
        async () => {
          try {
            const snapshot = await fetchAdminCheckInSnapshotAction(eventId);
            setCheckInSessions(snapshot.sessions);
          } catch (err) {
            console.error("Error refetching check-in sessions:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  // Filter attendees based on search
  const query = searchQuery.trim().toLowerCase();
  const filteredAttendees = query
    ? attendees.filter(
        (attendee) =>
          attendee.user_name.toLowerCase().includes(query) ||
          attendee.user_email.toLowerCase().includes(query)
      )
    : attendees;

  const handleCheckInToggle = async (
    ticketId: string,
    sessionId: string,
    currentlyChecked: boolean
  ) => {
    const key = `${ticketId}_${sessionId}`;
    if (updatingCells.has(key)) return;

    setUpdatingCells((prev) => new Set(prev).add(key));

    try {
      const checkedInAt = await toggleCheckInAction(
        ticketId,
        sessionId,
        !currentlyChecked
      );

      setCheckInStatuses((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, checkedInAt);
        return newMap;
      });
    } catch (err) {
      console.error("Error updating check-in status:", err);
      alert("Failed to update check-in status. Please try again.");
    } finally {
      setUpdatingCells((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = attendees.length;

    // Tickets with at least one check-in
    const checkedInTicketIds = new Set<string>();
    checkInStatuses.forEach((checkedInAt, key) => {
      if (checkedInAt !== null) {
        const [ticketId] = key.split("_");
        checkedInTicketIds.add(ticketId);
      }
    });
    const checkedIn = checkedInTicketIds.size;

    return { total, checkedIn };
  }, [attendees, checkInStatuses]);

  return (
    <PageContainer
      backHref="/admin/events"
      backLabel="Back to Events"
      className="flex flex-col gap-6"
    >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-h2">Check-In Management</h1>
                <p className="text-small text-muted-foreground">
                  Manage attendee check-ins for this event
                </p>
              </div>
            </div>

              <>
                {/* Event Info Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>{event.name}</CardTitle>
                    <CardDescription>{event.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-label text-muted-foreground">
                          Date & Time
                        </p>
                        <p className="text-body">
                          {event.starts_at
                            ? `${formatEventDate(event.starts_at, {
                                month: "short",
                              })} at ${formatEventTime(event.starts_at)}`
                            : "TBD"}
                        </p>
                      </div>
                      <div>
                        <p className="text-label text-muted-foreground">
                          Location
                        </p>
                        <p className="text-body">
                          {event.location_building && event.location_room
                            ? `${event.location_building} ${event.location_room}`
                            : "TBD"}
                        </p>
                      </div>
                      <div>
                        <p className="text-label text-muted-foreground">
                          Max Capacity
                        </p>
                        <p className="text-body">
                          {event.max_capacity} attendees
                        </p>
                      </div>
                      <div>
                        <p className="text-label text-muted-foreground">
                          Price
                        </p>
                        <p className="text-body">
                          ${Number(event.regular_price ?? 0).toFixed(2)}
                          {event.member_price !== event.regular_price && (
                            <span className="text-muted-foreground ml-1">
                              / ${Number(event.member_price ?? 0).toFixed(2)}{" "}
                              member
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Statistics */}
                <div className="grid gap-4 md:grid-cols-2">
                  <StatCard title="Registered" value={stats.total} />
                  <StatCard
                    title="Checked In"
                    value={stats.checkedIn}
                    subtitle={
                      stats.total > 0
                        ? `${Math.round(
                            (stats.checkedIn / stats.total) * 100
                          )}%`
                        : "0%"
                    }
                    valueClassName="text-success-foreground"
                  />
                </div>

                {/* Registrations Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Registrations</CardTitle>
                    <CardDescription>
                      Search and manage attendee check-ins
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CheckInTable
                      sessions={checkInSessions}
                      attendees={attendees}
                      filteredAttendees={filteredAttendees}
                      checkInStatuses={checkInStatuses}
                      onToggle={handleCheckInToggle}
                      updatingCells={updatingCells}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                    />
                  </CardContent>
                </Card>
              </>
    </PageContainer>
  );
}
