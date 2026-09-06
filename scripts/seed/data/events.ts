/**
 * A relative event timeline with past, ongoing, and upcoming fixtures.
 *
 * Conventions:
 * - Slugs are stable seed identities. Visible names and years move relative to
 *   the seed run so existing database rows update instead of duplicating. A
 *   series that appears twice is disambiguated by phase (`design-sprint-past`
 *   and `design-sprint-upcoming`), never by a year the name no longer matches.
 * - `start_time` / `end_time` are `time` columns: naive local wall-clock, no offset.
 * - `registration_*_time` and check-in sessions are generated as absolute UTC
 *   timestamps. Event `time` columns remain naive local wall-clock values.
 * - `imageKey` names a file in `scripts/seed/data/images`. The seed uploads it
 *   and fills in `image_url`, so fixtures never hardcode a storage URL — see
 *   `scripts/seed/lib/images.ts`.
 *
 * The timeline is shaped around what a local run needs to exercise, and the
 * biggest group is deliberately "active, registration open, nobody has bought
 * it yet" so event checkout can be tested repeatedly. `EVENT_PHASES` below is
 * the index; `scripts/seed/lib/event-timeline.test.ts` holds it to that shape.
 */

import type { TablesInsert } from "../../../src/lib/supabase/database.types.ts";
import {
  addDays,
  addMonths,
  dateString,
  eventYear,
  startOfUtcDay,
  timestamp,
} from "../lib/relative-dates.ts";

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
  event: Omit<TablesInsert<"events">, "image_url"> & { slug: string };
  /** File name in `scripts/seed/data/images`, uploaded and used as the cover. */
  imageKey: string;
  mentors?: Mentor[];
  sponsors?: string[];
  checkInSessions: Omit<TablesInsert<"check_in_sessions">, "event_id">[];
  applicationQuestions: Omit<
    TablesInsert<"event_application_questions">,
    "event_id"
  >[];
}

/**
 * What each fixture is here to test. Read this before adding or retiming an
 * event: the value of the set is its coverage, and a change that quietly turns
 * the last `registrationClosed` fixture into another open one costs a UI state.
 */
export const EVENT_PHASES = {
  /** Finished and archived: portal history, receipts, past check-ins. */
  past: [
    "get-to-know-ux-hub",
    "design-sprint-past",
    "uxathon-past",
    "industry-talk-ai-and-ux",
  ],
  /** Long-running and open right now. Purchasable. */
  ongoing: ["open-studio", "coffee-chat-series", "mentorship-program"],
  /**
   * The point of the seed: upcoming, active, registration open, and left
   * unpurchased by every fixture account so checkout can be run again and
   * again. Keep these free of fixture purchases in `users.ts`.
   */
  purchasable: [
    "thinkbox-office-tour",
    "uxathon-upcoming",
    "portfolio-review-night",
    "design-sprint-upcoming",
    "student-panel",
  ],
  /** Upcoming and active, but the registration window has already closed. */
  registrationClosed: ["industry-talk-design-systems"],
  /** Upcoming and active, but registration has not opened yet. */
  registrationUpcoming: ["spring-showcase"],
  /** Draft: admin-only, invisible to the public RLS policy. */
  draft: ["ux-research-workshop"],
} as const;

/** Every slug the seed owns, in declaration order. */
export const SEED_EVENT_SLUGS = Object.values(EVENT_PHASES).flat();

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
      response_type: "multiple_choice" as const,
      is_required: true,
      response_options: ["1", "2", "3", "4", "5+", "Not a student"],
    },
    {
      question: "How would you describe your experience with Figma?",
      response_type: "multiple_choice" as const,
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
      response_type: "long_text" as const,
      is_required: true,
      max_char_limit: 500,
    },
    {
      question: "Any dietary restrictions we should know about for lunch?",
      response_type: "checkbox" as const,
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
      response_type: "multiple_choice" as const,
      is_required: true,
      response_options: ["1", "2", "3", "4", "5+", "Not a student"],
    },
    {
      question: "Which area do you most want to contribute in?",
      response_type: "checkbox" as const,
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
      response_type: "multiple_choice" as const,
      is_required: true,
      response_options: ["No, this is my first", "Once or twice", "Several times"],
    },
    {
      question:
        "Tell us about a design problem you have worked on recently. What was hard about it?",
      response_type: "long_text" as const,
      is_required: true,
      max_char_limit: 750,
    },
    {
      question:
        "Are you applying with teammates? List their names and we will keep you together.",
      response_type: "short_text" as const,
      is_required: false,
      max_char_limit: 200,
    },
  ],
};


