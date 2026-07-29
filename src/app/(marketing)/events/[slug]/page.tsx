import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createPublicClient } from "@/lib/supabase/public";
import {
  fetchEventBySlug,
  fetchEvents,
} from "@/lib/supabase-helpers/events";
import { fetchEventRegistrationCount } from "@/lib/supabase-helpers/event-registrations";
import type { EventRow } from "@/types/models";
import { formatEventDate, formatEventTime } from "@/lib/date";
import { EventRegistrationAction } from "@/features/events/components/EventRegistrationAction";
import Navbar from "@/features/marketing/homepage-sections/Navbar";
import Footer from "@/features/marketing/homepage-sections/Footer";
import {
  Calendar,
  MapPin,
  ArrowLeft,
  ExternalLink,
  DollarSign,
  Linkedin,
} from "lucide-react";
import type { Json } from "@/lib/supabase/database.types";

/* ─── types for JSONB fields ─── */

interface Mentor {
  name: string;
  role?: string;
  company?: string;
  image_url?: string;
  linkedin_url?: string;
  bio?: string;
}

interface AgendaItem {
  time: string;
  title: string;
  description?: string;
  room?: string;
}

/* ─── helpers ─── */

function getRegistrationStatus(event: EventRow) {
  const now = new Date();
  const regStart = event.registration_start_time
    ? new Date(event.registration_start_time)
    : null;
  const regEnd = event.registration_end_time
    ? new Date(event.registration_end_time)
    : null;
  if (regStart && now < regStart) return "upcoming";
  if (regEnd && now > regEnd) return "closed";
  return "open";
}

function parseMentors(raw: Json | null): Mentor[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw as unknown as Mentor[];
}

function parseAgenda(raw: Json | null): AgendaItem[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw as unknown as AgendaItem[];
}

export const revalidate = 300;

export async function generateStaticParams() {
  const events = await fetchEvents(createPublicClient());
  return events
    .filter((event) => event.slug)
    .map((event) => ({ slug: event.slug! }));
}

