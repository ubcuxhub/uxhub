import Link from "next/link";
import { CalendarDays, Eye, List, MapPin, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { EventRow } from "@/types/models";

interface UpcomingEventPanelProps {
  event: EventRow | null;
  rsvpCount: number;
}

function formatDate(date: string | null) {
  if (!date) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsedDate = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return date;

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time: string | null) {
  if (!time) return null;

  if (time.includes("T")) {
    return new Date(time).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const timeOnlyMatch = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!timeOnlyMatch) return time;

  const parsedTime = new Date();
  parsedTime.setHours(Number(timeOnlyMatch[1]), Number(timeOnlyMatch[2]), 0, 0);

  return parsedTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function UpcomingEventPanel({
  event,
  rsvpCount,
}: UpcomingEventPanelProps) {
  if (!event) {
    return (
      <section className="flex h-full flex-col gap-3">
        <h2 className="text-2xl font-bold">Upcoming Event</h2>
        <Card className="h-full">
          <CardContent>
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No upcoming events are scheduled yet.
              </p>
              <Button asChild size="sm">
                <Link href="/admin/events/create-new">Create Event</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const eventDate = formatDate(event.start_date);
  const eventTime = formatTime(event.start_time);
  const location = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(" ");
  const rsvpLabel = `${rsvpCount} RSVP${rsvpCount === 1 ? "" : "s"}`;

  return (
    <section className="flex h-full flex-col gap-3">
      <h2 className="text-2xl font-bold">Upcoming Event</h2>
      <Popover>
        <Card className="h-full">
          <CardContent>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full rounded-lg text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:cursor-pointer"
                aria-label={`Open actions for ${event.name}`}
              >
                <div className="grid gap-6 p-2 lg:grid-cols-[minmax(180px,0.9fr)_minmax(0,1fr)] lg:items-center">
                  {event.image_url ? (
                    <div className="overflow-hidden rounded-lg bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={event.image_url}
                        alt={event.name}
                        className="aspect-video h-full w-full object-cover lg:aspect-square"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground lg:aspect-square">
                      Event image
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3">
                      <Badge
                        variant="outline"
                        className="w-fit text-sm font-normal"
                      >
                        {rsvpLabel}
                      </Badge>
                      <div className="flex flex-col gap-2">
                        <h3 className="text-xl font-semibold tracking-tight">
                          {event.name}
                        </h3>
                        <p className="line-clamp-3 text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
                      {(eventDate || eventTime) && (
                        <div className="flex items-center gap-2">
                          <CalendarDays />
                          <span>
                            {eventDate && eventTime
                              ? `${eventDate} at ${eventTime}`
                              : eventDate || eventTime}
                          </span>
                        </div>
                      )}
                      {location && (
                        <div className="flex items-center gap-2">
                          <MapPin />
                          <span>{location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            </PopoverTrigger>
          </CardContent>
        </Card>
        <PopoverContent side="right" align="center" className="w-48 p-2">
          <div className="flex flex-col gap-1">
            <Button
              asChild
              variant="ghost"
              className="justify-start text-sm text-muted-foreground hover:text-muted-foreground"
            >
              <Link href={event.slug ? `/events/${event.slug}` : "/events"}>
                <Eye data-icon="inline-start" />
                View
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="justify-start text-sm text-muted-foreground hover:text-muted-foreground"
            >
              <Link href={`/admin/events/${event.id}`}>
                <Pencil data-icon="inline-start" />
                Edit
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="justify-start text-sm text-muted-foreground hover:text-muted-foreground"
            >
              <Link href="/admin/events">
                <List data-icon="inline-start" />
                See All Events
              </Link>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </section>
  );
}
