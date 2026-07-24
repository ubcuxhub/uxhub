/**
 * Two full seasons of events: 2025-26 (past) and 2026-27 (upcoming).
 *
 * Conventions:
 * - Recurring events are slugged with the calendar year they happen in, so one
 *   academic year spans two suffixes (design-sprint-2026 + uxathon-2027).
 * - `start_time` / `end_time` are `time` columns: naive local wall-clock, no offset.
 * - `registration_*_time` are `timestamptz`: explicit America/Vancouver offsets,
 *   -07:00 during PDT and -08:00 during PST (DST ends the first Sunday of November).
 * - Registration opens ~6 weeks before an event and closes ~5 days before, which
 *   also keeps `registration_end_time >= registration_start_time` (events_check1).
 * - Check-in session times are absolute ISO timestamps rather than offsets from the
 *   event start. The previous script derived them with
 *   `start.setHours(start.getHours() + offsetHours)`, which truncates fractional
 *   hours to zero and silently placed sessions at the wrong time.
 */

import type { TablesInsert } from "../../../src/lib/supabase/database.types.ts";

/**
 * Shapes of the `mentors` and `agenda` JSONB columns.
 *
 * The generated types call both of these `Json`, which checks nothing useful.
 * These mirror the interfaces the public event page renders against in
 * src/app/(marketing)/events/[slug]/page.tsx — declared as type aliases rather
 * than interfaces so they stay assignable to `Json`.
 */
type Mentor = {
  name: string;
  role?: string;
  company?: string;
  image_url?: string;
  linkedin_url?: string;
  bio?: string;
};

type AgendaItem = {
  time: string;
  title: string;
  description?: string;
  room?: string;
};

export interface SeedEvent {
  event: TablesInsert<"events"> & { slug: string };
  checkInSessions: Omit<TablesInsert<"check_in_sessions">, "event_id">[];
  applicationQuestions: Omit<
    TablesInsert<"event_application_questions">,
    "event_id"
  >[];
}

const designSprintMentors: Mentor[] = [
  {
    name: "Priya Raman",
    role: "Senior Product Designer",
    company: "Shopify",
    image_url:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=400",
    linkedin_url: "https://www.linkedin.com/in/example-priya-raman",
    bio: "Ten years shipping commerce tooling. Runs the discovery half of the day and keeps teams from designing the wrong thing beautifully.",
  },
  {
    name: "Daniel Okonkwo",
    role: "UX Research Lead",
    company: "Hootsuite",
    image_url:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
    linkedin_url: "https://www.linkedin.com/in/example-daniel-okonkwo",
    bio: "Teaches the interview and synthesis block. Believes five scrappy interviews beat one perfect survey.",
  },
  {
    name: "Mei Lin Chow",
    role: "Design Manager",
    company: "Slack",
    image_url:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400",
    linkedin_url: "https://www.linkedin.com/in/example-mei-lin-chow",
    bio: "Sits on the final critique panel and gives the kind of feedback you'd get in a real design review.",
  },
];

const designSprintAgenda: AgendaItem[] = [
  {
    time: "10:00 AM",
    title: "Check-in and team formation",
    description: "Coffee, name tags, and randomized teams of four.",
    room: "Room 100",
  },
  {
    time: "10:30 AM",
    title: "Brief and problem framing",
    description: "This year's challenge, plus a short workshop on scoping it down.",
    room: "Room 100",
  },
  {
    time: "11:30 AM",
    title: "Research sprint",
    description: "Guerrilla interviews around campus with mentor support.",
  },
  {
    time: "1:00 PM",
    title: "Lunch and synthesis",
    description: "Pizza, affinity mapping, and picking one insight to build on.",
    room: "Room 100",
  },
  {
    time: "2:00 PM",
    title: "Sketch, storyboard, prototype",
    description: "Crazy 8s into a clickable Figma flow. Mentors rotate between teams.",
  },
  {
    time: "4:15 PM",
    title: "Final critique",
    description: "Six-minute presentations to the mentor panel.",
    room: "Room 100",
  },
];

