import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Navbar from "@/features/marketing/homepage-sections/Navbar";
import Footer from "@/features/marketing/homepage-sections/Footer";
import { createPublicClient } from "@/lib/supabase/public";
import { fetchEvents } from "@/lib/supabase-helpers/events";
import { formatEventDate } from "@/lib/date";

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
              {events.map((event) => {
                const startDate = formatEventDate(event.start_date);
                const eventHref = `/events/${event.slug || event.id}`;

                return (
                  <Link
                    key={event.id}
                    href={eventHref}
                    className="block rounded-xl transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow duration-200 hover:shadow-md">
                      {event.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.image_url}
                          alt={event.name}
                          className="h-48 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-48 w-full items-center justify-center bg-muted text-small text-muted-foreground">
                          No Image
                        </div>
                      )}

                      <CardHeader className="px-4 pt-4">
                        <div className="mb-2 flex gap-2">
                          {startDate && (
                            <Badge variant="secondary">{startDate}</Badge>
                          )}
                          {event.regular_price !== undefined && (
                            <Badge className="border-transparent bg-success-bg text-success hover:bg-success-bg">
                              {Number(event.regular_price) === 0
                                ? "Free"
                                : `$${Number(event.regular_price)}`}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="line-clamp-1">
                          {event.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <CardDescription className="line-clamp-3">
                          {event.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
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
