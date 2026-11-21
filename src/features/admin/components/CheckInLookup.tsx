"use client";

import { useId, useState } from "react";

import { ListRow } from "@/components/shared/ListRow";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { searchCheckInAttendees } from "@/features/admin/lib/check-in-search";
import type { CheckInAttendee } from "@/features/admin/types";

// A phone screen holds about this many rows; past it, more typing beats scrolling.
const MAX_RESULTS = 20;

interface CheckInLookupProps {
  attendees: CheckInAttendee[];
  disabled?: boolean;
  onPick: (attendee: CheckInAttendee) => void;
  onCancel: () => void;
}

/** Finds a ticket holder by name or email when their code won't scan. */
export function CheckInLookup({ attendees, onPick, onCancel, disabled = false }: CheckInLookupProps) {
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
              <ListRow key={attendee.id} variant="compact" name={attendee.user_name} description={attendee.user_email}
                action={<Button variant="secondary" disabled={disabled} onClick={()=>onPick(attendee)} aria-label={`Check in ${attendee.user_name}`}>Check in</Button>}/>

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
