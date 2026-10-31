"use client";

import { EventCard, EventCardDates } from "@/components/shared/EventCard";
import { STATUSES, type Status } from "@/components/ui/status-badge";
import { EventTimeline } from "@/features/events/components/EventTimeline";
import {
  datetimeLocalToTimestamptz,
  formatEventDateTimeLines,
  type EventDateLine,
} from "@/lib/date";
import type { EventRow } from "@/lib/supabase/models";

import { Composition, Specimen, SpecimenGroup } from "../_gallery/Specimen";
import type { GallerySection } from "../_gallery/types";

const HREF = "/dev/components?section=events";
// Inline art, so the gallery needs no network and the crop is easy to judge.
const ART_A = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%233A5FC4'/%3E%3Cstop offset='1' stop-color='%23B67FC6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='160' fill='url%28%23g%29'/%3E%3Ccircle cx='118' cy='46' r='26' fill='white' fill-opacity='.25'/%3E%3Crect x='24' y='96' width='88' height='40' rx='12' fill='white' fill-opacity='.2'/%3E%3C/svg%3E";
const ART_B = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23325DC4'/%3E%3Cstop offset='1' stop-color='%237C9CE3'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='160' fill='url%28%23g%29'/%3E%3Ccircle cx='118' cy='46' r='26' fill='white' fill-opacity='.25'/%3E%3Crect x='24' y='96' width='88' height='40' rx='12' fill='white' fill-opacity='.2'/%3E%3C/svg%3E";
const IMAGE = { src: ART_A };

// Figma's example: one event over two days, each day with its own hours.
const TWO_DAYS: EventDateLine[] = [
  { day: "Sat, Jan 9", time: "9:00 AM–7:00 PM" },
  { day: "Sun, Jan 10", time: "9:00 AM–3:00 PM" },
];
const ONE_DAY: EventDateLine[] = [{ day: "Sat, Jan 9", time: "9:00 AM–7:00 PM" }];

const at = (local: string) => datetimeLocalToTimestamptz(local);

function fixture(
  id: string,
  name: string,
  venue: string,
  starts: string,
  ends: string,
  image: string | null = null,
): EventRow {
  return {
    id,
    slug: id,
    name,
    location_building: venue,
    location_room: null,
    starts_at: at(starts),
    ends_at: at(ends),
    image_url: image,
  } as EventRow;
}

const UXATHON = fixture(
  "uxathon",
  "UXathon",
  "UBC Henry Angus (ANGU)",
  "2027-01-09T09:00",
  "2027-01-10T15:00",
  ART_A,
);
const CONFERENCE = fixture(
  "ux-conference",
  "UX Conference",
  "UBC Nest Great Hall",
  "2027-01-11T09:00",
  "2027-01-11T19:00",
);
const WORKSHOP = fixture(
  "figma-workshop",
  "Intro to Figma Workshop",
  "UBC Hennings 200",
  "2027-01-25T17:30",
  "2027-01-25T19:30",
);
const PORTFOLIO = fixture(
  "portfolio-night",
  "Portfolio Night",
  "UBC Nest Room 3300",
  "2027-01-30T18:00",
  "2027-02-02T21:00",
  ART_B,
);
const MIXER = fixture(
  "spring-mixer",
  "Spring Industry Mixer",
  "UBC Robson Square",
  "2027-02-18T17:00",
  "2027-02-18T20:00",
);
const PAST = [
  fixture(
    "fall-kickoff",
    "Fall Kickoff",
    "UBC Nest Great Hall",
    "2026-09-15T17:00",
    "2026-09-15T20:00",
  ),
  fixture(
    "design-crit",
    "Design Crit Night",
    "UBC Hennings 200",
    "2026-10-06T18:00",
    "2026-10-06T20:00",
  ),
];

const MEMBER_STATUS: Record<string, Status> = {
  uxathon: "registration_open",
  "ux-conference": "waitlisted",
  "figma-workshop": "going",
};

function Dates({ lines }: { lines: readonly EventDateLine[] }) {
  return <EventCardDates lines={lines} />;
}

