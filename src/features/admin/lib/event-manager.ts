import type { EventRow } from "@/lib/supabase/models";

/**
 * The event manager: one event's full page, a header and a row of tabs, one
 * route each, under `/admin/events/<id>/`. The record drawer
 * (`/admin/events/<id>`) is the quick peek from the list; its expand button
 * opens the manager's Overview. The builder (`/edit`) and the phone scanner
 * (`/check-in/scan`) are pages of their own, outside the manager.
 */

/** The manager's landing tab. */
export function eventManagerHref(eventId: string) {
  return `/admin/events/${eventId}/overview`;
}

/** What the tab labels count. */
export interface EventManagerCounts {
  /** Submitted applications nobody has decided yet. */
  applicationsToReview: number;
}

type TabEvent = Pick<EventRow, "requires_application" | "teams_enabled">;

interface EventManagerTab {
  label: string;
  /** The route under `/admin/events/<id>/`. */
  segment: string;
  /** Whether the event has this tab. Always, without one. */
  shows?: (event: TabEvent) => boolean;
  /** A count after the label. Hidden at zero. */
  count?: (counts: EventManagerCounts) => number;
}

/**
 * The manager's tabs, in order. Adding one is a line here plus its route in
 * `[event]/(manager)/<segment>/page.tsx`. Only list a tab whose page exists.
 */
const EVENT_MANAGER_TABS: readonly EventManagerTab[] = [
  { label: "Overview", segment: "overview" },
  { label: "Agenda", segment: "agenda" },
  { label: "Check-in", segment: "check-in" },
  { label: "Teams", segment: "teams", shows: (event) => event.teams_enabled },
  {
    label: "Applications",
    segment: "review-applications",
    shows: (event) => event.requires_application,
    count: (counts) => counts.applicationsToReview,
  },
];

export interface EventManagerTabLink {
  label: string;
  href: string;
  count?: number;
}

/** The tabs this event has, with their links and counts. */
export function eventManagerTabs(
  eventId: string,
  event: TabEvent,
  counts: EventManagerCounts
): EventManagerTabLink[] {
  return EVENT_MANAGER_TABS.filter((tab) => tab.shows?.(event) ?? true).map((tab) => {
    const count = tab.count?.(counts);
    return {
      label: tab.label,
      href: `/admin/events/${eventId}/${tab.segment}`,
      ...(count ? { count } : {}),
    };
  });
}
