import { Calendar } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { StatusBadge, type Status } from "@/components/ui/status-badge";
import type { EventDateLine } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface EventCardProps
  extends Omit<React.ComponentProps<"article">, "title"> {
  title: string;
  href: string;
  venue?: string | null;
  /**
   * One or two pre-formatted date-time lines. Use `EventCardDates` for the
   * design's look: the day in medium weight, then the time.
   */
  when: React.ReactNode;
  /** One StatusBadge; leave out when the status isn't known. */
  status?: Status | null;
  /** The event image, cropped square. Decorative, so it has no alt text. */
  image?: { src: string } | null;
  /** Default "h3". */
  headingLevel?: "h2" | "h3";
}

/**
 * One event in a list or the timeline (§3.5): title, venue, date line(s), one
 * StatusBadge and a square thumbnail. The whole card is one link, so it is one
 * Tab stop, and its accessible name is the title alone. It never lifts: hover
 * only changes the fill. On phones the thumbnail moves above the text.
 */
function EventCard({
  title,
  href,
  venue,
  when,
  status,
  image,
  headingLevel = "h3",
  className,
  ...props
}: EventCardProps) {
  const Heading = headingLevel;

  return (
    <article
      data-slot="event-card"
      className={cn(
        "relative flex flex-col-reverse gap-4 rounded-lg border bg-card p-4 transition-colors duration-150 hover:bg-background-secondary has-[a:focus-visible]:focus-ring sm:flex-row sm:items-center sm:gap-6 sm:p-5",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Heading className="text-subheading text-pretty break-words text-foreground">
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
          >
            {title}
          </Link>
        </Heading>
        {venue ? (
          <p className="text-body text-muted-foreground">{venue}</p>
        ) : null}
        <div className="text-body text-foreground">{when}</div>
        {status ? (
          <div className="mt-2 flex">
            <StatusBadge status={status} size="large" />
          </div>
        ) : null}
      </div>
      <div
        data-slot="event-card-thumbnail"
        aria-hidden
        className="flex h-35 w-full shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-muted sm:size-40"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.src}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <Calendar className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
    </article>
  );
}

/**
 * The date lines for an EventCard's `when`: the day in medium weight, then the
 * time, with an en dash between two lines ("Sat, Jan 9 9:00 AM–7:00 PM –
 * Sun, Jan 10 9:00 AM–3:00 PM"). Wraps onto two rows when narrow.
 */
function EventCardDates({
  lines,
  className,
  ...props
}: { lines: readonly EventDateLine[] } & React.ComponentProps<"p">) {
  return (
    <p
      data-slot="event-card-dates"
      className={cn("flex flex-wrap gap-x-2", className)}
      {...props}
    >
      {lines.map((line, index) => (
        // The dash travels with the line after it, so a wrap never leaves it
        // dangling at the end of the first row.
        <span key={`${line.day}-${index}`} className="whitespace-nowrap">
          {index > 0 ? (
            <>
              <span aria-hidden className="mr-2 text-muted-foreground">
                –
              </span>
              <span className="sr-only">to </span>
            </>
          ) : null}
          <span className="font-medium">{line.day}</span> {line.time}
        </span>
      ))}
    </p>
  );
}

export { EventCard, EventCardDates };
