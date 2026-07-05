"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ApplicationListCard } from "@/features/admin";
import {
  type ApplicationStatus,
  type GroupedRegistration,
} from "@/features/events";
import { type EventRow } from "@/features/events";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PageContainer } from "@/components/shared/PageContainer";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { fetchEventRegistrationsGroupedByUser } from "@/lib/supabase-helpers/event-registrations";

export default function ReviewApplicationsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params?.event as string;
  const supabase = useMemo(() => createClient(), []);

  // Initialize status filters from URL query param
  const initialFilter = searchParams?.get("filter");
  const initialStatusFilters = useMemo(() => {
    const filters = new Set<ApplicationStatus>();
    if (initialFilter === "pending") {
      filters.add("pending");
    }
    return filters;
  }, [initialFilter]);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [registrations, setRegistrations] = useState<GroupedRegistration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<
    GroupedRegistration[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] =
    useState<Set<ApplicationStatus>>(initialStatusFilters);

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

        // Fetch registrations grouped by user
        const groupedRegistrations = await fetchEventRegistrationsGroupedByUser(
          supabase,
          eventId
        );
        setRegistrations(groupedRegistrations);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load applications");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, supabase]);

  // Filter registrations based on search and status filters
  useEffect(() => {
    let filtered = [...registrations];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (reg) =>
          reg.name.toLowerCase().includes(query) ||
          reg.email.toLowerCase().includes(query)
      );
    }

    // Apply status filters
    if (statusFilters.size > 0) {
      filtered = filtered.filter((reg) => statusFilters.has(reg.status));
    }

    setFilteredRegistrations(filtered);
  }, [registrations, searchQuery, statusFilters]);

  const toggleStatusFilter = (status: ApplicationStatus) => {
    setStatusFilters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setStatusFilters(new Set());
    setSearchQuery("");
  };

  return (
    <PageContainer
      backHref={`/admin/events/${eventId}`}
      backLabel="Back to Event"
      className="flex flex-col gap-8"
    >
            <header className="flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Review Applications</h1>
                <p className="text-sm text-muted-foreground">
                  {event?.name || "Loading event..."}
                </p>
              </div>
            </header>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/50 p-10 text-center text-sm text-destructive">
                {error}
              </div>
            ) : (
              <>
                {/* Search Bar */}
                <div className="w-full">
                  <Input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Filter Section */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Filter:</span>
                    <Button
                      type="button"
                      variant={
                        statusFilters.has("pending") ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => toggleStatusFilter("pending")}
                    >
                      Pending
                    </Button>
                    <Button
                      type="button"
                      variant={
                        statusFilters.has("declined") ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => toggleStatusFilter("declined")}
                    >
                      Declined
                    </Button>
                    <Button
                      type="button"
                      variant={
                        statusFilters.has("accepted") ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => toggleStatusFilter("accepted")}
                    >
                      Accepted
                    </Button>
                    {(statusFilters.size > 0 || searchQuery.trim()) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>

                {/* Applications List */}
                {filteredRegistrations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
                    <div className="text-2xl font-semibold">
                      {registrations.length === 0
                        ? "No applications yet"
                        : "No applications match your filters"}
                    </div>
                    <p className="max-w-md text-sm text-muted-foreground">
                      {registrations.length === 0
                        ? "Applications will appear here once users submit them."
                        : "Try adjusting your search or filter criteria."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredRegistrations.map((registration) => (
                      <ApplicationListCard
                        key={registration.user_id}
                        registrationId={registration.registrationId}
                        name={registration.name}
                        email={registration.email}
                        applicationDate={registration.applicationDate}
                        status={registration.status}
                        eventId={eventId}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
    </PageContainer>
  );
}