const uxathonMentors: Mentor[] = [
  {
    name: "Alex Whitfield",
    role: "Principal Designer",
    company: "Electronic Arts",
    image_url:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400",
    linkedin_url: "https://www.linkedin.com/in/example-alex-whitfield",
    bio: "Judges the final round and runs a late-night crit for teams that are stuck.",
  },
  {
    name: "Sofia Marchetti",
    role: "Staff Product Designer",
    company: "Later",
    image_url:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
    linkedin_url: "https://www.linkedin.com/in/example-sofia-marchetti",
    bio: "Accessibility specialist. Ask her about designing for screen readers before you ship your prototype.",
  },
  {
    name: "Jordan Pike",
    role: "Design Systems Lead",
    company: "Thinkbox",
    image_url:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400",
    linkedin_url: "https://www.linkedin.com/in/example-jordan-pike",
    bio: "Runs the Saturday-evening component workshop and the Sunday morning polish clinic.",
  },
  {
    name: "Renée Bouchard",
    role: "Head of UX",
    company: "Bench Accounting",
    image_url:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400",
    linkedin_url: "https://www.linkedin.com/in/example-renee-bouchard",
    bio: "Final-round judge, focused on how well teams defend their design decisions.",
  },
];

const uxathonAgendaDayOne: AgendaItem[] = [
  {
    time: "9:00 AM",
    title: "Doors open and opening ceremony",
    description: "Breakfast, the challenge brief, and rules of engagement.",
    room: "Room 100",
  },
  {
    time: "10:30 AM",
    title: "Team formation and kickoff",
    description: "Solo entrants get matched into teams of three or four.",
  },
  {
    time: "12:30 PM",
    title: "Lunch and mentor speed-dating",
    description: "Fifteen minutes with each mentor to pressure-test your direction.",
  },
  {
    time: "4:00 PM",
    title: "Component workshop",
    description: "Optional session on building a small design system under time pressure.",
    room: "Room 204",
  },
  {
    time: "7:00 PM",
    title: "Dinner and late-night critique",
    description: "Drop-in feedback for teams that want a second opinion.",
  },
];

const uxathonAgendaDayTwo: AgendaItem[] = [
  {
    time: "9:00 AM",
    title: "Breakfast and polish clinic",
    description: "Last-mile help on prototypes and presentation decks.",
  },
  {
    time: "12:00 PM",
    title: "Submissions close",
    description: "Figma links locked. No exceptions, however tempting.",
  },
  {
    time: "1:00 PM",
    title: "Final presentations",
    description: "Eight minutes per team in front of the judging panel.",
    room: "Room 100",
  },
  {
    time: "4:00 PM",
    title: "Awards and closing",
    description: "Prizes, group photo, and the traditional post-UXathon nap.",
    room: "Room 100",
  },
];

const panelMentors: Mentor[] = [
  {
    name: "Hannah Osei",
    role: "Product Designer",
    company: "Figma",
    image_url:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&q=80&w=400",
    linkedin_url: "https://www.linkedin.com/in/example-hannah-osei",
    bio: "BFA to product design, no bootcamp. Talks candidly about the first two years.",
  },
  {
    name: "Marcus Tran",
    role: "UX Designer",
    company: "TELUS",
    image_url:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400",
    linkedin_url: "https://www.linkedin.com/in/example-marcus-tran",
    bio: "Cognitive systems grad who co-oped his way in. Will show you the portfolio that got him hired.",
  },
];

const panelAgenda: AgendaItem[] = [
  {
    time: "6:00 PM",
    title: "Doors and refreshments",
    room: "Atrium",
  },
  {
    time: "6:20 PM",
    title: "Panel discussion",
    description: "Four students and recent grads on how they actually broke into UX.",
  },
  {
    time: "7:15 PM",
    title: "Audience Q&A",
  },
  {
    time: "7:40 PM",
    title: "Open networking",
    description: "Stay as long as the building lets us.",
  },
];