function Section() {
  return (
    <div className="flex flex-col gap-8">
      <SpecimenGroup
        title="EventCard states"
        description="The whole card is one link named by its title. Hover changes the fill only; nothing lifts."
      >
        <Specimen label="default" wide bare>
          <EventCard
            className="w-full"
            title="UXathon"
            href={HREF}
            venue="UBC Henry Angus (ANGU)"
            when={<Dates lines={TWO_DAYS} />}
            status="registration_open"
            image={IMAGE}
          />
        </Specimen>
        <Specimen label="hover (forced)" wide bare>
          <EventCard
            className="w-full bg-section"
            title="UXathon"
            href={HREF}
            venue="UBC Henry Angus (ANGU)"
            when={<Dates lines={TWO_DAYS} />}
            status="registration_open"
            image={IMAGE}
          />
        </Specimen>
        <Specimen label="focus (forced)" wide bare className="p-1.5">
          <EventCard
            className="w-full focus-ring"
            title="UXathon"
            href={HREF}
            venue="UBC Henry Angus (ANGU)"
            when={<Dates lines={TWO_DAYS} />}
            status="registration_open"
            image={IMAGE}
          />
        </Specimen>
        <Specimen label="no image: calendar fallback" wide bare>
          <EventCard
            className="w-full"
            title="UX Conference"
            href={HREF}
            venue="UBC Nest Great Hall"
            when={<Dates lines={ONE_DAY} />}
            status="waitlisted"
          />
        </Specimen>
        <Specimen label="long title wraps; long venue wraps" wide bare>
          <EventCard
            className="w-full"
            title="The Annual UBC UX Hub Cross-Disciplinary Design, Research and Product Leadership Conference"
            href={HREF}
            venue="UBC Robert H. Lee Alumni Centre, Great Hall and Adjoining Mezzanine Rooms"
            when={<Dates lines={TWO_DAYS} />}
            status="full"
            image={IMAGE}
          />
        </Specimen>
        <Specimen label="no venue, no status" wide bare>
          <EventCard
            className="w-full"
            title="Coffee Chat"
            href={HREF}
            when={<Dates lines={ONE_DAY} />}
          />
        </Specimen>
      </SpecimenGroup>

      <SpecimenGroup
        title="Every StatusBadge"
        description="One badge per card, always the large size."
        min="min(26rem, 100%)"
      >
        {STATUSES.map((status) => (
          <Specimen key={status} label={status} bare>
            <EventCard
              className="w-full"
              title="UXathon"
              href={HREF}
              venue="UBC Henry Angus (ANGU)"
              when={<Dates lines={ONE_DAY} />}
              status={status}
            />
          </Specimen>
        ))}
      </SpecimenGroup>

      <Composition
        title="EventTimeline (the portal's timeline)"
        description="The real portal component on fixture events, with a badge per card from statusFor. Upcoming, grouped by month: a date marker on the dashed rail, then the card. Turn on Show Past Events to see the past list. On phones the rail hides and the date sits above the card."
      >
        <div className="mx-auto w-full max-w-5xl">
          <EventTimeline
            upcomingEvents={[UXATHON, CONFERENCE, WORKSHOP, PORTFOLIO, MIXER]}
            pastEvents={PAST}
            statusFor={(event) => MEMBER_STATUS[event.id] ?? null}
          />
        </div>
      </Composition>

      <Composition
        title="Date helpers"
        description="formatEventDateTimeLines: a same-day event is one time range; a multi-day event shows the start day and the end day."
      >
        <ul className="flex flex-col gap-1 text-small text-muted-foreground">
          {[UXATHON, CONFERENCE, PORTFOLIO].map((event) => (
            <li key={event.id}>
              {event.name}:{" "}
              {formatEventDateTimeLines(event.starts_at, event.ends_at)
                .map((line) => `${line.day} ${line.time}`)
                .join(" – ")}
            </li>
          ))}
        </ul>
      </Composition>
    </div>
  );
}

const section: GallerySection = {
  id: "events",
  title: "Event cards and timeline",
  spec: "§3.5, §3.9",
  layout: "split",
  Component: Section,
};

export default section;
