import { cache, type ReactNode } from "react";
import type { Metadata } from "next";
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
import { Separator } from "@/components/ui/separator";
import { fetchEventParticipantContent } from "@/lib/supabase-helpers/event-agenda";
import { EventAgendaTable } from "@/features/events/components/EventAgendaTable";
import { EventPageHeader } from "@/features/events/components/EventPageHeader";
import { EventPeopleCard } from "@/features/events/components/EventPeopleCard";
import {
  EventFactList,
  priceFact,
  registrationFact,
  type EventFact,
  type RegistrationWindow,
} from "@/features/events/components/EventFactList";
import { EventLocation } from "@/components/shared/EventLocation";
import { fetchEventBySlug } from "@/lib/supabase-helpers/events";
import { publicMarketingDestination } from "@/lib/event-marketing";
import { fetchEventSeatCounts } from "@/lib/supabase-helpers/event-tickets";
import {
  fetchEventPeopleSections,
  fetchEventSponsors,
} from "@/lib/supabase-helpers/event-people";
import type { EventStatus } from "@/lib/supabase/models";
import { endsOnLaterDay, formatEventDate, formatEventTime } from "@/lib/date";
import { EventRegistrationAction } from "@/features/events/components/EventRegistrationAction";
import { eventStateFor, loadEventStates, type EventState } from "@/features/events/lib/event-states";
import { publicEventActionFor } from "@/features/events/lib/public-event-action";
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

/** One titled block below the hero. `id` makes it a link target. */
function PageSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-28">
      <h2 id={id ? `${id}-title` : undefined} className="mb-6 text-h2">{title}</h2>
      {children}
    </section>
  );
}

/** The registration row's window, from the event's own state. `null`: no row. */
function registrationWindowFor(state: EventState): RegistrationWindow | null {
  switch (state.kind) {
    case "reg-upcoming":
    case "app-upcoming":
      return "upcoming";
    case "reg-open":
    case "app-open":
      return "open";
    default:
      return null;
  }
}

/** The event, read once per request by both the metadata and the page. */
const loadEvent = cache(async (slug: string, status: EventStatus) =>
  fetchEventBySlug(await createClient(), slug, { status })
);

// Viewer-specific location projections must never enter the shared page cache.
export const dynamic = "force-dynamic";

interface EventDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

/**
 * The event's name, summary and image for the tab and link previews. Only a
 * published event with a page here gets its own; a draft preview names
 * nothing before the page checks the viewer is an admin.
 */
export async function generateMetadata({
  params,
  searchParams,
}: EventDetailPageProps): Promise<Metadata> {
  if ((await searchParams).preview === "draft") {
    return { title: "Draft preview · UBC UX Hub", robots: { index: false } };
  }
  if (!FLAGS.studentEvents) return {};
  const event = await loadEvent((await params).slug, "active");
  if (!event || publicMarketingDestination(event).kind !== "hosted") return {};

  const description = event.short_description || undefined;
  const image = event.header_image_url || event.image_url;
  return {
    title: `${event.name} · UBC UX Hub`,
    description,
    openGraph: {
      type: "website",
      title: event.name,
      description,
      siteName: "UBC UX Hub",
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: event.name,
      description,
      images: image ? [image] : undefined,
    },
  };
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
  const event = await loadEvent(slug, preview ? "draft" : "active");
  if (!event) notFound();
  if (!preview) {
    const destination = publicMarketingDestination(event);
    if (destination.kind === "none") notFound();
    if (destination.kind === "external") redirect(destination.url);
  }
  if (preview && (event.configured_marketing_mode === "disabled" || event.configured_marketing_mode === "external")) notFound();
  const unfinished = preview && !!eventWorkingDocument(event);
  const [seatCounts, peopleSections, sponsors, participant, current] = await Promise.all([
    fetchEventSeatCounts(supabase, [event.id]),
    // Admins switch these sections off per event, as on the portal event page.
    !unfinished && event.mentors_enabled ? fetchEventPeopleSections(supabase, event.id) : [],
    !unfinished && event.sponsors_enabled ? fetchEventSponsors(supabase, event.id) : [],
    fetchEventParticipantContent(supabase, event.id),
    // The viewer, for their own registration state. A preview never registers.
    preview ? null : loadCurrentUser(),
  ]);

  /* ── Derived data ── */
  const now = new Date();
  // Held offers count as taken (docs/event-states.md, "Seats"). `null`: no
  // capacity, so no limit.
  const spotsLeft = seatCounts.get(event.id)?.seatsLeft ?? event.max_capacity;
  // The event's own state, as a signed-out visitor sees it, decided by the
  // portal's rules (`eventStateFor`), so the two pages always agree. The facts
  // describe the event; the button follows the viewer.
  const eventState = eventStateFor(event, { ticket: null, application: null, seatsLeft: spotsLeft }, now);
  const viewerState = current?.status === "authenticated"
    ? (await loadEventStates(supabase, current.user.id, [event], now))[event.id]
    : eventState;
  // Until it ends; then the page reads as any past event's.
  const canceled = eventState.kind === "canceled";
  const ended = eventState.kind === "reg-past";

  const startDateFormatted = formatEventDate(event.starts_at, {
    weekday: "long",
  });
  // A 7 PM to 1 AM social is one day, as on the timeline card.
  const endDateFormatted = endsOnLaterDay(event.starts_at, event.ends_at)
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
  const registrationWindow = registrationWindowFor(eventState);
  const registration = registrationWindow && registrationFact({
    window: registrationWindow,
    opensAt: event.registration_opens_at,
    closesAt: "closesAt" in eventState ? eventState.closesAt : null,
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
            {preview
              ? <Button disabled className="self-start">Registration unavailable in draft preview</Button>
              : <EventRegistrationAction action={publicEventActionFor(viewerState, event.slug ?? slug)} />}
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

          {/* ────────────────────── PEOPLE AND SPONSORS ────────────────────── */}
          {/* One card per people section (Judges, Mentors, Speakers, Panelists
              or a custom title), in the builder's order, as on the portal. */}
          {peopleSections.map((section) => (
            <EventPeopleCard key={section.id} type="people" title={section.title} people={section.people} headingAs="h2" />
          ))}
          <EventPeopleCard type="sponsors" people={sponsors} headingAs="h2" />

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
