import { Card, CardTitle } from "@/components/ui/card";
import Navbar from "@/features/marketing/homepage-sections/Navbar";
import Footer from "@/features/marketing/homepage-sections/Footer";
import { EventCard } from "@/components/shared/EventCard";
import { createPublicClient } from "@/lib/supabase/public";
import { fetchEvents } from "@/lib/supabase-helpers/events";

export const revalidate = 300;

export default async function EventsPage() {
  const supabase = createPublicClient();
  const events = await fetchEvents(supabase, { orderBy: "start_date" });

  return (
    <main className="min-h-screen">
      <Navbar />

      <div className="mt-[80px] min-h-[60vh] bg-background px-8 py-8 font-sans text-body text-foreground">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <p className="text-subheading italic text-muted-foreground">
              our calendar
            </p>
            <h1 className="text-h1">Upcoming Events</h1>
            <p className="mt-2 text-muted-foreground">
              Join us to learn, build, and connect.
            </p>
          </div>

          {events.length === 0 ? (
            <Card className="border-dashed py-20 text-center shadow-none">
              <CardTitle>No events scheduled yet</CardTitle>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  href={`/events/${event.slug || event.id}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pt-16">
        <Footer />
      </div>
    </main>
  );
}
