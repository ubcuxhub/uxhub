import { EventDescription } from "@/components/shared/EventDescription";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadCurrentUser } from "@/lib/auth/current-user";
import { hasAdminAccess } from "@/lib/auth/roles";
import { EventDraftSections } from "@/features/events/components/EventDraftSections";
import { eventWorkingDocument } from "@/features/admin/lib/event-presentation";
import { Alert } from "@/components/ui/alert";
import { BackPill } from "@/components/shared/BackButton";
import { FLAGS } from "@/lib/flags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchEventParticipantContent } from "@/lib/supabase-helpers/event-agenda";
import { EventAgendaTable } from "@/features/events/components/EventAgendaTable";
import { EventPageHeader } from "@/features/events/components/EventPageHeader";
import { EventLocation } from "@/components/shared/EventLocation";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { publicMarketingDestination } from "@/lib/event-marketing";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";
import {
  fetchEventMentors,
  fetchEventSponsors,
} from "@/lib/supabase-helpers/event-people";
import type { EventRow } from "@/lib/supabase/models";
import { formatEventDate, formatEventTime, pacificDate } from "@/lib/date";
import { EventRegistrationAction } from "@/features/events/components/EventRegistrationAction";
import { isCanceledEvent } from "@/features/events/lib/event-cancellation";
import { StatusBadge } from "@/components/ui/status-badge";
import Navbar from "@/features/marketing/homepage-sections/Navbar";
import Footer from "@/features/marketing/homepage-sections/Footer";
import {
  Calendar,
  MapPin,
  ExternalLink,
  DollarSign,
} from "lucide-react";
import { FaLinkedin } from "react-icons/fa6";

function getRegistrationStatus(event: EventRow) {
  const now = new Date();
  const regStart = event.registration_opens_at
    ? new Date(event.registration_opens_at)
    : null;
  const regEnd = event.registration_closes_at
    ? new Date(event.registration_closes_at)
    : null;
  if (regStart && now < regStart) return "upcoming";
  if (regEnd && now > regEnd) return "closed";
  return "open";
}

// Viewer-specific location projections must never enter the shared page cache.
export const dynamic = "force-dynamic";