const applicationQuestions = {
  designSprint: [
    {
      question: "What year of study are you in?",
      response_type: "single_select" as const,
      is_required: true,
      response_options: ["1", "2", "3", "4", "5+", "Not a student"],
    },
    {
      question: "How would you describe your experience with Figma?",
      response_type: "single_select" as const,
      is_required: true,
      response_options: [
        "Never used it",
        "I can follow a tutorial",
        "Comfortable building screens",
        "I build components and use auto-layout daily",
      ],
    },
    {
      question:
        "What do you want to walk away from the Design Sprint with? Two or three sentences is plenty.",
      response_type: "text" as const,
      is_required: true,
      max_char_limit: 500,
    },
    {
      question: "Any dietary restrictions we should know about for lunch?",
      response_type: "multi_select" as const,
      is_required: false,
      response_options: [
        "None",
        "Vegetarian",
        "Vegan",
        "Halal",
        "Gluten-free",
        "Nut allergy",
        "Dairy-free",
      ],
    },
  ],
  uxathon: [
    {
      question: "What year of study are you in?",
      response_type: "single_select" as const,
      is_required: true,
      response_options: ["1", "2", "3", "4", "5+", "Not a student"],
    },
    {
      question: "Which area do you most want to contribute in?",
      response_type: "multi_select" as const,
      is_required: true,
      response_options: [
        "User research",
        "Visual and UI design",
        "Prototyping",
        "Content and copy",
        "Front-end development",
        "Presenting and storytelling",
      ],
    },
    {
      question: "Have you participated in a hackathon or design sprint before?",
      response_type: "single_select" as const,
      is_required: true,
      response_options: ["No, this is my first", "Once or twice", "Several times"],
    },
    {
      question:
        "Tell us about a design problem you have worked on recently. What was hard about it?",
      response_type: "text" as const,
      is_required: true,
      max_char_limit: 750,
    },
    {
      question:
        "Are you applying with teammates? List their names and we will keep you together.",
      response_type: "text" as const,
      is_required: false,
      max_char_limit: 200,
    },
  ],
};

