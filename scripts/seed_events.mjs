import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const events = [
  {
    name: "UXathon 2026",
    description: "A 24-hour design hackathon where teams compete to solve real-world UX challenges. Mentorship provided by industry professionals. Includes food, drinks, and swag!",
    regular_price: 25.00,
    member_price: 15.00,
    location_building: "Neville Scarfe Building",
    location_room: "Room 100",
    location_address_url: "https://maps.app.goo.gl/xxx",
    start_date: "2026-09-15",
    start_time: "18:00:00",
    end_date: "2026-09-16",
    end_time: "18:00:00",
    max_capacity: 150,
    slug: "uxathon-2026",
    image_url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=800",
    registration_start_time: "2026-08-01T00:00:00Z",
    registration_end_time: "2026-09-10T23:59:59Z"
  },
  {
    name: "Tech Company Office Tour: Electronic Arts",
    description: "Join us for an exclusive office tour of EA Vancouver. See where the magic happens and network with senior UX designers who work on your favorite games.",
    regular_price: 10.00,
    member_price: 0.00,
    location_building: "EA Campus",
    location_room: "Main Lobby",
    location_address_url: "https://maps.app.goo.gl/yyy",
    start_date: "2026-10-05",
    start_time: "14:00:00",
    end_date: "2026-10-05",
    end_time: "16:00:00",
    max_capacity: 30,
    slug: "ea-office-tour-2026",
    image_url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800",
    registration_start_time: "2026-09-01T00:00:00Z",
    registration_end_time: "2026-10-01T23:59:59Z"
  },
  {
    name: "Figma Prototyping Masterclass",
    description: "Take your Figma skills to the next level. Learn advanced prototyping techniques, variables, and auto-layout secrets from industry professionals.",
    regular_price: 15.00,
    member_price: 5.00,
    location_building: "Sauder School of Business",
    location_room: "Room 490",
    location_address_url: "https://maps.app.goo.gl/zzz",
    start_date: "2026-08-20",
    start_time: "17:30:00",
    end_date: "2026-08-20",
    end_time: "19:30:00",
    max_capacity: 50,
    slug: "figma-masterclass",
    image_url: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=800",
    registration_start_time: "2026-07-20T00:00:00Z",
    registration_end_time: "2026-08-18T23:59:59Z"
  },
  {
    name: "UX Portfolio Review Night",
    description: "Get your portfolio reviewed by senior designers from top tech companies. 1-on-1 feedback sessions to help you land your next internship or full-time role.",
    regular_price: 20.00,
    member_price: 10.00,
    location_building: "Life Sciences Centre",
    location_room: "Atrium",
    location_address_url: "https://maps.app.goo.gl/aaa",
    start_date: "2026-11-12",
    start_time: "18:00:00",
    end_date: "2026-11-12",
    end_time: "21:00:00",
    max_capacity: 80,
    slug: "portfolio-review-night",
    image_url: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&q=80&w=800",
    registration_start_time: "2026-10-12T00:00:00Z",
    registration_end_time: "2026-11-10T23:59:59Z"
  }
];

const checkInSessions = {
  "uxathon-2026": [
    { name: "Opening Ceremony Check-in", offset_hours: 0 },
    { name: "Midnight Check-in", offset_hours: 6 },
    { name: "Final Presentations Check-in", offset_hours: 23 }
  ],
  "ea-office-tour-2026": [
    { name: "Bus Boarding", offset_hours: -0.5 },
    { name: "On-site Registration", offset_hours: 0.25 }
  ],
  "figma-masterclass": [
    { name: "Workshop Entry Check-in", offset_hours: -0.25 }
  ],
  "portfolio-review-night": [
    { name: "Main Event Check-in", offset_hours: -0.5 },
    { name: "Session 2 Check-in", offset_hours: 1 }
  ]
};

async function main() {
  for (const event of events) {
    const { data: insertedEvent, error } = await supabase
      .from("events")
      .insert(event)
      .select()
      .single();

    if (error) {
      console.error(`Error inserting event ${event.name}:`, error);
      continue;
    }

    console.log(`Successfully inserted event: ${event.name}`);

    // Add check-in sessions
    const sessions = checkInSessions[event.slug];
    if (sessions) {
      const sessionData = sessions.map(session => {
        const start = new Date(`${event.start_date}T${event.start_time}-07:00`);
        start.setHours(start.getHours() + session.offset_hours);
        const end = new Date(start);
        end.setHours(end.getHours() + 1); // 1 hour window

        return {
          event_id: insertedEvent.id,
          name: session.name,
          start_time: start.toISOString(),
          end_time: end.toISOString()
        };
      });

      const { error: sessionError } = await supabase
        .from("check_in_sessions")
        .insert(sessionData);

      if (sessionError) {
        console.error(`Error inserting check-in sessions for ${event.name}:`, sessionError);
      } else {
        console.log(`Successfully inserted ${sessionData.length} check-in sessions for ${event.name}`);
      }
    }
  }
}

main().catch(console.error);
