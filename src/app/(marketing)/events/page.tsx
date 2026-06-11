"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/features/marketing/homepage-sections/Navbar";
import Footer from "@/features/marketing/homepage-sections/Footer";
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
                        {events.map((event) => {
                            const startDate = event.start_date
                                ? new Date(event.start_date).toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                })
                                : null;

                            return (
                                <Link
                                    key={event.id}
                                    href={`/events/${event.slug}`}
                                    className="block border border-gray-300 rounded-xl overflow-hidden shadow-sm bg-white transition-shadow hover:shadow-md"
                                >
                                    {event.image_url ? (
                                        <img src={event.image_url} alt={event.name} className="w-full h-48 object-cover" />
                                    ) : (
                                        <div className="h-48 w-full bg-gray-100 flex items-center justify-center text-gray-400">No Image</div>
                                    )}

                                    <div className="p-4">
                                        <div className="flex gap-2 mb-2">
                                            {startDate && (
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-md text-gray-700">{startDate}</span>
                                            )}
                                            {event.regular_price !== undefined && (
                                                <span className="text-xs px-2 py-0.5 bg-green-100 rounded-md text-green-700">
                                                    {Number(event.regular_price) === 0 ? "Free" : `$${Number(event.regular_price)}`}
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-lg font-bold text-black mb-1">{event.name}</h3>
                                        <p className="text-gray-600 text-sm line-clamp-3">{event.description}</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="pt-16">
                <Footer />
            </div>
        </main>
    );
}
