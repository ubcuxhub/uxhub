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
import { formatEventDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { EventRow } from "@/lib/supabase/models";

export interface MarketingEventCardProps {
  event: EventRow;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function MarketingEventCard({ event, href, onClick, className }: MarketingEventCardProps) {
  const formattedDate = formatEventDate(event.starts_at, { month: "short" });

  const locationDisplay = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(" ");

  return (
    <Card
      className={cn(
        // Flush image: no top padding, and the card's own radius clips it.
        "gap-4 overflow-hidden pt-0 pb-5 shadow-none transition-colors",
        onClick && "cursor-pointer hover:border-muted-foreground",
        className,
      )}
      onClick={onClick}
    >
      {event.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.image_url}
          alt={event.name}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-muted text-small text-muted-foreground">
          No image
        </div>
      )}

      <CardHeader className="gap-1">
        <CardTitle className="line-clamp-1 text-subheading">
          {event.name}
        </CardTitle>
        <CardDescription className="flex flex-col gap-0.5 text-small text-muted-foreground">
          {formattedDate && <span>{formattedDate}</span>}
          {locationDisplay && (
            <span className="line-clamp-1">{locationDisplay}</span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <p className="line-clamp-3 text-small text-muted-foreground">
          {event.short_description || event.description}
        </p>
      </CardContent>

      <CardFooter className="mt-auto">
        {href ? (
          <Button asChild className="w-full">
            <Link href={href}>View event</Link>
          </Button>
        ) : (
          <div className="text-small font-medium text-foreground">
            {Number(event.regular_price) === 0
              ? "Free"
              : `$${Number(event.regular_price).toFixed(2)}`}
            {event.member_price !== event.regular_price && (
              <span className="ml-1 font-normal text-muted-foreground">
                / ${Number(event.member_price ?? 0).toFixed(2)} member
              </span>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
