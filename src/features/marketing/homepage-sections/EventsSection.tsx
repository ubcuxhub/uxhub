import Button from "@/features/marketing/components/Button";
import { MarketingEventCard } from "@/features/marketing/components/MarketingEventCard";
import { listPublicEvents, type ListedEvent } from "@/features/marketing/lib/public-events";
import { LINKTREE_URL } from "@/lib/constants";
import { FLAGS } from "@/lib/flags";
import { errorFields, log } from "@/lib/log";
import { createPublicClient } from "@/lib/supabase/public";
import { fetchEvents } from "@/lib/supabase-helpers/events";

/** How many upcoming events the homepage previews before linking to /events. */
const EVENTS_SHOWN = 3;

/**
 * The next few published events. A failed read leaves the preview out rather
 * than the homepage: the section still links to /events.
 */
async function loadUpcomingEvents(): Promise<ListedEvent[]> {
  try {
    const events = await fetchEvents(createPublicClient(), { orderBy: "starts_at", status: "active" });
    return listPublicEvents(events, new Date()).upcoming.slice(0, EVENTS_SHOWN);
  } catch (error) {
    log.warn("marketing.homepage_events_failed", errorFields(error));
    return [];
  }
}

/**
 * The homepage's events section. It follows the `studentEvents` flag, as
 * /events does: on, it previews the next events and links to /events; off,
 * it says events are coming soon and points to the Linktree.
 */
export default async function EventsSection() {
  const upcoming = FLAGS.studentEvents ? await loadUpcomingEvents() : [];

  return (
    <div id="events" className="px-[5%] md:px-[20%]">
      <div className="mb-8">
        <p className="mb-0 text-gray font-serif italic font-semibold text-[32px]">
          events
        </p>
        <h2 className=" text-[40px] font-bold leading-tight">
          Learn by doing, connect by creating
        </h2>
      </div>

      {FLAGS.studentEvents ? (
        <div className="flex flex-col items-center gap-8 py-8">
          {upcoming.length > 0 ? (
            <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map(({ event, href, external }) => (
                <MarketingEventCard key={event.id} event={event} href={href} external={external} />
              ))}
            </div>
          ) : (
            <p className="text-gray text-xl font-semibold text-center">
              No upcoming events right now. See what we’ve run before.
            </p>
          )}

          <Button href="/events">ALL EVENTS</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8 py-16 text-center">
          <div className="flex flex-col gap-2">
            <p className="text-gray text-xl font-semibold">
              Events are coming soon.
            </p>
            <p className="text-gray">
              Follow us for announcements about what we have planned.
            </p>
          </div>

          <Button href={LINKTREE_URL} external>
            LINKTREE
          </Button>
        </div>
      )}
    </div>
  );
}
