import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { EventCard } from "@/features/events";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchEvents } from "@/lib/supabase-helpers/events";

export default async function AdminEventsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const events = await fetchEvents(supabase, {
    orderBy: "created_at",
    ascending: false,
  });

  return (
    <PageContainer className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">
            Events Dashboard
          </h1>
          <p className="text-muted-foreground">
            Review, create, and manage upcoming events.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/create-new">Create Event</Link>
        </Button>
      </header>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <div className="text-2xl font-semibold">No events yet</div>
          <p className="max-w-md text-sm text-muted-foreground">
            You haven&apos;t created any events. Use the create button to add
            your first event and it will show up here.
          </p>
          <Button asChild variant="outline">
            <Link href="/admin/events/create-new">
              Create your first event
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              variant="admin"
              adminLinks={{
                editHref: `/admin/events/${event.id}`,
                checkInHref: `/admin/events/${event.id}/check-in`,
                applicationsHref: `/admin/events/${event.id}/review-applications`,
              }}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
