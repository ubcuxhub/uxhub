"use client";

import { useParams } from "next/navigation";

import { BackPill } from "@/components/shared/BackButton";
import { eventManagerHref } from "../lib/event-manager";

/**
 * The builder's way out, first in its header: "Back to event" (the manager's
 * Overview) for an existing event, "Back to Manage Events" for a new one. A
 * plain link, so the builder's unsaved-changes guard asks before it leaves.
 */
export function EventBuilderBackPill({ eventId, className }: { eventId?: string; className?: string }) {
  return eventId ? (
    <BackPill href={eventManagerHref(eventId)} label="Back to event" className={className} />
  ) : (
    <BackPill href="/admin/events" label="Back to Manage Events" className={className} />
  );
}

/**
 * `EventBuilderBackPill` for the builder's loading and error states, which get
 * no props: the event comes from the URL (`/admin/events/<event>/edit`), and
 * `create-new` has none.
 */
export function EventBuilderRouteBackPill({ className }: { className?: string }) {
  const params = useParams<{ event?: string }>();
  return <EventBuilderBackPill eventId={params?.event} className={className} />;
}
