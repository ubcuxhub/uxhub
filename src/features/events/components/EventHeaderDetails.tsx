import type { ReactNode } from "react";
import Link from "next/link";
import { Calendar, Globe, Lock, MapPin, Video, type LucideIcon } from "lucide-react";

import { endsOnLaterDay, formatEventDate, formatEventTime } from "@/lib/date";
import type { ParticipantLocation } from "@/lib/location";
import { cn } from "@/lib/utils";

import { meetingPlatform } from "../lib/meeting-platform";
import { CopyValueButton } from "./CopyValueButton";

/** Where the "Event website" row goes, and the address it shows. */
export type EventWebsite =
  | { kind: "external"; href: string; display: string }
  | { kind: "hosted"; href: string; display: string };

interface EventHeaderDetailsProps {
  startsAt: string | null;
  endsAt: string | null;
  /** The viewer-scoped location; restricted until they're going. */
  location: ParticipantLocation | null;
  /** Shown as the venue when the event has no location settings yet. */
  fallbackBuilding: string | null;
  website: EventWebsite | null;
}

const OPENS_IN_NEW_TAB = <span className="sr-only"> (opens in a new tab)</span>;

/**
 * The facts under the event title (Figma "EventDetailRow", 1.3, 1.21–1.24):
 * the date, the venue, the online meeting and the website, three across from
 * `sm` and stacked on phones. A hybrid event gets both a venue and an online
 * row. Until the viewer is going, the venue shows its public summary and the
 * meeting link stays hidden.
 */
export function EventHeaderDetails({
  startsAt,
  endsAt,
  location,
  fallbackBuilding,
  website,
}: EventHeaderDetailsProps) {
  const type = location?.type ?? "in_person";

  return (
    <div className="grid gap-6 border-t border-border-subtle pt-6 sm:grid-cols-3">
      <DateRow startsAt={startsAt} endsAt={endsAt} />
      {type !== "online" ? <VenueRow location={location} fallbackBuilding={fallbackBuilding} /> : null}
      {location && type !== "in_person" ? <OnlineRow location={location} /> : null}
      {website ? <WebsiteRow website={website} /> : null}
    </div>
  );
}

/** One fact: a 42px icon tile, then the fact and its detail. */
export function EventDetailRow({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div data-slot="event-detail-row" className="flex min-w-0 items-start gap-3">
      <span className="flex size-10.5 shrink-0 items-center justify-center rounded-lg border border-border-subtle">
        <Icon className="size-4" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col wrap-anywhere">{children}</div>
    </div>
  );
}

function Fact({ children }: { children: ReactNode }) {
  return <p className="text-body-medium text-foreground">{children}</p>;
}

function Detail({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-small text-muted-foreground", className)}>{children}</p>;
}

/** "Mon, Jan 11, 2027" and "9:00 AM–7:00 PM PT"; a range across days. */
function DateRow({ startsAt, endsAt }: { startsAt: string | null; endsAt: string | null }) {
  const day = (value: string | null) =>
    formatEventDate(value, { weekday: "short", month: "short" });
  const start = day(startsAt);
  const startTime = formatEventTime(startsAt);
  const endTime = formatEventTime(endsAt);
  const laterDay = endsOnLaterDay(startsAt, endsAt);

  return (
    <EventDetailRow icon={Calendar}>
      <Fact>
        {start ?? "Date to be announced"}
        {start && laterDay ? ` – ${day(endsAt)}` : null}
      </Fact>
      {startTime ? (
        <Detail>
          {endTime
            ? laterDay
              ? `${startTime} – ${endTime} PT`
              : `${startTime}–${endTime} PT`
            : `${startTime} PT`}
        </Detail>
      ) : null}
    </EventDetailRow>
  );
}

/**
 * "Building, room" with the address under it. The address opens the map
 * when there's one (it replaces "View on map").
 */
function VenueRow({
  location,
  fallbackBuilding,
}: {
  location: ParticipantLocation | null;
  fallbackBuilding: string | null;
}) {
  if (location?.restricted) {
    return (
      <EventDetailRow icon={MapPin}>
        <Fact>{location.public_summary || "Location to be announced"}</Fact>
        <Detail>Exact location shared once you’re going</Detail>
      </EventDetailRow>
    );
  }

  const venue = [location?.building, location?.room].filter(Boolean).join(", ");
  const address = location?.address;
  const map = safeLink(location?.map_url);

  return (
    <EventDetailRow icon={MapPin}>
      <Fact>{venue || address || fallbackBuilding || "Location to be announced"}</Fact>
      {venue && address ? (
        map ? (
          <a
            href={map}
            target="_blank"
            rel="noopener noreferrer"
            className="text-small text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {address}
            {OPENS_IN_NEW_TAB}
          </a>
        ) : (
          <Detail>{address}</Detail>
        )
      ) : null}
    </EventDetailRow>
  );
}

/** "Online · Zoom", "Join meeting", then the meeting ID and passcode to copy. */
function OnlineRow({ location }: { location: ParticipantLocation }) {
  if (location.restricted) {
    return (
      <EventDetailRow icon={Video}>
        <Fact>Online</Fact>
        <Detail className="flex items-start gap-1.5">
          <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          Meeting link shared once you’re going
        </Detail>
      </EventDetailRow>
    );
  }

  const meeting = safeLink(location.meeting_url);
  const platform = meetingPlatform(meeting);

  return (
    <EventDetailRow icon={Video}>
      <Fact>{platform ? `Online · ${platform}` : "Online"}</Fact>
      {meeting ? (
        <a
          href={meeting}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-small font-medium text-foreground underline-offset-2 hover:underline"
        >
          Join meeting
          {OPENS_IN_NEW_TAB}
        </a>
      ) : null}
      {location.meeting_id || location.meeting_passcode ? (
        <div className="flex flex-col gap-1 pt-1">
          {location.meeting_id ? (
            <CopyLine label="Meeting ID" value={location.meeting_id} copyLabel="Copy meeting ID" />
          ) : null}
          {location.meeting_passcode ? (
            <CopyLine label="Passcode" value={location.meeting_passcode} copyLabel="Copy passcode" />
          ) : null}
        </div>
      ) : null}
    </EventDetailRow>
  );
}

function CopyLine({ label, value, copyLabel }: { label: string; value: string; copyLabel: string }) {
  return (
    <div className="flex items-center gap-0.5">
      <p className="text-label font-normal text-muted-foreground">
        {label} {value}
      </p>
      <CopyValueButton value={value} label={copyLabel} />
    </div>
  );
}

/** "Event website" and the address itself, underlined. */
function WebsiteRow({ website }: { website: EventWebsite }) {
  const className = "self-start text-small text-foreground underline underline-offset-2";
  return (
    <EventDetailRow icon={Globe}>
      <Fact>Event website</Fact>
      {website.kind === "external" ? (
        <a href={website.href} target="_blank" rel="noopener noreferrer" className={className}>
          {website.display}
          {OPENS_IN_NEW_TAB}
        </a>
      ) : (
        <Link href={website.href} className={className}>
          {website.display}
        </Link>
      )}
    </EventDetailRow>
  );
}

function safeLink(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

/** "ubcuxhub.ca/ux-conference": the address without the scheme or a trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}