interface EventDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EventDetailPage({
  params,
}: EventDetailPageProps) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const event = await fetchEventBySlug(supabase, slug);
  if (!event) notFound();
  const registrationCount = await fetchEventRegistrationCount(
    supabase,
    event.id
  );

  /* ── Derived data ── */
  const regStatus = getRegistrationStatus(event);
  const spotsLeft = event.max_capacity - registrationCount;
  const canRegister = regStatus === "open" && spotsLeft > 0;
  const registerLabel = regStatus === "upcoming"
      ? "Registration Opens Soon"
      : spotsLeft <= 0
        ? "Event Full"
        : "Registration Closed";
  const isFree = Number(event.regular_price) === 0;
  const hasMemberPrice =
    event.member_price !== null &&
    event.member_price !== undefined &&
    Number(event.member_price) !== Number(event.regular_price);

  const startDateFormatted = formatEventDate(event.start_date, {
    weekday: "long",
  });
  const startTimeFormatted = formatEventTime(event.start_time);
  const endTimeFormatted = formatEventTime(event.end_time);
  const locationDisplay = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(", ");

  const mentors = parseMentors(event.mentors);
  const agenda = parseAgenda(event.agenda);
  const descriptionImages = event.description_images ?? [];
  const sponsorLogos = event.sponsor_logos ?? [];

  return (
    <main className="min-h-screen">
      <Navbar />

      <div className="bg-background font-sans text-body text-foreground">
        {/* ────────────────────── HERO SECTION ────────────────────── */}
        <section className="mt-[80px] px-[5%] pb-12 pt-8 md:px-[10%] lg:px-[15%]">
        {/* Back link */}
        <Button asChild variant="link" className="mb-6 px-0">
          <Link href="/events">
            <ArrowLeft />
            All Events
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: Hero Image */}
          <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
            {event.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.image_url}
                alt={event.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <Calendar className="text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Right: Event Info */}
          <div className="flex flex-col gap-5">
            <h1 className="text-h1">{event.name}</h1>

            <p className="line-clamp-4 text-muted-foreground">
              {event.description}
            </p>

            {/* Price badge */}
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-2 px-4 py-2">
                <DollarSign className="text-muted-foreground" />
                <span>
                  {isFree
                    ? "Free"
                    : `$${Number(event.regular_price).toFixed(2)}`}
                </span>
              </Badge>
              {hasMemberPrice && (
                <span className="text-small text-muted-foreground">
                  Members:{" "}
                  <span className="text-success">
                    {Number(event.member_price) === 0
                      ? "Free"
                      : `$${Number(event.member_price).toFixed(2)}`}
                  </span>
                </span>
              )}
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-3 text-table">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                <Calendar className="text-muted-foreground" />
              </div>
              <div>
                <p>{startDateFormatted || "TBD"}</p>
                {startTimeFormatted && (
                  <p className="text-small text-muted-foreground">
                    {startTimeFormatted}
                    {endTimeFormatted && ` – ${endTimeFormatted}`}
                  </p>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3 text-table">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                <MapPin className="text-muted-foreground" />
              </div>
              <div>
                <p>{locationDisplay || "TBD"}</p>
                {event.location_address_url && (
                  <a
                    href={event.location_address_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-small text-primary hover:underline"
                  >
                    View on map
                  </a>
                )}
              </div>
            </div>

            {/* Register Button */}
            <EventRegistrationAction
              eventId={event.id}
              eventSlug={event.slug ?? slug}
              registrationAvailable={canRegister}
              unavailableLabel={registerLabel}
            />
          </div>
        </div>
        </section>

        {/* ────────────────────── EVENT DESCRIPTION ────────────────────── */}
        <Separator />
        <section className="px-[5%] py-12 md:px-[10%] lg:px-[15%]">
        <h2 className="mb-6 text-h2">Event Description</h2>
        <p className="mb-8 max-w-3xl whitespace-pre-wrap text-muted-foreground">
          {event.description}
        </p>

        {/* Description gallery */}
        {descriptionImages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {descriptionImages.map((img, i) => (
              <div
                key={i}
                className="aspect-[4/3] overflow-hidden rounded-xl bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={`${event.name} gallery ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
        </section>

      {/* ────────────────────── MENTORS ────────────────────── */}
      {mentors.length > 0 && (
        <>
          <Separator />
          <section className="px-[5%] py-12 md:px-[10%] lg:px-[15%]">
          <h2 className="mb-8 text-h2">Mentors</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
            {mentors.map((mentor, i) => (
              <div key={i} className="relative group">
                {/* Mentor photo */}
                <div className="aspect-square cursor-pointer overflow-hidden rounded-xl bg-muted">
                  {mentor.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mentor.image_url}
                      alt={mentor.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-h1 text-muted-foreground">
                      {mentor.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Hover card */}
                  <Card className="pointer-events-none absolute inset-x-0 bottom-0 z-20 translate-y-2 gap-0 p-4 opacity-0 shadow-lg transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-table">
                          {mentor.name}
                        </p>
                        {(mentor.role || mentor.company) && (
                          <p className="text-small text-muted-foreground">
                            {mentor.role}
                            {mentor.role && mentor.company && " at "}
                            {mentor.company}
                          </p>
                        )}
                      </div>
                      {mentor.linkedin_url && (
                        <a
                          href={mentor.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-primary hover:text-action-hover"
                        >
                          <Linkedin />
                        </a>
                      )}
                    </div>
                    {mentor.bio && (
                      <p className="line-clamp-3 text-small text-muted-foreground">
                        {mentor.bio}
                      </p>
                    )}
                  </Card>
              </div>
            ))}
          </div>
          </section>
        </>
      )}

      {/* ────────────────────── AGENDA ────────────────────── */}
      {agenda.length > 0 && (
        <>
          <Separator />
          <section className="px-[5%] py-12 md:px-[10%] lg:px-[15%]">
          <h2 className="mb-8 text-h2">Agenda</h2>

          <Card className="gap-0 overflow-hidden py-0">
            {agenda.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-6 px-5 py-4 ${
                  i % 2 === 0 ? "bg-card" : "bg-muted/50"
                } ${i < agenda.length - 1 ? "border-b" : ""}`}
              >
                <span className="min-w-[80px] whitespace-nowrap text-table">
                  {item.time}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-table">{item.title}</p>
                  {item.description && (
                    <p className="mt-0.5 text-small text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.room && (
                  <span className="whitespace-nowrap text-small text-muted-foreground">
                    {item.room}
                  </span>
                )}
              </div>
            ))}
          </Card>
          </section>
        </>
      )}

      {/* ────────────────────── SPONSORS ────────────────────── */}
      {sponsorLogos.length > 0 && (
        <>
          <Separator />
          <section className="px-[5%] py-12 md:px-[10%] lg:px-[15%]">
          <h2 className="mb-8 text-h2">Sponsors</h2>

          <div className="flex flex-wrap items-center gap-6">
            {sponsorLogos.map((logo, i) => (
              <div
                key={i}
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-muted p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo}
                  alt={`Sponsor ${i + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
          </section>
        </>
      )}

      {/* ────────────────────── LOCATION ────────────────────── */}
      {(locationDisplay || event.location_address_url) && (
        <>
          <Separator />
          <section className="px-[5%] py-12 md:px-[10%] lg:px-[15%]">
          <h2 className="mb-8 text-h2">Location</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Map embed or static image */}
            <div className="pointer-events-none relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
              {event.location_address_url ? (
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    locationDisplay || "",
                  )}&output=embed`}
                  className="absolute border-0 w-[150%] h-[150%] -top-[25%] -left-[25%]"
                  loading="lazy"
                  title="Event location map"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex h-full w-full items-center justify-center text-muted-foreground">
                  <MapPin />
                </div>
              )}
            </div>

            {/* Address info */}
            <div className="space-y-4">
              <h3 className="text-h3">Address</h3>
              {locationDisplay && (
                <p className="text-muted-foreground">
                  {event.location_building && (
                    <>
                      {event.location_building}
                      <br />
                    </>
                  )}
                  {event.location_room && (
                    <>
                      {event.location_room}
                      <br />
                    </>
                  )}
                </p>
              )}
              {event.location_address_url && (
                <Button asChild>
                  <a
                    href={event.location_address_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    Directions
                  </a>
                </Button>
              )}
            </div>
          </div>
          </section>
        </>
      )}
      </div>

      {/* ────────────────────── FOOTER ────────────────────── */}
      <div className="pt-16">
        <Footer />
      </div>
    </main>
  );
}
