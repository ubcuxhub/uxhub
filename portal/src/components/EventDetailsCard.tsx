import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Event } from "@/lib/types/eventTypes";

interface EventDetailsCardProps {
  event: Event;
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
              {event.start_date && event.start_time
                ? `${new Date(event.start_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })} at ${event.start_time}`
                : event.start_date
                ? new Date(event.start_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "TBD"}
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
            <p className="text-base">
              ${Number(event.regular_price ?? 0).toFixed(2)}
              {event.member_price !== event.regular_price && (
                <span className="text-muted-foreground ml-1">
                  / ${Number(event.member_price ?? 0).toFixed(2)} member
                </span>
              )}
            </p>
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
