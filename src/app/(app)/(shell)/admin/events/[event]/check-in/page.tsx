"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  CheckInTable,
  type AttendingRegistration,
  type CheckInSession,
} from "@/features/admin";
import { type EventRow } from "@/features/events";
import { createClient } from "@/lib/supabase/client";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import {
  fetchAttendingRegistrations,
  fetchCheckInSessions,
  fetchCheckInStatuses,
  fetchCheckInId,
  insertCheckIn,
  updateCheckInTimestamp,
} from "@/lib/supabase-helpers/check-ins";
import { fetchRegistrationsForEvent } from "@/lib/supabase-helpers/event-registrations";
import { TABLES } from "@/lib/supabase-helpers/tables";
import type { EventRegistrationRow } from "@/types/models";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/shared/BackButton";
import { PageContainer } from "@/components/shared/PageContainer";

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

export default function CheckInPage() {
  const params = useParams();
  const eventId = params?.event as string;
  const supabase = useMemo(() => createClient(), []);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [checkInSessions, setCheckInSessions] = useState<CheckInSession[]>([]);
  const [attendingRegistrations, setAttendingRegistrations] = useState<
    AttendingRegistration[]
  >([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<
    AttendingRegistration[]
  >([]);
  const [checkInStatuses, setCheckInStatuses] = useState<
    Map<string, string | null>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingCells, setUpdatingCells] = useState<Set<string>>(new Set());
  const [allRegistrations, setAllRegistrations] = useState<
    EventRegistrationRow[]
  >([]);

  // Fetch all data
  useEffect(() => {
    if (!eventId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch event
        const eventData = await fetchEventById(supabase, eventId);

        if (!eventData) {
          setError("Event not found");
          setLoading(false);
          return;
        }

        setEvent(eventData);

        // Fetch all registrations for statistics
        const allRegsData = await fetchRegistrationsForEvent(supabase, eventId);
        setAllRegistrations(allRegsData);

        // Fetch check-in sessions
        const sessions = await fetchCheckInSessions(supabase, eventId);
        setCheckInSessions(sessions);

        // Fetch attending registrations
        const registrations = await fetchAttendingRegistrations(
          supabase,
          eventId
        );
        setAttendingRegistrations(registrations);

        // Fetch check-in statuses
        const statuses = await fetchCheckInStatuses(supabase, eventId);
        setCheckInStatuses(statuses);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load check-in data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();

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
            // Refetch check-in statuses when check_ins table changes
            const statuses = await fetchCheckInStatuses(supabase, eventId);
            setCheckInStatuses(statuses);
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
            // Refetch registrations when event_registrations change
            const allRegsData = await fetchRegistrationsForEvent(
              supabase,
              eventId
            );
            setAllRegistrations(allRegsData);

            const registrations = await fetchAttendingRegistrations(
              supabase,
              eventId
            );
            setAttendingRegistrations(registrations);
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
            const sessions = await fetchCheckInSessions(supabase, eventId);
            setCheckInSessions(sessions);
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
      // Check if entry exists
      const existingCheckInId = await fetchCheckInId(
        supabase,
        registrationId,
        sessionId
      );

      if (currentlyChecked) {
        // Unchecking - set checked_in_at to null
        if (existingCheckInId) {
          await updateCheckInTimestamp(supabase, existingCheckInId, null);

          // Update local state
          setCheckInStatuses((prev) => {
            const newMap = new Map(prev);
            newMap.set(key, null);
            return newMap;
          });
        }
      } else {
        // Checking - set checked_in_at to current time
        const now = new Date().toISOString();

        if (existingCheckInId) {
          // Update existing entry
          await updateCheckInTimestamp(supabase, existingCheckInId, now);
        } else {
          // Insert new entry
          await insertCheckIn(supabase, {
            event_registration_id: registrationId,
            check_in_session_id: sessionId,
            checked_in_at: now,
          });
        }

        // Update local state
        setCheckInStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(key, now);
          return newMap;
        });
      }
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

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : error ? (
              <Card>
                <CardHeader>
                  <CardTitle>Error</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-destructive">{error}</p>
                  <BackButton
                    link={`/admin/events/${eventId}`}
                    label="Back to Event"
                    className="mt-4"
                  />
                </CardContent>
              </Card>
            ) : event ? (
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
                          {event.start_date && event.start_time
                            ? `${new Date(event.start_date).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )} at ${event.start_time}`
                            : event.start_date
                            ? new Date(event.start_date).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )
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
            ) : null}
    </PageContainer>
  );
}
