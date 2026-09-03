import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventRow } from "@/types/models";

export interface EventCardProps {
  event: EventRow;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function EventCard({ event, href, onClick, className }: EventCardProps) {
  const formattedDate = event.start_date
    ? new Date(event.start_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const locationDisplay = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(" ");

  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow hover:shadow-md",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      {/* Image */}
      {event.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.image_url}
          alt={event.name}
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          No image
        </div>
      )}

      <CardHeader>
        <CardTitle className="line-clamp-1">{event.name}</CardTitle>
        <CardDescription className="flex flex-col gap-1 text-xs">
          {formattedDate && <span>{formattedDate}</span>}
          {locationDisplay && (
            <span className="line-clamp-1">{locationDisplay}</span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {event.short_description || event.description}
        </p>
      </CardContent>

      <CardFooter>
        {href ? (
          <Button asChild className="w-full">
            <Link href={href}>View Event</Link>
          </Button>
        ) : (
          <div className="text-sm font-medium">
            {Number(event.regular_price) === 0
              ? "Free"
              : `$${Number(event.regular_price).toFixed(2)}`}
            {event.member_price !== event.regular_price && (
              <span className="ml-1 text-muted-foreground">
                / ${Number(event.member_price ?? 0).toFixed(2)} member
              </span>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
