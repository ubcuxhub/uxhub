"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AdminSidebar } from "@/components/AdminSidebar";
import { createClient } from "@/lib/supabase/client";
import type { Event } from "@/lib/types/eventTypes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";


interface RegistrationWithUser {
  id: string;
  event_id: string;
  user_id: string;
  status: string; // enum: "pending", "accepted", "declined"
  attending: boolean;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
  user_info: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    student_number: number | null;
    faculty: string | null;
    major: string | null;
    membership_type: string | null;
  };
}

// Helper function to fetch and join registrations with user info
async function fetchRegistrationsWithUsers(
  supabase: ReturnType<typeof createClient>,
  eventId: string
): Promise<RegistrationWithUser[]> {
  const { data: registrationsData, error: registrationsError } = await supabase
    .from("event_registrations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (registrationsError) throw registrationsError;
  if (!registrationsData || registrationsData.length === 0) return [];

  const authUserIds = registrationsData.map((reg) => reg.user_id);
  const { data: usersData, error: usersError } = await supabase
    .from("user_info")
    .select(
      "auth_user_id, name, email, phone, student_number, faculty, major, membership_type"
    )
    .in("auth_user_id", authUserIds);

  if (usersError) throw usersError;

  const userMap = new Map(
    (usersData || []).map((user) => [user.auth_user_id, user])
  );

  return registrationsData.map((reg) => {
    const userInfo = userMap.get(reg.user_id);
    return {
      ...reg,
      user_info: userInfo
        ? {
            id: userInfo.auth_user_id,
            name: userInfo.name,
            email: userInfo.email,
            phone: userInfo.phone,
            student_number: userInfo.student_number,
            faculty: userInfo.faculty,
            major: userInfo.major,
            membership_type: userInfo.membership_type,
          }
        : {
            id: reg.user_id,
            name: "Unknown User",
            email: "",
            phone: null,
            student_number: null,
            faculty: null,
            major: null,
            membership_type: null,
          },
    };
  });
}

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

// Registration card component
function RegistrationCard({
  reg,
  isUpdating,
  onToggleCheckIn,
}: {
  reg: RegistrationWithUser;
  isUpdating: boolean;
  onToggleCheckIn: (id: string, currentlyCheckedIn: boolean) => void;
}) {
  const user = reg.user_info;
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  return (
    <Card
      className={`transition-colors ${
        reg.checked_in
          ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
          : ""
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{user.name}</h3>
              {reg.checked_in && (
                <Badge variant="default" className="bg-green-600">
                  Checked In
                </Badge>
              )}
              {reg.status === "accepted" && (
                <Badge variant="secondary">Accepted</Badge>
              )}
              {reg.attending && <Badge variant="outline">Attending</Badge>}
            </div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p>{user.email}</p>
              {user.phone && <p>Phone: {user.phone}</p>}
              {user.student_number && <p>Student #: {user.student_number}</p>}
              {(user.faculty || user.major) && (
                <p>{[user.faculty, user.major].filter(Boolean).join(" • ")}</p>
              )}
              {user.membership_type && (
                <p className="text-xs">Membership: {user.membership_type}</p>
              )}
            </div>
            {reg.checked_in && reg.checked_in_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Checked in: {formatDate(reg.checked_in_at)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`check-in-${reg.id}`}
                checked={reg.checked_in}
                onCheckedChange={() => onToggleCheckIn(reg.id, reg.checked_in)}
                disabled={isUpdating}
              />
              <Label
                htmlFor={`check-in-${reg.id}`}
                className="text-sm font-medium cursor-pointer"
              >
                {reg.checked_in ? "Checked In" : "Check In"}
              </Label>
            </div>
            {isUpdating && <Spinner size="sm" className="ml-2" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CheckInPage() {
  const params = useParams();
  const eventId = params?.event as string;
  const supabase = useMemo(() => createClient(), []);

  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationWithUser[]>(
    []
  );
  const [filteredRegistrations, setFilteredRegistrations] = useState<
    RegistrationWithUser[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCheckedIn, setFilterCheckedIn] = useState<
    "all" | "checked" | "unchecked"
  >("all");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!eventId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch event
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", eventId)
          .maybeSingle();

        if (eventError) {
          setError(eventError.message);
          setLoading(false);
          return;
        }

        if (!eventData) {
          setError("Event not found");
          setLoading(false);
          return;
        }

        setEvent(eventData as Event);

        // Fetch registrations with user info
        const transformedRegistrations = await fetchRegistrationsWithUsers(
          supabase,
          eventId
        );
        setRegistrations(transformedRegistrations);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load check-in data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up realtime subscription for registrations
    const channel = supabase
      .channel(`check-in-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_registrations",
          filter: `event_id=eq.${eventId}`,
        },
        async () => {
          try {
            const transformedRegistrations = await fetchRegistrationsWithUsers(
              supabase,
              eventId
            );
            setRegistrations(transformedRegistrations);
          } catch (err) {
            console.error("Error refetching registrations:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  // Filter registrations based on search and filter
  useEffect(() => {
    let filtered = [...registrations];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((reg) => {
        const user = reg.user_info;
        return (
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          (user.phone && user.phone.toLowerCase().includes(query)) ||
          (user.student_number &&
            user.student_number.toString().includes(query))
        );
      });
    }

    // Apply check-in filter
    if (filterCheckedIn === "checked") {
      filtered = filtered.filter((reg) => reg.checked_in);
    } else if (filterCheckedIn === "unchecked") {
      filtered = filtered.filter((reg) => !reg.checked_in);
    }

    setFilteredRegistrations(filtered);
  }, [registrations, searchQuery, filterCheckedIn]);

  const handleToggleCheckIn = async (
    registrationId: string,
    currentlyCheckedIn: boolean
  ) => {
    if (updatingIds.has(registrationId)) return;

    setUpdatingIds((prev) => new Set(prev).add(registrationId));

    try {
      const updateData: {
        checked_in: boolean;
        checked_in_at?: string | null;
      } = {
        checked_in: !currentlyCheckedIn,
      };

      if (!currentlyCheckedIn) {
        // Checking in - set timestamp
        updateData.checked_in_at = new Date().toISOString();
      } else {
        // Checking out - clear timestamp
        updateData.checked_in_at = null;
      }

      const { error: updateError } = await supabase
        .from("event_registrations")
        .update(updateData)
        .eq("id", registrationId);

      if (updateError) {
        throw updateError;
      }

      // Update local state optimistically
      setRegistrations((prev) =>
        prev.map((reg) =>
          reg.id === registrationId
            ? {
                ...reg,
                checked_in: updateData.checked_in,
                checked_in_at: updateData.checked_in_at || null,
              }
            : reg
        )
      );
    } catch (err) {
      console.error("Error updating check-in status:", err);
      alert("Failed to update check-in status. Please try again.");
    } finally {
      setUpdatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(registrationId);
        return newSet;
      });
    }
  };

  const handleBulkCheckIn = async (checkIn: boolean) => {
    const toUpdate = filteredRegistrations.filter(
      (reg) => reg.checked_in !== checkIn
    );

    if (toUpdate.length === 0) {
      alert(
        `All filtered registrations are already ${
          checkIn ? "checked in" : "checked out"
        }.`
      );
      return;
    }

    if (
      !confirm(
        `Are you sure you want to ${checkIn ? "check in" : "check out"} ${
          toUpdate.length
        } registration(s)?`
      )
    ) {
      return;
    }

    const updatePromises = toUpdate.map((reg) => {
      const updateData: {
        checked_in: boolean;
        checked_in_at?: string | null;
      } = {
        checked_in: checkIn,
      };

      if (checkIn) {
        updateData.checked_in_at = new Date().toISOString();
      } else {
        updateData.checked_in_at = null;
      }

      return supabase
        .from("event_registrations")
        .update(updateData)
        .eq("id", reg.id);
    });

    try {
      const results = await Promise.all(updatePromises);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        console.error("Some updates failed:", errors);
        alert(
          `Failed to update ${errors.length} registration(s). Please refresh and try again.`
        );
      } else {
        // Refetch to get updated data
        window.location.reload();
      }
    } catch (err) {
      console.error("Error in bulk update:", err);
      alert("Failed to update registrations. Please try again.");
    }
  };

  const stats = useMemo(() => {
    const total = registrations.length;
    const checkedIn = registrations.filter((reg) => reg.checked_in).length;
    const accepted = registrations.filter(
      (reg) => reg.status === "accepted"
    ).length;
    const attending = registrations.filter((reg) => reg.attending).length;

    return { total, checkedIn, accepted, attending };
  }, [registrations]);

  return (
    <ProtectedRoute admin>
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 py-8 px-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <Button asChild variant="outline" className="mb-4">
                  <Link href={`/admin/events`}>← Back to Events</Link>
                </Button>
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
                  <Button asChild className="mt-4">
                    <Link href="/admin/events">Back to Events</Link>
                  </Button>
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

                {/* Search and Filters */}
                <Card>
                  <CardHeader>
                    <CardTitle>Registrations</CardTitle>
                    <CardDescription>
                      Search and manage attendee check-ins
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-1 gap-2">
                        <Input
                          placeholder="Search by name, email, phone, or student number..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="max-w-md"
                        />
                        <select
                          value={filterCheckedIn}
                          onChange={(e) =>
                            setFilterCheckedIn(
                              e.target.value as "all" | "checked" | "unchecked"
                            )
                          }
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="all">All</option>
                          <option value="checked">Checked In</option>
                          <option value="unchecked">Not Checked In</option>
                        </select>
                      </div>
                      {filteredRegistrations.length > 0 && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkCheckIn(true)}
                          >
                            Check In All ({filteredRegistrations.length})
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkCheckIn(false)}
                          >
                            Check Out All ({filteredRegistrations.length})
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Registrations List */}
                    {filteredRegistrations.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        {registrations.length === 0
                          ? "No registrations found for this event."
                          : "No registrations match your search criteria."}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredRegistrations.map((reg) => (
                          <RegistrationCard
                            key={reg.id}
                            reg={reg}
                            isUpdating={updatingIds.has(reg.id)}
                            onToggleCheckIn={handleToggleCheckIn}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
