"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { fetchEvents } from "@/lib/supabase-helpers/events";
import { fetchPurchasesForUser } from "@/lib/supabase-helpers/purchases";
import { LogoutButton } from "@/features/auth";
import { EventCard, type EventRow } from "@/features/events";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  CalendarDays,
  History,
  Sparkles,
  User,
} from "lucide-react";

function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <div className="space-y-1.5 pt-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="pt-2">
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

function RegisteredEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <CalendarDays className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No registered events yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm">
        You haven&apos;t registered for any events yet. Browse all events to
        find something that interests you.
      </p>
    </div>
  );
}

function BecomeMemberBanner() {
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-lg border bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Become a UX Hub member</h3>
          <p className="text-sm text-muted-foreground">
            Unlock member pricing on events and exclusive perks.
          </p>
        </div>
      </div>
      <Button asChild className="shrink-0">
        <Link href="/portal/membership">
          Become a member
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function EventGrid({
  events,
  onSelect,
}: {
  events: EventRow[];
  onSelect: (event: EventRow) => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {events.map((event, index) => (
        <div
          key={event.id}
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{
            animationDelay: `${index * 75}ms`,
            animationFillMode: "backwards",
          }}
        >
          <EventCard
            event={event}
            variant="default"
            onClick={() => onSelect(event)}
          />
        </div>
      ))}
    </div>
  );
}

export default function PortalHome() {
  const { user } = useUser();
  const router = useRouter();

  const [registeredEvents, setRegisteredEvents] = useState<EventRow[]>([]);
  const [pastEvents, setPastEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadEvents(userId: string) {
      setLoading(true);
      try {
        const [events, purchases] = await Promise.all([
          fetchEvents(supabase, { orderBy: "start_date" }),
          fetchPurchasesForUser(supabase, userId),
        ]);

        const purchasedEventIds = new Set(
          purchases
            .filter(
              (p) =>
                p.kind === "event_ticket" &&
                p.status === "completed" &&
                p.event_id,
            )
            .map((p) => p.event_id as string),
        );

        const now = Date.now();
        const purchased = events.filter((e) => purchasedEventIds.has(e.id));

        const registered = purchased
          .filter(
            (e) => !e.start_date || new Date(e.start_date).getTime() >= now,
          )
          .sort(
            (a, b) =>
              new Date(a.start_date ?? 0).getTime() -
              new Date(b.start_date ?? 0).getTime(),
          );

        const past = purchased
          .filter((e) => e.start_date && new Date(e.start_date).getTime() < now)
          .sort(
            (a, b) =>
              new Date(b.start_date ?? 0).getTime() -
              new Date(a.start_date ?? 0).getTime(),
          );

        setRegisteredEvents(registered);
        setPastEvents(past);
      } catch (error) {
        console.error("Error fetching events:", error);
        setRegisteredEvents([]);
        setPastEvents([]);
      } finally {
        setLoading(false);
      }
    }

    if (user) loadEvents(user.id);
  }, [user]);

  const firstName =
    user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  const isMember =
    Boolean(user?.membership_type_id) &&
    (!user?.membership_expires_at ||
      new Date(user.membership_expires_at) > new Date());

  const openEvent = (event: EventRow) =>
    router.push(`/portal/events/${event.slug}`);

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-lg">UBC UX Hub</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/portal/profile")}
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </Button>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        {user && !isMember && <BecomeMemberBanner />}

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Hey, {firstName}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what you&apos;re signed up for.
          </p>
        </div>

        {/* Link to marketing events page */}
        <section className="mb-12">
          <Button asChild variant="outline">
            <Link href="/events">
              Browse all events
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>

        {/* Registered Events */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Registered Events</h2>
            {!loading && registeredEvents.length > 0 && (
              <span className="text-sm text-muted-foreground ml-1">
                ({registeredEvents.length})
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          ) : registeredEvents.length === 0 ? (
            <RegisteredEmptyState />
          ) : (
            <EventGrid events={registeredEvents} onSelect={openEvent} />
          )}
        </section>

        {/* Past Events */}
        {!loading && pastEvents.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <History className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Past Events</h2>
              <span className="text-sm text-muted-foreground ml-1">
                ({pastEvents.length})
              </span>
            </div>
            <EventGrid events={pastEvents} onSelect={openEvent} />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto max-w-6xl px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} UX Hub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
