"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ApplicationListCard,
} from "@/features/admin/components/ApplicationListCard";
import {
  APPLICATION_REVIEW_STATE_LABELS,
  getApplicationReviewState,
  type ApplicationReviewState,
} from "@/features/admin/lib/application-review";
import type { ApplicationSummary } from "@/lib/supabase-helpers/event-applications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/shared/PageContainer";

interface ReviewApplicationsClientProps {
  eventId: string;
  eventName: string;
  applications: ApplicationSummary[];
}

const FILTERS: ApplicationReviewState[] = [
  "submitted",
  "waitlisted",
  "accepted",
  "registered",
  "offer_expired",
  "rejected",
];

export function ReviewApplicationsClient({
  eventId,
  eventName,
  applications,
}: ReviewApplicationsClientProps) {
  const searchParams = useSearchParams();

  // Initialize status filters from URL query param
  const initialFilter = searchParams?.get("filter");
  const initialStatusFilters = useMemo(() => {
    const filters = new Set<ApplicationReviewState>();
    if (initialFilter === "submitted") {
      filters.add("submitted");
    }
    return filters;
  }, [initialFilter]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] =
    useState<Set<ApplicationReviewState>>(initialStatusFilters);

  const reviewed = useMemo(
    () =>
      applications.map((application) => ({
        ...application,
        state: getApplicationReviewState(
          {
            status: application.status,
            offer_expires_at: application.offerExpiresAt,
          },
          application.hasTicket
        ),
      })),
    [applications]
  );

  const filteredApplications = useMemo(() => {
    let filtered = reviewed;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (application) =>
          application.name.toLowerCase().includes(query) ||
          application.email.toLowerCase().includes(query)
      );
    }

    // Apply status filters
    if (statusFilters.size > 0) {
      filtered = filtered.filter((application) =>
        statusFilters.has(application.state)
      );
    }

    return filtered;
  }, [reviewed, searchQuery, statusFilters]);

  const toggleStatusFilter = (status: ApplicationReviewState) => {
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
      backHref="/admin/events"
      backLabel="Back to Events"
      className="flex flex-col gap-8"
    >
            <header className="flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Review Applications</h1>
                <p className="text-sm text-muted-foreground">
                  {eventName}
                </p>
              </div>
            </header>

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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Filter:</span>
                    {FILTERS.map((state) => (
                      <Button
                        key={state}
                        type="button"
                        variant={statusFilters.has(state) ? "default" : "outline"}
                        onClick={() => toggleStatusFilter(state)}
                      >
                        {APPLICATION_REVIEW_STATE_LABELS[state]}
                      </Button>
                    ))}
                    {(statusFilters.size > 0 || searchQuery.trim()) && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={clearFilters}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>

                {/* Applications List */}
                {filteredApplications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
                    <div className="text-2xl font-semibold">
                      {applications.length === 0
                        ? "No applications yet"
                        : "No applications match your filters"}
                    </div>
                    <p className="max-w-md text-sm text-muted-foreground">
                      {applications.length === 0
                        ? "Applications will appear here once users submit them."
                        : "Try adjusting your search or filter criteria."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredApplications.map((application) => (
                      <ApplicationListCard
                        key={application.applicationId}
                        applicationId={application.applicationId}
                        name={application.name}
                        email={application.email}
                        applicationDate={application.appliedAt}
                        state={application.state}
                        eventId={eventId}
                      />
                    ))}
                  </div>
                )}
              </>
    </PageContainer>
  );
}