interface EventDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export default async function EventDetailPage({
  params,
  searchParams,
}: EventDetailPageProps) {
  noStore();
  const preview = (await searchParams).preview === "draft";
  if (preview) {
    const current = await loadCurrentUser();
    if (current.status !== "authenticated" || !hasAdminAccess(current.user.role_access)) notFound();
  } else if (!FLAGS.studentEvents) redirect("/#events");

  const { slug } = await params;
  const supabase = await createClient();
  const event = await fetchEventBySlug(supabase, slug, { status: preview ? "draft" : "active" });
  if (!event) notFound();
  if (!preview) {
    const destination = publicMarketingDestination(event);
    if (destination.kind === "none") notFound();
    if (destination.kind === "external") redirect(destination.url);
  }
  if (preview && (event.configured_marketing_mode === "disabled" || event.configured_marketing_mode === "external")) notFound();
  const unfinished = preview && !!eventWorkingDocument(event);
  const [seatCounts, mentors, sponsors, participant] = await Promise.all([
    fetchEventSeatCounts(supabase, [event.id]),
    fetchEventMentors(supabase, event.id),
    fetchEventSponsors(supabase, event.id),
    fetchEventParticipantContent(supabase, event.id),
  ]);

  /* ── Derived data ── */
  const regStatus = getRegistrationStatus(event);
  // Until it ends; then the page reads as any past event's.
  const canceled = isCanceledEvent(event);
  // Held offers count as taken (docs/event-states.md, "Seats").
  const spotsLeft = seatCounts.get(event.id)?.seatsLeft ?? event.max_capacity ?? 0;
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

  const startDateFormatted = formatEventDate(event.starts_at, {
    weekday: "long",
  });
  const endDateFormatted = event.ends_at && pacificDate(event.ends_at) !== pacificDate(event.starts_at)
    ? formatEventDate(event.ends_at, { weekday: "long" })
    : null;
  const startTimeFormatted = formatEventTime(event.starts_at);
  const endTimeFormatted = formatEventTime(event.ends_at);
  const locationBuilding = participant.location
    ? participant.location.restricted ? participant.location.public_summary : participant.location.building ?? "Online"
    : event.location_building;
  const locationRoom = participant.location ? participant.location.room : event.location_room;
  const locationMap = participant.location ? participant.location.map_url : event.location_address_url;
  const locationDisplay = [locationBuilding, locationRoom]
    .filter(Boolean)
    .join(", ");

  const descriptionImages = event.description_images ?? [];

  return (
    <main className="min-h-screen">
      <Navbar />

      <div className="font-sans text-body text-foreground">
        {/* ────────────────────── HERO SECTION ────────────────────── */}
        <section className="mt-20 px-[5%] pb-12 pt-8 md:px-[10%] lg:px-[15%]">
        {preview && <Alert className="mb-6">Draft preview: only admins and managers can see this. Registration and applications are disabled.</Alert>}
        {/* The portal event page's 4:1 header, without the icon, so a header crops the same in both. */}
        {(event.header_image_url || event.header_colour) && <EventPageHeader className="mb-6 overflow-hidden rounded-xl" imageSrc={event.header_image_url ?? undefined} colour={event.header_colour ?? undefined} />}
        {/* Back link */}
        <BackPill href="/events" label="Back to Events" className="mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: Hero Image */}
          <div className="aspect-4/3 w-full overflow-hidden rounded-2xl bg-muted">
            {event.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.image_url}
                alt={event.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <Calendar className="size-5 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Right: Event Info */}
          <div className="flex flex-col gap-5">
            <h1 className="text-h1">{event.name}</h1>

            {canceled && (
              <div className="flex flex-col items-start gap-2">
                <StatusBadge status="canceled" size="large" />
                <p className="text-muted-foreground">
                  {event.cancellation_note || "This event has been canceled."}
                </p>
              </div>
            )}

            <p className="line-clamp-4 text-muted-foreground">
              {event.short_description || event.description}
            </p>

            {/* Price badge */}
            <div className="flex items-center gap-3">
              <Badge variant="neutral" size="large">
                <DollarSign className="text-muted-foreground" />
                <span>
                  {event.regular_price == null ? "Price to be confirmed" : isFree
                    ? "Free"
                    : `$${Number(event.regular_price).toFixed(2)}`}
                </span>
              </Badge>
              {hasMemberPrice && (
                <span className="text-small text-muted-foreground">
                  Members:{" "}
                  <span className="text-success-foreground">
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
                <Calendar className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p>{startDateFormatted || "TBD"}{endDateFormatted ? ` – ${endDateFormatted}` : ""}</p>
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
                <MapPin className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p>{locationDisplay || "TBD"}</p>
                {locationMap && (
                  <a
                    href={locationMap}
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
            {preview ? <Button disabled>Registration unavailable in draft preview</Button> : canceled ? <Button disabled className="self-start">Event canceled</Button> : <EventRegistrationAction
              eventId={event.id}
              eventSlug={event.slug ?? slug}
              registrationAvailable={canRegister}
              unavailableLabel={registerLabel}
            />}
          </div>
        </div>
        </section>

        {/* ────────────────────── EVENT DESCRIPTION ────────────────────── */}
        <Separator />
        <section className="px-[5%] py-12 md:px-[10%] lg:px-[15%]">
        <h2 className="mb-6 text-h2">Event Description</h2>
        <div className="mb-8 max-w-3xl"><EventDescription rich={event.description_rich} text={event.description ?? ""} /></div>
        {preview && <EventDraftSections event={event} />}

        {/* Description gallery */}
        {descriptionImages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {descriptionImages.map((img, i) => (
              <div
                key={i}
                className="aspect-4/3 overflow-hidden rounded-xl bg-muted"
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
      {!unfinished && event.mentors_enabled && mentors.length > 0 && (
        <>
          <Separator />
          <section className="px-[5%] py-12 md:px-[10%] lg:px-[15%]">
          <h2 className="mb-8 text-h2">Mentors</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
            {mentors.map((mentor, i) => (
              <div key={i} className="relative group">
                {/* Mentor photo */}
                <div className="aspect-square cursor-pointer overflow-hidden rounded-xl bg-muted">
                  {mentor.profile_image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mentor.profile_image_path}
                      alt={mentor.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-h1 text-muted-foreground">
                      {mentor.full_name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Hover card */}
                  <Card className="pointer-events-none absolute inset-x-0 bottom-0 z-20 translate-y-2 gap-0 p-4 opacity-0 shadow-lg transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-table">
                          {mentor.full_name}
                        </p>
                        {mentor.position && (
                          <p className="text-small text-muted-foreground">
                            {mentor.position}
                          </p>
                        )}
                      </div>
                      {mentor.linkedin_url && (
                        <a
                          href={mentor.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                            className="shrink-0 text-primary hover:text-primary-hover"
                        >
                          <FaLinkedin size={24} />
                        </a>
                      )}
                    </div>
                    {mentor.description && (
                      <p className="line-clamp-3 text-small text-muted-foreground">
                        {mentor.description}
                      </p>
                    )}
                  </Card>
              </div>
            ))}
          </div>
          </section>
        </>
      )}

      {participant.agenda.length > 0 && <>
        <Separator />
        <section className="px-[5%] py-12 md:px-[10%] lg:px-[15%]">
          <EventAgendaTable eventName={event.name} agenda={participant.agenda} />
        </section>
      </>}

      {/* ────────────────────── SPONSORS ────────────────────── */}
      {!unfinished && event.sponsors_enabled && sponsors.length > 0 && (
        <>
          <Separator />
          <section className="px-[5%] py-12 md:px-[10%] lg:px-[15%]">
          <h2 className="mb-8 text-h2">Sponsors</h2>

          <div className="flex flex-wrap items-center gap-6">
            {sponsors.map((sponsor, i) => (
              <div
                key={i}
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-muted p-2"
              >
                {sponsor.brand_logo_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sponsor.brand_logo_path}
                    alt={sponsor.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-small text-muted-foreground">
                    {sponsor.name}
                  </span>
                )}
              </div>
            ))}
          </div>
          </section>
        </>
      )}

      {/* ────────────────────── LOCATION ────────────────────── */}
      {(locationDisplay || locationMap) && (
        <>
          <Separator />
          <section className="px-[5%] py-12 md:px-[10%] lg:px-[15%]">
          <h2 className="mb-8 text-h2">Location</h2>

          {participant.location?.type === "online" ? <EventLocation location={participant.location} /> : <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Map embed or static image */}
            <div className="pointer-events-none relative aspect-4/3 overflow-hidden rounded-xl bg-muted">
              {locationMap ? (
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
                  <MapPin className="size-5" />
                </div>
              )}
            </div>

            {/* Address info */}
            <div className="space-y-4">
              <h3 className="text-h3">Address</h3>
              {locationDisplay && (
                <p className="text-muted-foreground">
                  {locationBuilding && (
                    <>
                      {locationBuilding}
                      <br />
                    </>
                  )}
                  {locationRoom && (
                    <>
                      {locationRoom}
                      <br />
                    </>
                  )}
                </p>
              )}
              {participant.location?.address && <p className="text-muted-foreground">{participant.location.address}</p>}
              {participant.location?.type === "hybrid" && <EventLocation location={{ ...participant.location, type: "online" }} />}
              {locationMap && (
                <Button asChild>
                  <a
                    href={locationMap}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    Directions
                  </a>
                </Button>
              )}
            </div>
          </div>}
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