export const seedEvents: SeedEvent[] = [
  /* ── 2025-26 season ─────────────────────────────────────────────────── */
  {
    event: {
      name: "Get to Know UX Hub 2025",
      slug: "get-to-know-ux-hub-2025",
      description:
        "Our first event of the year and the easiest way to meet everyone. Short intro to what UX Hub runs across the year, a design-themed icebreaker, and plenty of time to talk to the exec team. No experience needed and nothing to prepare — come find out whether this is your kind of club.",
      regular_price: 0,
      member_price: 0,
      location_building: "AMS Nest",
      location_room: "Room 2314",
      location_address_url: "https://maps.app.goo.gl/9x8k2Qm4Zt6bXQ5s7",
      start_date: "2025-10-03",
      start_time: "17:30:00",
      end_date: "2025-10-03",
      end_time: "19:30:00",
      max_capacity: 120,
      image_url:
        "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2025-08-22T00:00:00-07:00",
      registration_end_time: "2025-09-28T23:59:00-07:00",
    },
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: "2025-10-03T17:15:00-07:00",
        end_time: "2025-10-03T18:30:00-07:00",
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: "Design Sprint 2025",
      slug: "design-sprint-2025",
      description:
        "One day, one brief, one clickable prototype. Teams of four run a compressed design sprint from problem framing through guerrilla research to a final critique in front of working designers. Our biggest first-term event and the fastest way to get something real into your portfolio.",
      regular_price: 15.0,
      member_price: 5.0,
      location_building: "Neville Scarfe Building",
      location_room: "Room 100",
      location_address_url: "https://maps.app.goo.gl/vNq7CkS3Wm2hZr4A9",
      start_date: "2025-10-25",
      start_time: "10:00:00",
      end_date: "2025-10-25",
      end_time: "17:00:00",
      max_capacity: 60,
      image_url:
        "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2025-09-13T00:00:00-07:00",
      registration_end_time: "2025-10-20T23:59:00-07:00",
      mentors: designSprintMentors,
      agenda: designSprintAgenda,
      sponsor_logos: [
        "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&q=80&w=300",
        "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&q=80&w=300",
      ],
      description_images: [
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=800",
      ],
    },
    checkInSessions: [
      {
        name: "Morning Check-in",
        start_time: "2025-10-25T09:45:00-07:00",
        end_time: "2025-10-25T10:45:00-07:00",
      },
      {
        name: "Post-Lunch Check-in",
        start_time: "2025-10-25T13:45:00-07:00",
        end_time: "2025-10-25T14:30:00-07:00",
      },
    ],
    applicationQuestions: applicationQuestions.designSprint,
  },
  {
    event: {
      name: "Student Panel 2025",
      slug: "student-panel-2025",
      description:
        "Four students and recent grads talk through how they actually got into UX — the switched majors, the rejected portfolios, the co-op that changed everything. Honest answers rather than a polished career-fair pitch, followed by open Q&A and networking.",
      regular_price: 0,
      member_price: 0,
      location_building: "Life Sciences Centre",
      location_room: "Atrium",
      location_address_url: "https://maps.app.goo.gl/T4wR8bLp1Vz6Yn3H8",
      start_date: "2025-11-13",
      start_time: "18:00:00",
      end_date: "2025-11-13",
      end_time: "20:00:00",
      max_capacity: 100,
      image_url:
        "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2025-10-02T00:00:00-07:00",
      registration_end_time: "2025-11-08T23:59:00-08:00",
      mentors: panelMentors,
      agenda: panelAgenda,
    },
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: "2025-11-13T17:45:00-08:00",
        end_time: "2025-11-13T19:00:00-08:00",
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: "UXathon 2026",
      slug: "uxathon-2026",
      description:
        "Our flagship event: 32 hours, one open-ended brief, and a room full of teams turning it into something defensible. Mentors from across the Vancouver design scene rotate through all weekend, and the final round is judged on how well you argue for your decisions — not just how good the screens look. Food, snacks, and swag included.",
      regular_price: 25.0,
      member_price: 15.0,
      location_building: "ICICS/CS X-wing",
      location_room: "Room 100",
      location_address_url: "https://maps.app.goo.gl/6dK2sYqR8fV1nB7t5",
      start_date: "2026-01-24",
      start_time: "09:00:00",
      end_date: "2026-01-25",
      end_time: "17:00:00",
      max_capacity: 80,
      image_url:
        "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2025-12-12T00:00:00-08:00",
      registration_end_time: "2026-01-19T23:59:00-08:00",
      mentors: uxathonMentors,
      agenda: [...uxathonAgendaDayOne, ...uxathonAgendaDayTwo],
      sponsor_logos: [
        "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&q=80&w=300",
        "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&q=80&w=300",
        "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&q=80&w=300",
      ],
      description_images: [
        "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800",
      ],
    },
    checkInSessions: [
      {
        name: "Opening Ceremony Check-in",
        start_time: "2026-01-24T08:45:00-08:00",
        end_time: "2026-01-24T10:30:00-08:00",
      },
      {
        name: "Evening Headcount",
        start_time: "2026-01-24T19:00:00-08:00",
        end_time: "2026-01-24T20:00:00-08:00",
      },
      {
        name: "Final Presentations Check-in",
        start_time: "2026-01-25T12:30:00-08:00",
        end_time: "2026-01-25T13:30:00-08:00",
      },
    ],
    applicationQuestions: applicationQuestions.uxathon,
  },
  {
    event: {
      name: "Thinkbox Office Tour 2026",
      slug: "thinkbox-office-tour-2026",
      description:
        "A small-group visit to Thinkbox's Vancouver studio. Walk the space, see how their design team actually works day to day, and stay for an informal Q&A with two of their product designers. Capacity is tight because they are hosting us in one room — sign up early.",
      regular_price: 10.0,
      member_price: 0,
      location_building: "Thinkbox Studio",
      location_room: "Main Lobby",
      location_address_url: "https://maps.app.goo.gl/PLACEHOLDER-thinkbox",
      start_date: "2026-02-11",
      start_time: "14:00:00",
      end_date: "2026-02-11",
      end_time: "16:00:00",
      max_capacity: 25,
      image_url:
        "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2025-12-31T00:00:00-08:00",
      registration_end_time: "2026-02-06T23:59:00-08:00",
    },
    checkInSessions: [
      {
        name: "Campus Departure",
        start_time: "2026-02-11T13:00:00-08:00",
        end_time: "2026-02-11T13:20:00-08:00",
      },
      {
        name: "Lobby Check-in",
        start_time: "2026-02-11T13:50:00-08:00",
        end_time: "2026-02-11T14:20:00-08:00",
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: "Industry Talk: AI and UX 2026",
      slug: "industry-talk-ai-and-ux-2026",
      description:
        "A working designer walks through what actually changed in their process once AI tooling landed in it — what they use, what they abandoned, and which parts of the job turned out to be stubbornly human. Talk, then a long Q&A.",
      regular_price: 5.0,
      member_price: 0,
      location_building: "Henry Angus Building",
      location_room: "Room 241",
      location_address_url: "https://maps.app.goo.gl/Mn5vJ2Xa7Rq9Ld3W6",
      start_date: "2026-03-10",
      start_time: "18:00:00",
      end_date: "2026-03-10",
      end_time: "19:30:00",
      max_capacity: 80,
      image_url:
        "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2026-01-27T00:00:00-08:00",
      registration_end_time: "2026-03-05T23:59:00-08:00",
    },
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: "2026-03-10T17:45:00-07:00",
        end_time: "2026-03-10T18:45:00-07:00",
      },
    ],
    applicationQuestions: [],
  },

  /* ── 2026-27 season ─────────────────────────────────────────────────── */
  {
    event: {
      name: "Get to Know UX Hub 2026",
      slug: "get-to-know-ux-hub-2026",
      description:
        "New year, same idea: come meet the club before committing to anything. Quick tour of what we run across both terms, a design-themed icebreaker, and time to ask the exec team whatever you want. Free, no experience needed, and the single best entry point if you are new to UX.",
      regular_price: 0,
      member_price: 0,
      location_building: "AMS Nest",
      location_room: "Room 2314",
      location_address_url: "https://maps.app.goo.gl/9x8k2Qm4Zt6bXQ5s7",
      start_date: "2026-10-02",
      start_time: "17:30:00",
      end_date: "2026-10-02",
      end_time: "19:30:00",
      max_capacity: 120,
      image_url:
        "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2026-08-21T00:00:00-07:00",
      registration_end_time: "2026-09-27T23:59:00-07:00",
    },
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: "2026-10-02T17:15:00-07:00",
        end_time: "2026-10-02T18:30:00-07:00",
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: "Design Sprint 2026",
      slug: "design-sprint-2026",
      description:
        "One day, one brief, one clickable prototype. Teams of four run a compressed design sprint from problem framing through guerrilla research to a final critique in front of working designers. Our biggest first-term event and the fastest way to get something real into your portfolio.",
      regular_price: 15.0,
      member_price: 5.0,
      location_building: "Neville Scarfe Building",
      location_room: "Room 100",
      location_address_url: "https://maps.app.goo.gl/vNq7CkS3Wm2hZr4A9",
      start_date: "2026-10-24",
      start_time: "10:00:00",
      end_date: "2026-10-24",
      end_time: "17:00:00",
      max_capacity: 60,
      image_url:
        "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2026-09-12T00:00:00-07:00",
      registration_end_time: "2026-10-19T23:59:00-07:00",
      mentors: designSprintMentors,
      agenda: designSprintAgenda,
      sponsor_logos: [
        "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&q=80&w=300",
        "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&q=80&w=300",
      ],
      description_images: [
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=800",
      ],
    },
    checkInSessions: [
      {
        name: "Morning Check-in",
        start_time: "2026-10-24T09:45:00-07:00",
        end_time: "2026-10-24T10:45:00-07:00",
      },
      {
        name: "Post-Lunch Check-in",
        start_time: "2026-10-24T13:45:00-07:00",
        end_time: "2026-10-24T14:30:00-07:00",
      },
    ],
    applicationQuestions: applicationQuestions.designSprint,
  },
  {
    event: {
      name: "Student Panel 2026",
      slug: "student-panel-2026",
      description:
        "Four students and recent grads talk through how they actually got into UX — the switched majors, the rejected portfolios, the co-op that changed everything. Honest answers rather than a polished career-fair pitch, followed by open Q&A and networking.",
      regular_price: 0,
      member_price: 0,
      location_building: "Life Sciences Centre",
      location_room: "Atrium",
      location_address_url: "https://maps.app.goo.gl/T4wR8bLp1Vz6Yn3H8",
      start_date: "2026-11-12",
      start_time: "18:00:00",
      end_date: "2026-11-12",
      end_time: "20:00:00",
      max_capacity: 100,
      image_url:
        "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2026-10-01T00:00:00-07:00",
      registration_end_time: "2026-11-07T23:59:00-08:00",
      mentors: panelMentors,
      agenda: panelAgenda,
    },
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: "2026-11-12T17:45:00-08:00",
        end_time: "2026-11-12T19:00:00-08:00",
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: "Coffee Chat Social 2026",
      slug: "coffee-chat-social-2026",
      description:
        "A low-key end-of-term social. Coffee, pastries, and rotating small-group chats so you actually talk to people instead of standing near them. Bring a work-in-progress if you want feedback, or bring nothing at all.",
      regular_price: 0,
      member_price: 0,
      location_building: "AMS Nest",
      location_room: "Room 2306",
      location_address_url: "https://maps.app.goo.gl/9x8k2Qm4Zt6bXQ5s7",
      start_date: "2026-11-25",
      start_time: "16:00:00",
      end_date: "2026-11-25",
      end_time: "18:00:00",
      max_capacity: 40,
      image_url:
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2026-10-14T00:00:00-07:00",
      registration_end_time: "2026-11-20T23:59:00-08:00",
    },
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: "2026-11-25T15:50:00-08:00",
        end_time: "2026-11-25T17:00:00-08:00",
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: "UXathon 2027",
      slug: "uxathon-2027",
      description:
        "Our flagship event: 32 hours, one open-ended brief, and a room full of teams turning it into something defensible. Mentors from across the Vancouver design scene rotate through all weekend, and the final round is judged on how well you argue for your decisions — not just how good the screens look. Food, snacks, and swag included.",
      regular_price: 25.0,
      member_price: 15.0,
      location_building: "ICICS/CS X-wing",
      location_room: "Room 100",
      location_address_url: "https://maps.app.goo.gl/6dK2sYqR8fV1nB7t5",
      start_date: "2027-01-23",
      start_time: "09:00:00",
      end_date: "2027-01-24",
      end_time: "17:00:00",
      max_capacity: 80,
      image_url:
        "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2026-12-11T00:00:00-08:00",
      registration_end_time: "2027-01-18T23:59:00-08:00",
      mentors: uxathonMentors,
      agenda: [...uxathonAgendaDayOne, ...uxathonAgendaDayTwo],
      sponsor_logos: [
        "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&q=80&w=300",
        "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&q=80&w=300",
        "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&q=80&w=300",
      ],
      description_images: [
        "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800",
      ],
    },
    checkInSessions: [
      {
        name: "Opening Ceremony Check-in",
        start_time: "2027-01-23T08:45:00-08:00",
        end_time: "2027-01-23T10:30:00-08:00",
      },
      {
        name: "Evening Headcount",
        start_time: "2027-01-23T19:00:00-08:00",
        end_time: "2027-01-23T20:00:00-08:00",
      },
      {
        name: "Final Presentations Check-in",
        start_time: "2027-01-24T12:30:00-08:00",
        end_time: "2027-01-24T13:30:00-08:00",
      },
    ],
    applicationQuestions: applicationQuestions.uxathon,
  },
  {
    event: {
      name: "Thinkbox Office Tour 2027",
      slug: "thinkbox-office-tour-2027",
      description:
        "A small-group visit to Thinkbox's Vancouver studio. Walk the space, see how their design team actually works day to day, and stay for an informal Q&A with two of their product designers. Capacity is tight because they are hosting us in one room — sign up early.",
      regular_price: 10.0,
      member_price: 0,
      location_building: "Thinkbox Studio",
      location_room: "Main Lobby",
      location_address_url: "https://maps.app.goo.gl/PLACEHOLDER-thinkbox",
      start_date: "2027-02-10",
      start_time: "14:00:00",
      end_date: "2027-02-10",
      end_time: "16:00:00",
      max_capacity: 25,
      image_url:
        "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800",
      registration_start_time: "2026-12-30T00:00:00-08:00",
      registration_end_time: "2027-02-05T23:59:00-08:00",
    },
    checkInSessions: [
      {
        name: "Campus Departure",
        start_time: "2027-02-10T13:00:00-08:00",
        end_time: "2027-02-10T13:20:00-08:00",
      },
      {
        name: "Lobby Check-in",
        start_time: "2027-02-10T13:50:00-08:00",
        end_time: "2027-02-10T14:20:00-08:00",
      },
    ],
    applicationQuestions: [],
  },
];
