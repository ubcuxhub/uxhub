"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ApplicationListCard } from "@/features/admin";
import {
  type ApplicationWithUserContact,
} from "@/features/events";
import type { ApplicationStatus } from "@/types/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/shared/PageContainer";

interface ReviewApplicationsClientProps {
  eventId: string;
  eventName: string;
  applications: ApplicationWithUserContact[];
}

export function ReviewApplicationsClient({
  eventId,
  eventName,
  applications,
}: ReviewApplicationsClientProps) {
  const searchParams = useSearchParams();

  // Initialize status filters from URL query param
  const initialFilter = searchParams?.get("filter");
  const initialStatusFilters = useMemo(() => {
    const filters = new Set<ApplicationStatus>();
    if (initialFilter === "pending") {
      filters.add("pending");
    }
    return filters;
  }, [initialFilter]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] =
    useState<Set<ApplicationStatus>>(initialStatusFilters);

  const filteredApplications = useMemo(() => {
    let filtered = [...applications];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        ({ user }) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }

    // Apply status filters
    if (statusFilters.size > 0) {
      filtered = filtered.filter(({ application }) =>
        statusFilters.has(application.status)
      );
    }

    return filtered;
  }, [applications, searchQuery, statusFilters]);

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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Filter:</span>
                    <Button
                      type="button"
                      variant={
                        statusFilters.has("pending") ? "default" : "outline"
                      }
                      onClick={() => toggleStatusFilter("pending")}
                    >
                      Pending
                    </Button>
                    <Button
                      type="button"
                      variant={
                        statusFilters.has("rejected") ? "default" : "outline"
                      }
                      onClick={() => toggleStatusFilter("rejected")}
                    >
                      Rejected
                    </Button>
                    <Button
                      type="button"
                      variant={
                        statusFilters.has("accepted") ? "default" : "outline"
                      }
                      onClick={() => toggleStatusFilter("accepted")}
                    >
                      Accepted
                    </Button>
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
                    {filteredApplications.map(({ application, user }) => (
                      <ApplicationListCard
                        key={application.id}
                        applicationId={application.id}
                        name={user.name}
                        email={user.email}
                        applicationDate={application.submitted_at}
                        status={application.status}
                        attendanceStatus={application.attendance_status}
                        eventId={eventId}
                      />
                    ))}
                  </div>
                )}
              </>
    </PageContainer>
  );
}
