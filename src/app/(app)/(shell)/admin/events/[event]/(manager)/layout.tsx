import { notFound } from "next/navigation";

import { EventManagerHeader } from "@/features/admin/components/event-manager/EventManagerHeader";
import { eventManagerTabs } from "@/features/admin/lib/event-manager";
import { requireAdmin } from "@/lib/auth/guards";
import { FLAGS } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { fetchSubmittedApplicationCounts } from "@/lib/supabase-helpers/event-application-review-counts";
import { fetchEventById } from "@/lib/supabase-helpers/events";
import { isUuid } from "@/lib/uuid";

/**
 * The event manager: one event's header and tabs (Overview, Agenda, Check-in,
 * Teams, Applications) around the tab's page. A route group, so it wraps the tabs
 * but not the builder (`[event]/edit`), and the URLs stay as they were.
 * The tabs are listed in `src/features/admin/lib/event-manager.ts`.
 *
 * Each tab's page still guards and resolves the param itself: layouts and
 * pages render in parallel, so this guard doesn't stop the page's queries.
 * A slug renders the page alone, which redirects to the ID with its own path.
 */
export default async function EventManagerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ event: string }>;
}) {
  await requireAdmin();
  const { event: eventParam } = await params;
  if (!isUuid(eventParam)) return children;

  const supabase = await createClient();
  const event = await fetchEventById(supabase, eventParam);
  if (!event) notFound();
  const toReview = event.requires_application
    ? await fetchSubmittedApplicationCounts(supabase, [event.id])
    : null;

  return (
    <>
      <EventManagerHeader
        event={event}
        tabs={eventManagerTabs(event.id, event, {
          applicationsToReview: toReview?.get(event.id) ?? 0,
        })}
        publicPages={FLAGS.studentEvents}
      />
      {children}
    </>
  );
}
