import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Event } from "@/lib/types/eventTypes";

type EventRecord = Event & { id: string };

interface EventDetailsCardProps {
  event: EventRecord;
}

export function EventDetailsCard({ event }: EventDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        {event.image_url && (
          <div className="mb-4 h-64 w-full overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.image_url}
              alt={event.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <CardTitle className="text-3xl">{event.name}</CardTitle>
        <CardDescription className="text-base">
          {event.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Date & Time
            </p>
            <p className="text-base">
              {event.event_date} at {event.event_time}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Location
            </p>
            <p className="text-base">
              {event.location_building && event.location_room
                ? `${event.location_building} ${event.location_room}`
                : "TBD"}
            </p>
            {event.location_address_url && (
              <a
                href={event.location_address_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View on map
              </a>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Price</p>
            <p className="text-base">${Number(event.price ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Max Capacity
            </p>
            <p className="text-base">{event.max_capacity} attendees</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

