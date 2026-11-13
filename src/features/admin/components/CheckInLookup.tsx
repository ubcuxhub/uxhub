"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { searchCheckInAttendees } from "@/features/admin/lib/check-in-search";
import type { CheckInAttendee } from "@/features/admin/types";

// A phone screen holds about this many rows; past it, more typing beats scrolling.
const MAX_RESULTS = 20;

interface CheckInLookupProps {
  attendees: CheckInAttendee[];
  onPick: (attendee: CheckInAttendee) => void;
  onCancel: () => void;
}

/** Finds a ticket holder by name or email when their code won't scan. */
export function CheckInLookup({ attendees, onPick, onCancel }: CheckInLookupProps) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";
  const matches = searching ? searchCheckInAttendees(attendees, query) : [];

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-subheading">
          Find someone
        </h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Back to scanning
        </Button>
      </div>

      <SearchField
        label="Search by name or email"
        placeholder="Name or email"
        value={query}
        onValueChange={setQuery}
        resultCount={searching ? matches.length : undefined}
        autoFocus
      />

      {!searching ? (
        <EmptyState
          size="inline"
          title="Search by name or email"
          description="Pick someone to check them in."
        />
      ) : matches.length === 0 ? (
        <EmptyState
          size="inline"
          title="No one matches"
          description="Check the spelling, or try their email."
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-xl border border-border">
            {matches.slice(0, MAX_RESULTS).map((attendee) => (
              <li key={attendee.id}>
                <button
                  type="button"
                  onClick={() => onPick(attendee)}
                  aria-label={[`Check in ${attendee.user_name}`, attendee.user_email]
                    .filter(Boolean)
                    .join(", ")}
                  className="flex min-h-14 w-full flex-col items-start justify-center gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted active:bg-border-subtle focus-visible:focus-ring"
                >
                  <span className="text-body-medium [overflow-wrap:anywhere]">
                    {attendee.user_name}
                  </span>
                  {attendee.user_email ? (
                    <span className="text-small text-muted-foreground [overflow-wrap:anywhere]">
                      {attendee.user_email}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          {matches.length > MAX_RESULTS ? (
            <p className="text-small text-muted-foreground">
              Showing {MAX_RESULTS} of {matches.length}. Keep typing to narrow it down.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
