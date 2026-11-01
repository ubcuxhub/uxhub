"use client";

import { Calendar } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import {
  StatusBadge,
  type Status,
  type StatusBadgeSpec,
} from "@/components/ui/status-badge";
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
  /**
   * One StatusBadge; leave out when the status isn't known. A bare status name,
   * or a spec for the dated and custom student labels
   * (`{ status: "register_by", date: "Oct 20" }`, `{ label, tone, icon }`).
   */
  status?: Status | StatusBadgeSpec | null;
  /** The event image, cropped square. Decorative, so it has no alt text. */
  image?: { src: string } | null;
  /** Default "h3". */
  headingLevel?: "h2" | "h3";
}

/**
 * One event in a list or the timeline (§3.5): title, venue, date line(s), one
 * StatusBadge and a square thumbnail. The whole card is one link, so it is one
 * Tab stop. The title names the link and the dates and status describe it, so
 * three "Portfolio Review" sessions are told apart when a screen reader reads
 * the link (the name stays the title, so headings and link lists stay short). It
 * never lifts: hover only changes the fill. On phones the thumbnail moves above
 * the text. A thumbnail that fails to load falls back to the calendar tile.
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
  const id = React.useId();
  const whenId = `${id}-when`;
  const statusId = `${id}-status`;
  const badge: StatusBadgeSpec | null = status
    ? typeof status === "string"
      ? { status }
      : status
    : null;
  // A thumbnail that fails to load falls back to the calendar tile. Keyed on
  // the URL so a new image gets a fresh try.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const showImage = failedSrc !== image?.src;

  return (
    <article
      data-slot="event-card"
      className={cn(
        "relative flex flex-col-reverse gap-4 rounded-lg border bg-card p-4 transition-colors duration-150 hover:bg-section has-[a:focus-visible]:focus-ring sm:flex-row sm:items-center sm:gap-6 sm:p-5",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Heading className="text-subheading text-pretty break-words text-foreground">
          <Link
            href={href}
            aria-describedby={[whenId, badge ? statusId : null]
              .filter(Boolean)
              .join(" ")}
            className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
          >
            {title}
          </Link>
        </Heading>
        {venue ? (
          <p className="text-body text-muted-foreground">{venue}</p>
        ) : null}
        <div id={whenId} className="text-body text-foreground">
          {when}
        </div>
        {badge ? (
          <div id={statusId} className="mt-2 flex">
            <StatusBadge {...badge} size="large" />
          </div>
        ) : null}
      </div>
      <div
        data-slot="event-card-thumbnail"
        aria-hidden
        className="flex h-35 w-full shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-muted sm:size-40"
      >
        {image && showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.src}
            alt=""
            loading="lazy"
            onError={() => setFailedSrc(image.src)}
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
