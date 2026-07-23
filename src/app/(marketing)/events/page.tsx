"use client";

import { useEffect, useState } from "react";
import Navbar from "@/features/marketing/homepage-sections/Navbar";
import Footer from "@/features/marketing/homepage-sections/Footer";
import { EventCard } from "@/components/shared/EventCard";
import { createClient } from "@/lib/supabase/client";
import { fetchEvents } from "@/lib/supabase-helpers/events";
import type { EventRow } from "@/types/models";

export default function EventsPage() {
    const [events, setEvents] = useState<EventRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();
        async function loadEvents() {
            try {
                const data = await fetchEvents(supabase, { orderBy: "start_date" });
                setEvents(data);
            } catch (error) {
                console.error("Error fetching events:", error);
            } finally {
                setLoading(false);
            }
        }
        loadEvents();
    }, []);

    return (
        <main className="bg-white min-h-screen">
            <Navbar />
            
            <div className="max-w-5xl mx-auto p-8 mt-12">
                <div className="mb-8">
                    <p className="text-gray-500 italic text-xl">our calendar</p>
                    <h1 className="text-4xl font-bold text-black">Upcoming Events</h1>
                    <p className="text-gray-600 mt-2">Join us to learn, build, and connect.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-black border-t-transparent"></div>
                    </div>
                ) : events.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-gray-300 rounded-xl">
                        <h3 className="text-lg font-semibold text-gray-700">No events scheduled yet</h3>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {events.map((event) => (
                            <EventCard
                                key={event.id}
                                event={event}
                                href={`/events/${event.slug || event.id}`}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-16">
                <Footer />
            </div>
        </main>
    );
}

