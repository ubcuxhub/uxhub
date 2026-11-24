import type { ReactNode } from "react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchEventParticipantContent } from "@/lib/supabase-helpers/event-agenda";
import { EventAgendaTable } from "@/features/events/components/EventAgendaTable";
import { EventPageHeader } from "@/features/events/components/EventPageHeader";
import {
  EventFactList,
  priceFact,
  registrationFact,
  type EventFact,
} from "@/features/events/components/EventFactList";
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
  Tag,
  Ticket,
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

/** An event is past once it ends, or once it starts if it has no end (as on the portal timeline). */
function hasEnded(event: Pick<EventRow, "starts_at" | "ends_at">, now = new Date()) {
  const end = event.ends_at ?? event.starts_at;
  return !!end && Date.parse(end) < now.getTime();
}

/** One titled block below the hero. `id` makes it a link target. */
function PageSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-28">
      <h2 id={id ? `${id}-title` : undefined} className="mb-6 text-h2">{title}</h2>
      {children}
    </section>
  );
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
  const ended = !canceled && hasEnded(event);
  // Held offers count as taken (docs/event-states.md, "Seats"). `null`: no
  // capacity, so no limit.
  const spotsLeft = seatCounts.get(event.id)?.seatsLeft ?? event.max_capacity;
  // An application event takes applicants, not a first-come count, so it is
  // never Full (as on the portal event page).
  const full = !event.requires_application && spotsLeft !== null && spotsLeft <= 0;
  // A past event is over whatever its registration dates say, so the button
  // agrees with the "Past" badge.
  const canRegister = !ended && regStatus === "open" && !full;
  const registerLabel = ended
    ? "Event ended"
    : regStatus === "upcoming"
      ? event.requires_application ? "Applications Open Soon" : "Registration Opens Soon"
      : full
        ? "Event Full"
        : event.requires_application ? "Applications Closed" : "Registration Closed";

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
  const onlineDetails = !!participant.location && !participant.location.restricted
    && participant.location.type !== "in_person"
    && !!(participant.location.meeting_url || participant.location.meeting_id || participant.location.meeting_passcode);
  // The Location section holds what the facts row can't: the map, the street
  // address and the joining details. Without any of them it would only repeat the row.
  const showLocationSection = !!locationMap || !!participant.location?.address || onlineDetails;

  const descriptionImages = event.description_images ?? [];
  const hasDescription = !!(event.description || event.description_rich);

  /* ── Key facts ── */
  const facts: EventFact[] = [
    {
      key: "date",
      icon: Calendar,
      term: "Date and time",
      value: startDateFormatted
        ? `${startDateFormatted}${endDateFormatted ? ` – ${endDateFormatted}` : ""}`
        : "Date to be announced",
      detail: startTimeFormatted
        ? `${startTimeFormatted}${endTimeFormatted ? ` – ${endTimeFormatted}` : ""}`
        : undefined,
    },
    {
      key: "location",
      icon: MapPin,
      term: "Location",
      value: <span className="whitespace-pre-wrap">{locationBuilding || "Location to be announced"}</span>,
      detail: (locationRoom || showLocationSection) ? (
        <>
          {locationRoom}
          {locationRoom && showLocationSection && " · "}
          {showLocationSection && <a href="#location" className="text-primary hover:underline">Map and directions</a>}
        </>
      ) : undefined,
    },
    { key: "price", icon: Tag, term: "Price", ...priceFact(event.regular_price, event.member_price) },
  ];
  const registration = canceled || ended ? null : registrationFact({
    window: regStatus === "open" && full ? "full" : regStatus,
    opensAt: event.registration_opens_at,
    closesAt: event.registration_closes_at,
    spotsLeft,
    capacity: event.max_capacity,
    requiresApplication: event.requires_application,
  });
  if (registration) facts.push({ key: "registration", icon: Ticket, term: "Registration", ...registration });

  return (
    <main className="min-h-screen">
      <Navbar />

      <div className="mx-auto mt-20 w-full max-w-5xl px-4 pt-8 font-sans text-body text-foreground sm:px-8">
        {preview && <Alert className="mb-6">Draft preview: only admins and managers can see this. Registration and applications are disabled.</Alert>}
        <BackPill href="/events" label="Back to Events" className="mb-6" />

        {/* ────────────────────── HERO ────────────────────── */}
        {/* The portal event page's 4:1 header, without the icon, so a header crops the same in both. */}
        {(event.header_image_url || event.header_colour) && <EventPageHeader className="mb-8 overflow-hidden rounded-xl" imageSrc={event.header_image_url ?? undefined} colour={event.header_colour ?? undefined} />}

        <section aria-labelledby="event-title" className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
          {/* The event image is square: the builder crops it 1:1, as the portal and admin drawer show it. */}
          <div className="aspect-square w-28 overflow-hidden rounded-2xl bg-muted sm:w-40 md:w-full">
            {event.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.image_url}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Calendar className="size-6 text-muted-foreground" aria-hidden />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col items-start gap-3">
              {canceled && <StatusBadge status="canceled" size="large" />}
              {ended && <StatusBadge status="past" size="large" />}
              <h1 id="event-title" className="text-h1 break-words">{event.name}</h1>
              {canceled && (
                <p className="text-muted-foreground">
                  {event.cancellation_note || "This event has been canceled."}
                </p>
              )}
              {event.short_description && (
                <p className="text-subheading text-muted-foreground">{event.short_description}</p>
              )}
            </div>

            <EventFactList facts={facts} />

            {/* Register Button */}
            {preview ? <Button disabled className="self-start">Registration unavailable in draft preview</Button> : canceled ? <Button disabled className="self-start">Event canceled</Button> : <EventRegistrationAction
              eventId={event.id}
              eventSlug={event.slug ?? slug}
              registrationAvailable={canRegister}
              requiresApplication={event.requires_application}
              unavailableLabel={registerLabel}
            />}
          </div>
        </section>

        <Separator className="my-12" />

        <div className="flex flex-col gap-16">
          {/* ────────────────────── ABOUT ────────────────────── */}
          {(hasDescription || descriptionImages.length > 0) && (
            <PageSection title="About this event">
              {hasDescription && <div className="max-w-prose"><EventDescription rich={event.description_rich} text={event.description ?? ""} /></div>}
              {descriptionImages.length > 0 && (
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {descriptionImages.map((img, i) => (
                    <div
                      key={i}
                      className="aspect-4/3 overflow-hidden rounded-xl bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={`${event.name} gallery ${i + 1}`}
                        className="size-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </PageSection>
          )}
          {preview && <EventDraftSections event={event} />}

          {/* ────────────────────── AGENDA ────────────────────── */}
          {participant.agenda.length > 0 && <EventAgendaTable eventName={event.name} agenda={participant.agenda} />}

          {/* ────────────────────── MENTORS ────────────────────── */}
          {!unfinished && event.mentors_enabled && mentors.length > 0 && (
            <PageSection title="Mentors">
              <div className="grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
                {mentors.map((mentor, i) => (
                  <div key={i} className="group relative">
                    {/* Mentor photo */}
                    <div className="aspect-square cursor-pointer overflow-hidden rounded-xl bg-muted">
                      {mentor.profile_image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mentor.profile_image_path}
                          alt={mentor.full_name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-muted text-h1 text-muted-foreground">
                          {mentor.full_name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Hover card */}
                    <Card className="pointer-events-none absolute inset-x-0 bottom-0 z-20 translate-y-2 gap-0 p-4 opacity-0 shadow-lg transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                      <div className="mb-2 flex items-start justify-between gap-2">
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
            </PageSection>
          )}

          {/* ────────────────────── SPONSORS ────────────────────── */}
          {!unfinished && event.sponsors_enabled && sponsors.length > 0 && (
            <PageSection title="Sponsors">
              <div className="flex flex-wrap items-center gap-6">
                {sponsors.map((sponsor, i) => (
                  <div
                    key={i}
                    className="flex size-24 items-center justify-center overflow-hidden rounded-xl bg-muted p-2"
                  >
                    {sponsor.brand_logo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sponsor.brand_logo_path}
                        alt={sponsor.name}
                        className="size-full object-contain"
                      />
                    ) : (
                      <span className="text-small text-muted-foreground">
                        {sponsor.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </PageSection>
          )}

          {/* ────────────────────── LOCATION ────────────────────── */}
          {showLocationSection && (
            <PageSection title="Location" id="location">
              {participant.location?.type === "online" ? <EventLocation location={participant.location} /> : <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
                {/* Map embed or static image */}
                <div className="pointer-events-none relative aspect-4/3 overflow-hidden rounded-xl bg-muted">
                  {locationMap ? (
                    <iframe
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(
                        locationDisplay || "",
                      )}&output=embed`}
                      className="absolute -top-[25%] -left-[25%] h-[150%] w-[150%] border-0"
                      loading="lazy"
                      title="Event location map"
                      allowFullScreen
                    />
                  ) : (
                    <div className="absolute inset-0 flex size-full items-center justify-center text-muted-foreground">
                      <MapPin className="size-5" aria-hidden />
                    </div>
                  )}
                </div>

                {/* Address info */}
                <div className="flex flex-col items-start gap-4">
                  {locationDisplay && (
                    <p>
                      {locationBuilding && (
                        <>
                          <span className="text-body-medium">{locationBuilding}</span>
                          <br />
                        </>
                      )}
                      {locationRoom && (
                        <span className="text-muted-foreground">{locationRoom}</span>
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
            </PageSection>
          )}
        </div>
      </div>

      {/* ────────────────────── FOOTER ────────────────────── */}
      <div className="pt-16">
        <Footer />
      </div>
    </main>
  );
}
