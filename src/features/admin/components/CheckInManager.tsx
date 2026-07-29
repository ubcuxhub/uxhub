"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CheckInTable,
  type AttendingRegistration,
  type CheckInSession,
} from "@/features/admin";
import type { EventRow } from "@/types/models";
import { createClient } from "@/lib/supabase/client";
import { TABLES } from "@/lib/supabase-helpers/tables";
import type { EventRegistrationRow } from "@/types/models";
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
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClassName || ""}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface CheckInManagerProps {
  eventId: string;
  event: EventRow;
  initialCheckInSessions: CheckInSession[];
  initialAttendingRegistrations: AttendingRegistration[];
  initialCheckInStatuses: [string, string | null][];
  initialAllRegistrations: EventRegistrationRow[];
}

export function CheckInManager({
  eventId,
  event,
  initialCheckInSessions,
  initialAttendingRegistrations,
  initialCheckInStatuses,
  initialAllRegistrations,
}: CheckInManagerProps) {
  const supabase = useMemo(() => createClient(), []);

  const [checkInSessions, setCheckInSessions] = useState<CheckInSession[]>(
    initialCheckInSessions
  );
  const [attendingRegistrations, setAttendingRegistrations] = useState<
    AttendingRegistration[]
  >(initialAttendingRegistrations);
  const [filteredRegistrations, setFilteredRegistrations] = useState<
    AttendingRegistration[]
  >([]);
  const [checkInStatuses, setCheckInStatuses] = useState<
    Map<string, string | null>
  >(new Map(initialCheckInStatuses));
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingCells, setUpdatingCells] = useState<Set<string>>(new Set());
  const [allRegistrations, setAllRegistrations] = useState<
    EventRegistrationRow[]
  >(initialAllRegistrations);

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
          table: TABLES.eventRegistrations,
          filter: `event_id=eq.${eventId}`,
        },
        async () => {
          try {
            const snapshot = await fetchAdminCheckInSnapshotAction(eventId);
            setAllRegistrations(snapshot.allRegistrations);
            setAttendingRegistrations(snapshot.registrations);
          } catch (err) {
            console.error("Error refetching registrations:", err);
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

  // Filter registrations based on search
  useEffect(() => {
    let filtered = [...attendingRegistrations];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((reg) => {
        return (
          reg.user_name.toLowerCase().includes(query) ||
          reg.user_email.toLowerCase().includes(query)
        );
      });
    }

    setFilteredRegistrations(filtered);
  }, [attendingRegistrations, searchQuery]);

  const handleCheckInToggle = async (
    registrationId: string,
    sessionId: string,
    currentlyChecked: boolean
  ) => {
    const key = `${registrationId}_${sessionId}`;
    if (updatingCells.has(key)) return;

    setUpdatingCells((prev) => new Set(prev).add(key));

    try {
      const checkedInAt = await toggleCheckInAction(
        registrationId,
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
    const total = allRegistrations.length;
    const accepted = allRegistrations.filter(
      (reg) => reg.status === "accepted"
    ).length;
    const attending = allRegistrations.filter((reg) => reg.attending).length;

    // Count checked in users (users with at least one check-in)
    const checkedInUserIds = new Set<string>();
    checkInStatuses.forEach((checkedInAt, key) => {
      if (checkedInAt !== null) {
        const [registrationId] = key.split("_");
        checkedInUserIds.add(registrationId);
      }
    });
    const checkedIn = checkedInUserIds.size;

    return { total, checkedIn, accepted, attending };
  }, [allRegistrations, checkInStatuses]);

  return (
    <PageContainer
      backHref={`/admin/events/${eventId}`}
      backLabel="Back to Event"
      className="flex flex-col gap-6"
    >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Check-In Management</h1>
                <p className="text-sm text-muted-foreground">
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
                        <p className="text-sm font-medium text-muted-foreground">
                          Date & Time
                        </p>
                        <p className="text-base">
                          {formatEventDate(event.start_date, {
                            month: "short",
                          })
                            ? `${formatEventDate(event.start_date, {
                                month: "short",
                              })}${
                                event.start_time
                                  ? ` at ${formatEventTime(event.start_time)}`
                                  : ""
                              }`
                            : "TBD"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Location
                        </p>
                        <p className="text-base">
                          {event.location_building && event.location_room
                            ? `${event.location_building} ${event.location_room}`
                            : "TBD"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Max Capacity
                        </p>
                        <p className="text-base">
                          {event.max_capacity} attendees
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Price
                        </p>
                        <p className="text-base">
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
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard title="Total Registered" value={stats.total} />
                  <StatCard title="Accepted" value={stats.accepted} />
                  <StatCard title="Attending" value={stats.attending} />
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
                    valueClassName="text-green-600"
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
                      registrations={attendingRegistrations}
                      filteredRegistrations={filteredRegistrations}
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
