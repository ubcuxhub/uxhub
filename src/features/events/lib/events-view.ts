/**
 * The events timeline's last view, Upcoming or Past, kept for the tab so an
 * event page's "Back to Events" returns to it. The timeline writes it whenever
 * it shows; the back link reads it. Storage can be blocked (private windows,
 * some embeds), so both sides fall back to Upcoming.
 */
export type EventsView = "upcoming" | "past";

const KEY = "uxhub:events-view";

export function readEventsView(): EventsView {
  try {
    return window.sessionStorage.getItem(KEY) === "past" ? "past" : "upcoming";
  } catch {
    return "upcoming";
  }
}

export function writeEventsView(view: EventsView) {
  try {
    window.sessionStorage.setItem(KEY, view);
  } catch {
    // Nothing to remember it in: Back to Events opens Upcoming.
  }
}

/** The timeline URL for a view: Past is `?view=past`, Upcoming the bare page. */
export function eventsHref(view: EventsView): string {
  return view === "past" ? "/portal/events?view=past" : "/portal/events";
}
