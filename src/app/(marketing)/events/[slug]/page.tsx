"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { EventRow } from "@/types/models";
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

function formatDate(date: string | null | undefined) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(time: string | null | undefined) {
  if (!time) return null;
  try {
    if (time.includes("T")) {
      return new Date(time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${display}:${m} ${suffix}`;
  } catch {
    return time;
  }
}

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

/* ─── page component ─── */

export default function EventDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const supabase = useMemo(() => createClient(), []);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [registrationCount, setRegistrationCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMentor, setHoveredMentor] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;

    async function fetchEvent() {
      setLoading(true);
      setError(null);

      // Try slug first, then fallback to id
      const slugResult = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      let data = slugResult.data;
      let fetchError = slugResult.error;

      if (!data && !fetchError) {
        const idResult = await supabase
          .from("events")
          .select("*")
          .eq("id", slug)
          .maybeSingle();
        data = idResult.data;
        fetchError = idResult.error;
      }

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setError("Event not found");
        setLoading(false);
        return;
      }

      setEvent(data);

      const { count } = await supabase
        .from("event_registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", data.id);

      setRegistrationCount(count ?? 0);
      setLoading(false);
    }

    fetchEvent();
  }, [slug, supabase]);

  /* ── Loading ── */
  if (loading) {
    return (
      <main className="bg-white min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-black border-t-transparent" />
        </div>
      </main>
    );
  }

  /* ── Error / Not found ── */
  if (error || !event) {
    return (
      <main className="bg-white min-h-screen">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-gray-500 text-lg">{error || "Event not found"}</p>
          <Link
            href="/events"
            className="flex items-center gap-2 text-black font-medium hover:underline"
          >
            <ArrowLeft size={18} />
            Back to Events
          </Link>
        </div>
        <div className="pt-16">
          <Footer />
        </div>
      </main>
    );
  }

  /* ── Derived data ── */
  const regStatus = getRegistrationStatus(event);
  const spotsLeft = event.max_capacity - registrationCount;
  const isFree = Number(event.regular_price) === 0;
  const hasMemberPrice =
    event.member_price !== null &&
    event.member_price !== undefined &&
    Number(event.member_price) !== Number(event.regular_price);

  const startDateFormatted = formatDate(event.start_date);
  const startTimeFormatted = formatTime(event.start_time);
  const endTimeFormatted = formatTime(event.end_time);
  const locationDisplay = [event.location_building, event.location_room]
    .filter(Boolean)
    .join(", ");

  const mentors = parseMentors(event.mentors);
  const agenda = parseAgenda(event.agenda);
  const descriptionImages = event.description_images ?? [];
  const sponsorLogos = event.sponsor_logos ?? [];

  return (
    <main className="bg-white min-h-screen">
      <Navbar />

      {/* ────────────────────── HERO SECTION ────────────────────── */}
      <section className="mt-[80px] px-[5%] md:px-[10%] lg:px-[15%] pt-8 pb-12">
        {/* Back link */}
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          All Events
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: Hero Image */}
          <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100">
            {event.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.image_url}
                alt={event.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 flex items-center justify-center">
                <Calendar size={64} className="text-gray-300" />
              </div>
            )}
          </div>

          {/* Right: Event Info */}
          <div className="flex flex-col gap-5">
            <h1 className="text-3xl md:text-4xl font-bold text-black leading-tight">
              {event.name}
            </h1>

            <p className="text-gray-600 text-[15px] leading-relaxed line-clamp-4">
              {event.description}
            </p>

            {/* Price badge */}
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 bg-gray-100 rounded-lg px-4 py-2">
                <DollarSign size={16} className="text-gray-500" />
                <span className="font-semibold text-black">
                  {isFree
                    ? "Free"
                    : `$${Number(event.regular_price).toFixed(2)}`}
                </span>
              </div>
              {hasMemberPrice && (
                <span className="text-sm text-gray-500">
                  Members:{" "}
                  <span className="font-semibold text-green-700">
                    {Number(event.member_price) === 0
                      ? "Free"
                      : `$${Number(event.member_price).toFixed(2)}`}
                  </span>
                </span>
              )}
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100">
                <Calendar size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="font-medium">{startDateFormatted || "TBD"}</p>
                {startTimeFormatted && (
                  <p className="text-gray-500 text-xs">
                    {startTimeFormatted}
                    {endTimeFormatted && ` – ${endTimeFormatted}`}
                  </p>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100">
                <MapPin size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="font-medium">{locationDisplay || "TBD"}</p>
                {event.location_address_url && (
                  <a
                    href={event.location_address_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs"
                  >
                    View on map
                  </a>
                )}
              </div>
            </div>

            {/* Register Button */}
            {regStatus === "open" && spotsLeft > 0 ? (
              <Link
                href={`/portal/events/${event.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-black text-white font-bold text-sm px-8 py-3 hover:bg-gray-800 transition-all duration-200 w-fit mt-2"
              >
                Register Now
              </Link>
            ) : regStatus === "upcoming" ? (
              <button
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-200 text-gray-400 font-bold text-sm px-8 py-3 cursor-not-allowed w-fit mt-2"
              >
                Registration Opens Soon
              </button>
            ) : (
              <button
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-200 text-gray-400 font-bold text-sm px-8 py-3 cursor-not-allowed w-fit mt-2"
              >
                {spotsLeft <= 0 ? "Event Full" : "Registration Closed"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ────────────────────── EVENT DESCRIPTION ────────────────────── */}
      <section className="px-[5%] md:px-[10%] lg:px-[15%] py-12 border-t border-gray-100">
        <h2 className="text-2xl font-bold text-black mb-6">
          Event Description
        </h2>
        <p className="text-gray-600 text-[15px] leading-relaxed whitespace-pre-wrap mb-8 max-w-3xl">
          {event.description}
        </p>

        {/* Description gallery */}
        {descriptionImages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {descriptionImages.map((img, i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100"
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
        <section className="px-[5%] md:px-[10%] lg:px-[15%] py-12 border-t border-gray-100">
          <h2 className="text-2xl font-bold text-black mb-8">Mentors</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
            {mentors.map((mentor, i) => (
              <div
                key={i}
                className="relative group"
                onMouseEnter={() => setHoveredMentor(i)}
                onMouseLeave={() => setHoveredMentor(null)}
              >
                {/* Mentor photo */}
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer">
                  {mentor.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mentor.image_url}
                      alt={mentor.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-3xl font-bold">
                      {mentor.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Hover card */}
                {hoveredMentor === i && (
                  <div className="absolute z-20 bottom-0 left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-200 p-4 transform translate-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-bold text-sm text-black">
                          {mentor.name}
                        </p>
                        {(mentor.role || mentor.company) && (
                          <p className="text-xs text-gray-500">
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
                          className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                        >
                          <Linkedin size={16} />
                        </a>
                      )}
                    </div>
                    {mentor.bio && (
                      <p className="text-xs text-gray-500 line-clamp-3">
                        {mentor.bio}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ────────────────────── AGENDA ────────────────────── */}
      {agenda.length > 0 && (
        <section className="px-[5%] md:px-[10%] lg:px-[15%] py-12 border-t border-gray-100">
          <h2 className="text-2xl font-bold text-black mb-8">Agenda</h2>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {agenda.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-6 px-5 py-4 ${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50"
                } ${i < agenda.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <span className="text-sm font-semibold text-black whitespace-nowrap min-w-[80px]">
                  {item.time}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.room && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {item.room}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ────────────────────── SPONSORS ────────────────────── */}
      {sponsorLogos.length > 0 && (
        <section className="px-[5%] md:px-[10%] lg:px-[15%] py-12 border-t border-gray-100">
          <h2 className="text-2xl font-bold text-black mb-8">Sponsors</h2>

          <div className="flex flex-wrap items-center gap-6">
            {sponsorLogos.map((logo, i) => (
              <div
                key={i}
                className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center p-2"
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
      )}

      {/* ────────────────────── LOCATION ────────────────────── */}
      {(locationDisplay || event.location_address_url) && (
        <section className="px-[5%] md:px-[10%] lg:px-[15%] py-12 border-t border-gray-100">
          <h2 className="text-2xl font-bold text-black mb-8">Location</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Map embed or static image */}
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
              {event.location_address_url ? (
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    locationDisplay || ""
                  )}&output=embed`}
                  className="w-full h-full border-0"
                  loading="lazy"
                  title="Event location map"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <MapPin size={48} />
                </div>
              )}
            </div>

            {/* Address info */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-black">Address</h3>
              {locationDisplay && (
                <p className="text-gray-600 text-[15px] leading-relaxed">
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
                <a
                  href={event.location_address_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-black text-white font-bold text-sm px-6 py-2.5 hover:bg-gray-800 transition-all duration-200"
                >
                  <ExternalLink size={14} />
                  Directions
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ────────────────────── FOOTER ────────────────────── */}
      <div className="pt-16">
        <Footer />
      </div>
    </main>
  );
}