/**
 * Shared imagery for description galleries and sponsor logos.
 *
 * Still remote: only the square event thumbnails move into storage (those are
 * the ones `scripts/seed/data/images` provides, and the ones the app's own
 * upload path produces). Gallery shots and sponsor logos are neither square nor
 * uploaded through that route, so they stay as plain URLs.
 */
const designSprintDescriptionImages = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=800",
];

const uxathonDescriptionImages = [
  "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800",
];

const seedSponsorLogos = [
  "https://images.unsplash.com/photo-1611162616475-46b635cb6868?auto=format&fit=crop&q=80&w=300",
  "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&q=80&w=300",
  "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&q=80&w=300",
];

const portfolioReviewAgenda: AgendaItem[] = [
  {
    time: "6:00 PM",
    title: "Check-in and reviewer matching",
    description: "Choose a portfolio, resume, or case-study review track.",
  },
  {
    time: "6:20 PM",
    title: "Rapid review rounds",
    description: "Three focused feedback conversations with rotating reviewers.",
  },
  {
    time: "8:00 PM",
    title: "Action planning and networking",
    description: "Turn feedback into a short, prioritized improvement plan.",
  },
];

export function buildSeedEvents(now: Date): SeedEvent[] {
  const today = startOfUtcDay(now);
  const schedule = {
    /* Past — finished and archived. */
    getToKnow: addMonths(today, -12),
    designSprintPast: addMonths(today, -10),
    uxathonPast: addMonths(today, -8),
    industryTalkPast: addMonths(today, -2),
    /* Ongoing — started already, running for a long while yet. */
    openStudioStart: addMonths(today, -6),
    openStudioEnd: addMonths(today, 24),
    coffeeSeriesStart: addMonths(today, -3),
    coffeeSeriesEnd: addMonths(today, 9),
    mentorshipStart: addMonths(today, -1),
    mentorshipEnd: addMonths(today, 18),
    /* Upcoming and purchasable — the core of the seed. */
    thinkboxTour: addDays(today, 21),
    uxathonUpcoming: addDays(today, 42),
    portfolioReview: addMonths(today, 2),
    designSprintUpcoming: addMonths(today, 4),
    studentPanel: addMonths(today, 5),
    /* Upcoming, deliberately not purchasable. */
    industryTalkDesignSystems: addMonths(today, 3),
    springShowcase: addMonths(today, 9),
    researchWorkshop: addMonths(today, 7),
  } as const;

  /** Opened two months before the event and closed well before it ran. */
  const closedHistoricalRegistration = (eventDate: Date) => ({
    registration_start_time: timestamp(addMonths(eventDate, -2)),
    registration_end_time: timestamp(addDays(eventDate, -5), 23, 59),
  });

  /** Open right now: started a month ago, closes five days before the event. */
  const openRegistration = (eventDate: Date) => ({
    registration_start_time: timestamp(addMonths(today, -1)),
    registration_end_time: timestamp(addDays(eventDate, -5), 23, 59),
  });

  /** Open right now, for an event that runs until `endDate`. */
  const openThroughout = (startDate: Date, endDate: Date) => ({
    registration_start_time: timestamp(addMonths(startDate, -2)),
    registration_end_time: timestamp(endDate, 23, 59),
  });

  /** Already closed even though the event is still ahead of us. */
  const alreadyClosedRegistration = () => ({
    registration_start_time: timestamp(addMonths(today, -3)),
    registration_end_time: timestamp(addDays(today, -3), 23, 59),
  });

  /** Not open yet: the "Registration Opens Soon" state. */
  const notYetOpenRegistration = (eventDate: Date) => ({
    registration_start_time: timestamp(addMonths(today, 6)),
    registration_end_time: timestamp(addDays(eventDate, -5), 23, 59),
  });

  const seeded: SeedEvent[] = [
  /* ── Past — archived ────────────────────────────────────────────────── */
  {
    event: {
      name: `Get to Know UX Hub ${eventYear(schedule.getToKnow)}`,
      slug: "get-to-know-ux-hub",
      status: "archived",
      description:
        "Our first event of the year and the easiest way to meet everyone. Short intro to what UX Hub runs across the year, a design-themed icebreaker, and plenty of time to talk to the exec team. No experience needed and nothing to prepare — come find out whether this is your kind of club.",
      regular_price: 0,
      member_price: 0,
      location_building: "AMS Nest",
      location_room: "Room 2314",
      location_address_url: "https://maps.app.goo.gl/9x8k2Qm4Zt6bXQ5s7",
      start_date: dateString(schedule.getToKnow),
      start_time: "17:30:00",
      end_date: dateString(schedule.getToKnow),
      end_time: "19:30:00",
      max_capacity: 120,
      ...closedHistoricalRegistration(schedule.getToKnow),
    },
    imageKey: "5.png",
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: timestamp(schedule.getToKnow, 17, 15),
        end_time: timestamp(schedule.getToKnow, 18, 30),
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: `Design Sprint ${eventYear(schedule.designSprintPast)}`,
      slug: "design-sprint-past",
      status: "archived",
      description:
        "One day, one brief, one clickable prototype. Teams of four run a compressed design sprint from problem framing through guerrilla research to a final critique in front of working designers. Our biggest first-term event and the fastest way to get something real into your portfolio.",
      regular_price: 15.0,
      member_price: 5.0,
      location_building: "Neville Scarfe Building",
      location_room: "Room 100",
      location_address_url: "https://maps.app.goo.gl/vNq7CkS3Wm2hZr4A9",
      start_date: dateString(schedule.designSprintPast),
      start_time: "10:00:00",
      end_date: dateString(schedule.designSprintPast),
      end_time: "17:00:00",
      max_capacity: 60,
      ...closedHistoricalRegistration(schedule.designSprintPast),
      agenda: designSprintAgenda,
      description_images: designSprintDescriptionImages,
    },
    imageKey: "6.png",
    mentors: designSprintMentors,
    sponsors: seedSponsorLogos.slice(0, 2),
    checkInSessions: [
      {
        name: "Morning Check-in",
        start_time: timestamp(schedule.designSprintPast, 9, 45),
        end_time: timestamp(schedule.designSprintPast, 10, 45),
      },
      {
        name: "Post-Lunch Check-in",
        start_time: timestamp(schedule.designSprintPast, 13, 45),
        end_time: timestamp(schedule.designSprintPast, 14, 30),
      },
    ],
    applicationQuestions: applicationQuestions.designSprint,
  },
  {
    event: {
      name: `UXathon ${eventYear(schedule.uxathonPast)}`,
      slug: "uxathon-past",
      status: "archived",
      event_type: "flagship",
      description:
        "Our flagship event: 32 hours, one open-ended brief, and a room full of teams turning it into something defensible. Mentors from across the Vancouver design scene rotate through all weekend, and the final round is judged on how well you argue for your decisions — not just how good the screens look. Food, snacks, and swag included.",
      regular_price: 25.0,
      member_price: 15.0,
      location_building: "ICICS/CS X-wing",
      location_room: "Room 100",
      location_address_url: "https://maps.app.goo.gl/6dK2sYqR8fV1nB7t5",
      start_date: dateString(schedule.uxathonPast),
      start_time: "09:00:00",
      end_date: dateString(addDays(schedule.uxathonPast, 1)),
      end_time: "17:00:00",
      max_capacity: 80,
      ...closedHistoricalRegistration(schedule.uxathonPast),
      agenda: [...uxathonAgendaDayOne, ...uxathonAgendaDayTwo],
      description_images: uxathonDescriptionImages,
    },
    imageKey: "1.png",
    mentors: uxathonMentors,
    sponsors: seedSponsorLogos,
    checkInSessions: [
      {
        name: "Opening Ceremony Check-in",
        start_time: timestamp(schedule.uxathonPast, 8, 45),
        end_time: timestamp(schedule.uxathonPast, 10, 30),
      },
      {
        name: "Evening Headcount",
        start_time: timestamp(schedule.uxathonPast, 19),
        end_time: timestamp(schedule.uxathonPast, 20),
      },
      {
        name: "Final Presentations Check-in",
        start_time: timestamp(addDays(schedule.uxathonPast, 1), 12, 30),
        end_time: timestamp(addDays(schedule.uxathonPast, 1), 13, 30),
      },
    ],
    applicationQuestions: applicationQuestions.uxathon,
  },
  {
    event: {
      name: `Industry Talk: AI and UX ${eventYear(schedule.industryTalkPast)}`,
      slug: "industry-talk-ai-and-ux",
      status: "archived",
      description:
        "A working product designer walks through what actually changed in their day job once generative tooling landed in the workflow — what it sped up, what it made worse, and which parts of the craft still have to be done by hand. Short talk, long Q&A.",
      regular_price: 5.0,
      member_price: 0,
      location_building: "Henry Angus Building",
      location_room: "Room 098",
      location_address_url: "https://maps.app.goo.gl/Xk4mP2rT8wQ6nB3v1",
      start_date: dateString(schedule.industryTalkPast),
      start_time: "18:00:00",
      end_date: dateString(schedule.industryTalkPast),
      end_time: "19:30:00",
      max_capacity: 90,
      ...closedHistoricalRegistration(schedule.industryTalkPast),
    },
    imageKey: "2.png",
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: timestamp(schedule.industryTalkPast, 17, 45),
        end_time: timestamp(schedule.industryTalkPast, 18, 45),
      },
    ],
    applicationQuestions: [],
  },

  /* ── Ongoing — active, registration open, purchasable ───────────────── */
  {
    event: {
      name: `UX Hub Open Studio ${eventYear(schedule.openStudioStart)}–${eventYear(schedule.openStudioEnd)}`,
      slug: "open-studio",
      status: "active",
      description:
        "An always-on home base for the UX Hub community. Drop into recurring critique circles, co-working sessions, and open office hours throughout the program window.",
      regular_price: 0,
      member_price: 0,
      location_building: "AMS Nest",
      location_room: "Room 2314",
      location_address_url: "https://maps.app.goo.gl/9x8k2Qm4Zt6bXQ5s7",
      start_date: dateString(schedule.openStudioStart),
      start_time: "17:30:00",
      end_date: dateString(schedule.openStudioEnd),
      end_time: "19:30:00",
      max_capacity: 120,
      ...openThroughout(schedule.openStudioStart, schedule.openStudioEnd),
    },
    imageKey: "1.png",
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: timestamp(schedule.openStudioStart, 17, 15),
        end_time: timestamp(schedule.openStudioEnd, 18, 30),
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: `Coffee Chat Community Series ${eventYear(schedule.coffeeSeriesStart)}–${eventYear(schedule.coffeeSeriesEnd)}`,
      slug: "coffee-chat-series",
      status: "active",
      description:
        "A recurring low-key social series with coffee, pastries, rotating small-group chats, and optional feedback on work in progress.",
      regular_price: 0,
      member_price: 0,
      location_building: "AMS Nest",
      location_room: "Room 2306",
      location_address_url: "https://maps.app.goo.gl/9x8k2Qm4Zt6bXQ5s7",
      start_date: dateString(schedule.coffeeSeriesStart),
      start_time: "16:00:00",
      end_date: dateString(schedule.coffeeSeriesEnd),
      end_time: "18:00:00",
      max_capacity: 40,
      ...openThroughout(schedule.coffeeSeriesStart, schedule.coffeeSeriesEnd),
    },
    imageKey: "2.png",
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: timestamp(schedule.coffeeSeriesStart, 15, 50),
        end_time: timestamp(schedule.coffeeSeriesEnd, 17),
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: `Student Design Mentorship Program ${eventYear(schedule.mentorshipStart)}–${eventYear(schedule.mentorshipEnd)}`,
      slug: "mentorship-program",
      status: "active",
      description:
        "A long-running mentorship program pairing students with peer and industry mentors. Members join monthly critiques, portfolio working sessions, and career conversations throughout the program.",
      regular_price: 20,
      member_price: 10,
      location_building: "Life Sciences Centre",
      location_room: "Atrium",
      location_address_url: "https://maps.app.goo.gl/T4wR8bLp1Vz6Yn3H8",
      start_date: dateString(schedule.mentorshipStart),
      start_time: "18:00:00",
      end_date: dateString(schedule.mentorshipEnd),
      end_time: "20:00:00",
      max_capacity: 100,
      ...openThroughout(schedule.mentorshipStart, schedule.mentorshipEnd),
      agenda: panelAgenda,
    },
    imageKey: "3.png",
    mentors: panelMentors,
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: timestamp(schedule.mentorshipStart, 17, 45),
        end_time: timestamp(schedule.mentorshipEnd, 19),
      },
    ],
    applicationQuestions: [],
  },

  /* ── Upcoming — active, registration open, nobody has bought them ───── */
  {
    event: {
      name: `Thinkbox Office Tour ${eventYear(schedule.thinkboxTour)}`,
      slug: "thinkbox-office-tour",
      status: "active",
      description:
        "A small-group visit to Thinkbox's Vancouver studio. Walk the space, see how their design team actually works day to day, and stay for an informal Q&A with two of their product designers. Capacity is tight because they are hosting us in one room — sign up early.",
      // Flat cost, no member discount: the checkout path where a member pays
      // the same as everyone else.
      regular_price: 10.0,
      member_price: 10.0,
      location_building: "Thinkbox Studio",
      location_room: "Main Lobby",
      location_address_url: "https://maps.app.goo.gl/PLACEHOLDER-thinkbox",
      start_date: dateString(schedule.thinkboxTour),
      start_time: "14:00:00",
      end_date: dateString(schedule.thinkboxTour),
      end_time: "16:00:00",
      max_capacity: 25,
      ...openRegistration(schedule.thinkboxTour),
    },
    imageKey: "4.png",
    checkInSessions: [
      {
        name: "Campus Departure",
        start_time: timestamp(schedule.thinkboxTour, 13),
        end_time: timestamp(schedule.thinkboxTour, 13, 20),
      },
      {
        name: "Lobby Check-in",
        start_time: timestamp(schedule.thinkboxTour, 13, 50),
        end_time: timestamp(schedule.thinkboxTour, 14, 20),
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: `UXathon ${eventYear(schedule.uxathonUpcoming)}`,
      slug: "uxathon-upcoming",
      status: "active",
      event_type: "flagship",
      description:
        "Our flagship event: 32 hours, one open-ended brief, and a room full of teams turning it into something defensible. Mentors from across the Vancouver design scene rotate through all weekend, and the final round is judged on how well you argue for your decisions — not just how good the screens look. Food, snacks, and swag included.",
      regular_price: 25.0,
      member_price: 15.0,
      location_building: "ICICS/CS X-wing",
      location_room: "Room 100",
      location_address_url: "https://maps.app.goo.gl/6dK2sYqR8fV1nB7t5",
      start_date: dateString(schedule.uxathonUpcoming),
      start_time: "09:00:00",
      end_date: dateString(addDays(schedule.uxathonUpcoming, 1)),
      end_time: "17:00:00",
      max_capacity: 80,
      ...openRegistration(schedule.uxathonUpcoming),
      agenda: [...uxathonAgendaDayOne, ...uxathonAgendaDayTwo],
      description_images: uxathonDescriptionImages,
    },
    imageKey: "5.png",
    mentors: uxathonMentors,
    sponsors: seedSponsorLogos,
    checkInSessions: [
      {
        name: "Opening Ceremony Check-in",
        start_time: timestamp(schedule.uxathonUpcoming, 8, 45),
        end_time: timestamp(schedule.uxathonUpcoming, 10, 30),
      },
      {
        name: "Evening Headcount",
        start_time: timestamp(schedule.uxathonUpcoming, 19),
        end_time: timestamp(schedule.uxathonUpcoming, 20),
      },
      {
        name: "Final Presentations Check-in",
        start_time: timestamp(addDays(schedule.uxathonUpcoming, 1), 12, 30),
        end_time: timestamp(addDays(schedule.uxathonUpcoming, 1), 13, 30),
      },
    ],
    applicationQuestions: applicationQuestions.uxathon,
  },
  {
    event: {
      name: `Portfolio Review Night ${eventYear(schedule.portfolioReview)}`,
      slug: "portfolio-review-night",
      status: "active",
      description:
        "Bring one case study, a resume, or an early portfolio draft for focused feedback from working designers and UX Hub peers. Attendees rotate through short review tables and leave with a prioritized list of concrete improvements.",
      regular_price: 8,
      member_price: 0,
      location_building: "AMS Nest",
      location_room: "Room 2306",
      location_address_url: "https://maps.app.goo.gl/9x8k2Qm4Zt6bXQ5s7",
      start_date: dateString(schedule.portfolioReview),
      start_time: "18:00:00",
      end_date: dateString(schedule.portfolioReview),
      end_time: "20:30:00",
      max_capacity: 45,
      ...openRegistration(schedule.portfolioReview),
      agenda: portfolioReviewAgenda,
    },
    imageKey: "6.png",
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: timestamp(schedule.portfolioReview, 17, 45),
        end_time: timestamp(schedule.portfolioReview, 18, 45),
      },
    ],
    applicationQuestions: [],
  },
  {
    event: {
      name: `Design Sprint ${eventYear(schedule.designSprintUpcoming)}`,
      slug: "design-sprint-upcoming",
      status: "active",
      description:
        "One day, one brief, one clickable prototype. Teams of four run a compressed design sprint from problem framing through guerrilla research to a final critique in front of working designers. Our biggest first-term event and the fastest way to get something real into your portfolio.",
      regular_price: 15.0,
      member_price: 5.0,
      location_building: "Neville Scarfe Building",
      location_room: "Room 100",
      location_address_url: "https://maps.app.goo.gl/vNq7CkS3Wm2hZr4A9",
      start_date: dateString(schedule.designSprintUpcoming),
      start_time: "10:00:00",
      end_date: dateString(schedule.designSprintUpcoming),
      end_time: "17:00:00",
      max_capacity: 60,
      ...openRegistration(schedule.designSprintUpcoming),
      agenda: designSprintAgenda,
      description_images: designSprintDescriptionImages,
    },
    imageKey: "2.png",
    mentors: designSprintMentors,
    sponsors: seedSponsorLogos.slice(0, 2),
    checkInSessions: [
      {
        name: "Morning Check-in",
        start_time: timestamp(schedule.designSprintUpcoming, 9, 45),
        end_time: timestamp(schedule.designSprintUpcoming, 10, 45),
      },
      {
        name: "Post-Lunch Check-in",
        start_time: timestamp(schedule.designSprintUpcoming, 13, 45),
        end_time: timestamp(schedule.designSprintUpcoming, 14, 30),
      },
    ],
    applicationQuestions: applicationQuestions.designSprint,
  },
  {
    event: {
      name: `Student Panel ${eventYear(schedule.studentPanel)}`,
      slug: "student-panel",
      status: "active",
      description:
        "Four students and recent grads talk through how they actually got into UX — the switched majors, the rejected portfolios, the co-op that changed everything. Honest answers rather than a polished career-fair pitch, followed by open Q&A and networking.",
      regular_price: 0,
      member_price: 0,
      location_building: "Life Sciences Centre",
      location_room: "Atrium",
      location_address_url: "https://maps.app.goo.gl/T4wR8bLp1Vz6Yn3H8",
      start_date: dateString(schedule.studentPanel),
      start_time: "18:00:00",
      end_date: dateString(schedule.studentPanel),
      end_time: "20:00:00",
      max_capacity: 100,
      ...openRegistration(schedule.studentPanel),
      agenda: panelAgenda,
    },
    imageKey: "3.png",
    mentors: panelMentors,
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: timestamp(schedule.studentPanel, 17, 45),
        end_time: timestamp(schedule.studentPanel, 19),
      },
    ],
    applicationQuestions: [],
  },

  /* ── Upcoming — deliberately not purchasable ────────────────────────── */
  {
    // "Registration Closed": the event is still ahead, the window is not.
    event: {
      name: `Industry Talk: Design Systems at Scale ${eventYear(schedule.industryTalkDesignSystems)}`,
      slug: "industry-talk-design-systems",
      status: "active",
      description:
        "Two staff designers on what a design system looks like once it has more than a hundred consumers — governance, deprecation, the components nobody uses, and the arguments you have to keep having. Registration for this one has already closed.",
      regular_price: 5.0,
      member_price: 3.0,
      location_building: "Henry Angus Building",
      location_room: "Room 098",
      location_address_url: "https://maps.app.goo.gl/Xk4mP2rT8wQ6nB3v1",
      start_date: dateString(schedule.industryTalkDesignSystems),
      start_time: "18:00:00",
      end_date: dateString(schedule.industryTalkDesignSystems),
      end_time: "19:30:00",
      max_capacity: 90,
      ...alreadyClosedRegistration(),
    },
    imageKey: "1.png",
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: timestamp(schedule.industryTalkDesignSystems, 17, 45),
        end_time: timestamp(schedule.industryTalkDesignSystems, 18, 45),
      },
    ],
    applicationQuestions: [],
  },
  {
    // "Registration Opens Soon": announced, not yet on sale.
    event: {
      name: `UX Hub Spring Showcase ${eventYear(schedule.springShowcase)}`,
      slug: "spring-showcase",
      status: "active",
      description:
        "The end-of-year showcase: every project from the mentorship program and the design sprints, presented by the people who made them, plus an open gallery walk and refreshments. Registration opens closer to the date.",
      regular_price: 0,
      member_price: 0,
      location_building: "AMS Nest",
      location_room: "Great Hall",
      location_address_url: "https://maps.app.goo.gl/9x8k2Qm4Zt6bXQ5s7",
      start_date: dateString(schedule.springShowcase),
      start_time: "17:00:00",
      end_date: dateString(schedule.springShowcase),
      end_time: "21:00:00",
      max_capacity: 200,
      ...notYetOpenRegistration(schedule.springShowcase),
    },
    imageKey: "4.png",
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: timestamp(schedule.springShowcase, 16, 45),
        end_time: timestamp(schedule.springShowcase, 18, 30),
      },
    ],
    applicationQuestions: [],
  },

  /* ── Draft — admin-only, invisible to the public RLS policy ─────────── */
  {
    event: {
      name: `UX Research Workshop ${eventYear(schedule.researchWorkshop)}`,
      slug: "ux-research-workshop",
      status: "draft",
      description:
        "A hands-on afternoon on research methods that fit a student timeline: writing a screener, running a usable interview, and turning six messy conversations into something a team can act on. Still being planned — details will change.",
      regular_price: 12.0,
      member_price: 6.0,
      location_building: "Neville Scarfe Building",
      location_room: "Room 204",
      location_address_url: "https://maps.app.goo.gl/vNq7CkS3Wm2hZr4A9",
      start_date: dateString(schedule.researchWorkshop),
      start_time: "13:00:00",
      end_date: dateString(schedule.researchWorkshop),
      end_time: "17:00:00",
      max_capacity: 30,
      ...openRegistration(schedule.researchWorkshop),
    },
    imageKey: "3.png",
    checkInSessions: [
      {
        name: "Door Check-in",
        start_time: timestamp(schedule.researchWorkshop, 12, 45),
        end_time: timestamp(schedule.researchWorkshop, 13, 30),
      },
    ],
    applicationQuestions: applicationQuestions.designSprint,
  },
  ];

  // `status` defaults to 'draft' in the schema, and the public RLS policy on
  // events only exposes 'active' rows, so draft fixtures are invisible on the
  // marketing site and in the portal. Spread first so a fixture can still opt
  // into its own status.
  return seeded.map((seed) => ({
    ...seed,
    event: { status: "active" as const, ...seed.event },
  }));
}

export const seedEvents = buildSeedEvents(new Date());
