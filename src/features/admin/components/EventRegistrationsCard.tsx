"use client";

import { useId } from "react";
import Link from "next/link";

import { DetailList, DetailRow } from "@/components/shared/DetailRow";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { EventApplicationStatusCounts } from "@/lib/supabase-helpers/event-applications";
import { cn } from "@/lib/utils";
import type { ApplicationReviewState } from "../lib/application-review";
import { ACCEPTED_REVIEW_STATES, reviewListHref } from "../lib/event-registrations";

export interface EventRegistrationsCardProps {
  eventId: string;
  /** The event's capacity; null means no limit. */
  capacity: number | null;
  /** Tickets issued. */
  tickets: number;
  /**
   * Offers out: accepted applications whose offer hasn't lapsed and that have
   * no ticket yet (`fetchEventSeatCounts`). Each holds a seat.
   */
  heldOffers: number;
  /**
   * Seats nobody holds, tickets and offers out taken off
   * (`fetchEventSeatCounts`); null without a capacity.
   */
  seatsLeft: number | null;
  /** Ticket holders checked in to at least one agenda item. */
  checkedIn: number;
  /** Applications by status, for an event that takes them; leave out otherwise. */
  applications?: EventApplicationStatusCounts | null;
  className?: string;
}

const plural = (value: number, one: string, many: string) =>
  `${value} ${value === 1 ? one : many}`;

// A label on the left, the number on the right, at every width.
const ROW = "grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto]";

/** `part` of `whole` as a whole percentage, 0 to 100. */
const percentOf = (part: number, whole: number) =>
  whole > 0 ? Math.min(100, Math.max(0, Math.round((part / whole) * 100))) : 0;

/**
 * Seats taken against capacity: tickets solid, offers out a lighter band
 * straight after them, so the filled length is what "spots left" is left of.
 * Each segment that counts anything shows at least a dot, so a single offer
 * on a big event is still visible. The held band tucks its rounded start
 * under the tickets' rounded end.
 */
function SeatBar({
  capacity,
  tickets,
  heldOffers,
}: {
  capacity: number;
  tickets: number;
  heldOffers: number;
}) {
  const ticketsWidth = percentOf(tickets, capacity);
  // What the offers add on top of the tickets, capped at the capacity.
  const heldWidth = percentOf(tickets + heldOffers, capacity) - ticketsWidth;
  const showTickets = tickets > 0;
  const showHeld = heldOffers > 0 && ticketsWidth < 100;
  return (
    <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-muted">
      {showTickets ? (
        <div
          data-segment="tickets"
          className="relative min-w-2 shrink-0 rounded-full bg-primary"
          style={{ width: `${ticketsWidth}%` }}
        />
      ) : null}
      {showHeld ? (
        <div
          data-segment="held"
          className={cn(
            // Stronger on dark, where the blue sits close to the track.
            "shrink-0 rounded-full bg-primary/30 dark:bg-primary/50",
            showTickets ? "-ml-2 min-w-4" : "min-w-2"
          )}
          style={{ width: showTickets ? `calc(${heldWidth}% + 0.5rem)` : `${heldWidth}%` }}
        />
      ) : null}
    </div>
  );
}

/** One application row: its count links to the review list on those chips. */
const APPLICATION_ROWS: readonly {
  label: string;
  /** What the count is, for the link's accessible name: "3 to review". */
  noun: string;
  count: (counts: EventApplicationStatusCounts) => number;
  states: readonly ApplicationReviewState[];
}[] = [
  { label: "To review", noun: "to review", count: (c) => c.submitted, states: ["submitted"] },
  // Every acceptance: an open offer, a ticket (Going) or a lapsed offer, so
  // the four rows add up to the total.
  { label: "Accepted", noun: "accepted", count: (c) => c.accepted, states: ACCEPTED_REVIEW_STATES },
  { label: "Waitlisted", noun: "waitlisted", count: (c) => c.waitlisted, states: ["waitlisted"] },
  { label: "Rejected", noun: "rejected", count: (c) => c.rejected, states: ["rejected"] },
];

function CountLink({ href, count, noun }: { href: string; count: number; noun: string }) {
  return (
    <Link
      href={href}
      // Starts with the number it shows: "3 to review".
      aria-label={`${count} ${noun}`}
      className="rounded-sm tabular-nums text-primary underline-offset-4 hover:underline focus-visible:focus-ring"
    >
      {count}
    </Link>
  );
}

function ApplicationsSection({
  eventId,
  counts,
}: {
  eventId: string;
  counts: EventApplicationStatusCounts;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col">
      {/* A header row on the rows' own rhythm: 12px to its rule, as theirs. */}
      <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-3">
        <p id={labelId} className="text-body-medium">
          Applications
        </p>
        <CountLink href={reviewListHref(eventId, [])} count={counts.total} noun="in total" />
      </div>
      <DetailList>
        {APPLICATION_ROWS.map((row, index) => (
          <DetailRow
            key={row.label}
            label={row.label}
            className={cn(ROW, index === APPLICATION_ROWS.length - 1 && "border-b-0 pb-0")}
          >
            <CountLink
              href={reviewListHref(eventId, row.states)}
              count={row.count(counts)}
              noun={row.noun}
            />
          </DetailRow>
        ))}
      </DetailList>
    </div>
  );
}

/**
 * An event's registration numbers: tickets and offers out against capacity,
 * who's going, holding an offer and checked in, and, for an event that takes
 * applications, where they stand. The event manager's Overview and the event
 * drawer both show it.
 */
export function EventRegistrationsCard({
  eventId,
  capacity,
  tickets,
  heldOffers,
  seatsLeft,
  checkedIn,
  applications,
  className,
}: EventRegistrationsCardProps) {
  const labelId = useId();
  const capped = capacity != null;
  const left = capped ? Math.max(0, seatsLeft ?? capacity - tickets - heldOffers) : null;
  // Offers come from applications: the row shows on every event that takes
  // them (0 included), and on any other that still has one out.
  const showOffers = applications != null || heldOffers > 0;

  return (
    <Card role="group" aria-labelledby={labelId} className={cn("gap-4", className)}>
      <CardHeader>
        {/* A label, as StatCard's: on Overview the list beside it is the Registrations heading. */}
        <p id={labelId} className="text-small font-medium text-muted-foreground">
          Registrations
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-h1 tabular-nums">
            {tickets}
            {capped ? (
              <span className="text-body-medium text-muted-foreground"> / {capacity}</span>
            ) : null}
          </p>
          <p className="text-small text-muted-foreground">
            {left === null ? "No capacity limit" : `${plural(left, "spot", "spots")} left`}
          </p>
        </div>
        {capped ? <SeatBar capacity={capacity} tickets={tickets} heldOffers={heldOffers} /> : null}
        <DetailList>
          <DetailRow label="Going" className={ROW}>
            <span className="tabular-nums">{tickets}</span>
          </DetailRow>
          {showOffers ? (
            <DetailRow label="Offers out" className={ROW}>
              <span className="tabular-nums">{heldOffers}</span>
            </DetailRow>
          ) : null}
          <DetailRow label="Checked in" className={cn(ROW, "border-b-0 pb-0")}>
            <span className="tabular-nums">{checkedIn}</span>
          </DetailRow>
        </DetailList>
        {applications ? (
          // A rule with more room either side than a row gets (24px against
          // 12px), so the break reads as a new section, not one more row.
          <div className="mt-2 border-t border-border-subtle pt-6">
            <ApplicationsSection eventId={eventId} counts={applications} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
