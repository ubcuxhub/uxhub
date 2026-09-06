import type { TablesInsert } from "../../../src/lib/supabase/database.types.ts";
import { addDays, startOfUtcDay, timestamp } from "../lib/relative-dates.ts";
import { seedEvents, type SeedEvent } from "./events.ts";

export interface SeedPurchase {
  amountCents: number;
  createdAt: string;
  eventSlug?: string;
  failureReason?: string;
  fulfilledAt?: string;
  idempotencyKey: string;
  kind: "event_ticket" | "membership";
  membershipSlug?: string;
  squarePaymentId?: string;
  status: "pending" | "authorized" | "completed" | "canceled" | "failed";
}

export interface SeedRegistration {
  attending: boolean;
  checkIns?: Record<string, string>;
  eventSlug: string;
  purchaseKey?: string;
  responses?: Record<string, string>;
  reviewerEmail?: string;
  status: "pending" | "declined" | "accepted";
}

export type SeedProfile = Omit<
  TablesInsert<"user_info">,
  | "auth_user_id"
  | "email"
  | "membership_expires_at"
  | "membership_pre_ordered_type_id"
  | "membership_type_id"
>;

export interface SeedUser {
  email: string;
  membershipSlug: string | null;
  password: string;
  profile: SeedProfile;
  purchases: SeedPurchase[];
  registrations: SeedRegistration[];
  /**
   * Whether this account carries purchased registrations across the past,
   * ongoing, and upcoming phases.
   *
   * Three accounts do, and they are what the portal's history, receipt, and
   * check-in screens are tested against. The rest exist to cover the
   * membership x role grid, and giving each of them a full event history would
   * be a lot of hand-written fixture data to keep correct for very little.
   * `validateUserFixtures` only holds the deep ones to phase coverage.
   */
  fullEventHistory: boolean;
}

/** Every fixture account signs in with this. Local only — see `lib/targets.ts`. */
export const SEED_PASSWORD = "123456";

/**
 * Fixture accounts the seed used to create under a different address.
 *
 * Renaming a fixture leaves its old account behind, and that account still owns
 * purchases under the same idempotency keys the new one wants — which would
 * fail the "belongs to another user" guard in `reconcile-users.ts` on the next
 * run. So the seed deletes these outright before writing anything.
 *
 * This is a deliberate, bounded exception to "never touch an account the seed
 * did not create": every address here was created by an earlier version of this
 * file. Never add an address a person signed up with.
 */
export const RETIRED_FIXTURE_EMAILS = [
  "admin-explorer@gmail.com",
  "not-member@gmail.com",
  "mock-member@example.com",
] as const;

const designSprintQuestions = {
  year: "What year of study are you in?",
  figma: "How would you describe your experience with Figma?",
  goal: "What do you want to walk away from the Design Sprint with? Two or three sentences is plenty.",
  dietary: "Any dietary restrictions we should know about for lunch?",
} as const;

const uxathonQuestions = {
  year: "What year of study are you in?",
  contribution: "Which area do you most want to contribute in?",
  experience: "Have you participated in a hackathon or design sprint before?",
  problem: "Tell us about a design problem you have worked on recently. What was hard about it?",
  teammates: "Are you applying with teammates? List their names and we will keep you together.",
} as const;

function requireEvent(events: SeedEvent[], slug: string): SeedEvent {
  const event = events.find((candidate) => candidate.event.slug === slug);
  if (!event) throw new Error(`Missing seed event "${slug}"`);
  return event;
}

function ticketPriceCents(event: SeedEvent, isMember: boolean): number {
  const price = isMember ? event.event.member_price : event.event.regular_price;
  return Math.round(Number(price) * 100);
}

function afterTimestamp(value: string, minutes: number): string {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
}

/**
 * Profile builders, one per `user_type`.
 *
 * The three types own mutually exclusive field sets, and
 * `completeMembershipProfile` in src/features/memberships/actions.ts nulls the
 * other two sets whenever a classification is chosen. These mirror that exactly
 * so a fixture looks like an account somebody actually signed up for, rather
 * than a row with a plausible-looking mix of student and faculty fields.
 */
interface CommonProfileInput {
  firstName: string;
  lastName: string;
  phone: string;
  pronouns: string;
  admin?: boolean;
  dietary?: string | null;
  newsletter?: boolean;
}

function baseProfile(input: CommonProfileInput) {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    preferred_pronouns: input.pronouns,
    role_access: (input.admin ? "admin" : "basic") as "admin" | "basic",
    dietary_restrictions: input.dietary ?? null,
    newsletter: input.newsletter ?? false,
    square_customer_id: null,
  };
}

function studentProfile(
  input: CommonProfileInput & {
    studentNumber: number;
    faculty: string;
    major: string;
    year: TablesInsert<"user_info">["year"];
  }
): SeedProfile {
  return {
    ...baseProfile(input),
    user_type: "ubcStudent",
    student_number: input.studentNumber,
    faculty: input.faculty,
    major: input.major,
    year: input.year,
    faculty_email: null,
    school_institution: null,
    student_status: null,
  };
}

function facultyProfile(
  input: CommonProfileInput & { email: string; faculty: string }
): SeedProfile {
  return {
    ...baseProfile(input),
    user_type: "faculty",
    // Must equal the account's own address, and must be a ubc.ca domain:
    // `completeMembershipProfile` rejects a mismatch and `validateFacultyEmail`
    // enforces the domain.
    faculty_email: input.email,
    faculty: input.faculty,
    student_number: null,
    major: null,
    year: null,
    school_institution: null,
    student_status: null,
  };
}

function nonUbcProfile(
  input: CommonProfileInput & {
    schoolInstitution: string;
    studentStatus: TablesInsert<"user_info">["student_status"];
    year?: TablesInsert<"user_info">["year"];
  }
): SeedProfile {
  return {
    ...baseProfile(input),
    user_type: "nonUbc",
    school_institution: input.schoolInstitution,
    student_status: input.studentStatus,
    year: input.year ?? null,
    faculty_email: null,
    student_number: null,
    faculty: null,
    major: null,
  };
}

/** Tier prices, in cents, as asserted by `validateUserFixtures`. */
const MEMBERSHIP_PRICE_CENTS = {
  explorer: 1200,
  innovator: 1800,
  faculty: 1800,
  "non-ubc": 2400,
} as const;

type MembershipSlug = keyof typeof MEMBERSHIP_PRICE_CENTS;

/**
 * The membership purchase every member fixture needs.
 *
 * `validateUserFixtures` requires a member to hold a completed purchase for
 * their own tier, so this is the minimum a grid account can carry.
 */
function membershipPurchase(
  handle: string,
  slug: MembershipSlug,
  createdAt: string
): SeedPurchase {
  return {
    amountCents: MEMBERSHIP_PRICE_CENTS[slug],
    createdAt,
    fulfilledAt: afterTimestamp(createdAt, 1),
    idempotencyKey: `seed:membership:${handle}:${slug}`,
    kind: "membership",
    membershipSlug: slug,
    squarePaymentId: `seed:payment:${handle}:${slug}`,
    status: "completed",
  };
}

/**
 * Which events each fixture account has already bought.
 *
 * The rule that matters: nothing here touches `EVENT_PHASES.purchasable`. Those
 * five upcoming events are left unbought by every account on purpose, so event
 * checkout can be run again and again — and because `pnpm seed` prunes
 * fixture-owned purchases, a ticket bought through the UI is undone by the next
 * run. Purchase history instead hangs off the archived past events, the ongoing
 * mentorship program, and the one upcoming event whose registration has already
 * closed.
 *
 * `validateUserFixtures` requires every account to hold a completed, purchased
 * registration in each of the past, ongoing, and upcoming phases, which is why
 * all three buy the design-systems talk.
 */
export function buildSeedUsers(events: SeedEvent[], now: Date): SeedUser[] {
  const today = startOfUtcDay(now);
  const getToKnowPast = requireEvent(events, "get-to-know-ux-hub");
  const designSprintPast = requireEvent(events, "design-sprint-past");
  const uxathonPast = requireEvent(events, "uxathon-past");
  const industryTalkPast = requireEvent(events, "industry-talk-ai-and-ux");
  const mentorshipOngoing = requireEvent(events, "mentorship-program");
  const industryTalkUpcoming = requireEvent(events, "industry-talk-design-systems");
  const researchWorkshopDraft = requireEvent(events, "ux-research-workshop");

  const industryCheckIn = industryTalkPast.checkInSessions[0]?.start_time;
  const getToKnowCheckIn = getToKnowPast.checkInSessions[0]?.start_time;
  const designSprintCheckIns = designSprintPast.checkInSessions;

  if (!industryCheckIn || !getToKnowCheckIn || designSprintCheckIns.length < 2) {
    throw new Error("Purchased event fixtures need their expected check-in sessions");
  }

  const historicalPurchaseTime = (event: SeedEvent) => {
    const registrationStart = event.event.registration_start_time;
    if (!registrationStart) throw new Error(`Event "${event.event.slug}" has no registration start`);
    return afterTimestamp(registrationStart, 24 * 60);
  };
  const recentPurchaseTime = timestamp(addDays(today, -7), 18);
  const failedPurchaseTime = timestamp(addDays(today, -3), 18);

  const gridPurchaseTime = timestamp(addDays(today, -60), 15);

  return [
  /* ── Deep fixtures ───────────────────────────────────────────────────────
   * Three accounts carrying purchased registrations across every phase. These
   * are what the portal history, receipts, applications, and check-in screens
   * are exercised against.
   */
  {
    email: "admin-explorer@example.com",
    password: SEED_PASSWORD,
    membershipSlug: "explorer",
    fullEventHistory: true,
    profile: studentProfile({
      firstName: "Riley",
      lastName: "Chen",
      phone: "6045550101",
      pronouns: "they/them",
      admin: true,
      dietary: "Vegetarian",
      newsletter: true,
      studentNumber: 10000001,
      faculty: "Faculty of Arts",
      major: "Cognitive Systems",
      year: "3",
    }),
    purchases: [
      membershipPurchase(
        "admin-explorer",
        "explorer",
        timestamp(addDays(today, -30), 17)
      ),
      {
        amountCents: ticketPriceCents(industryTalkPast, true),
        createdAt: historicalPurchaseTime(industryTalkPast),
        eventSlug: industryTalkPast.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(industryTalkPast), 1),
        idempotencyKey: "seed:event:admin-explorer:industry-talk-ai-and-ux",
        kind: "event_ticket",
        squarePaymentId: "seed:payment:admin-explorer:industry-talk-ai-and-ux",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(mentorshipOngoing, true),
        createdAt: historicalPurchaseTime(mentorshipOngoing),
        eventSlug: mentorshipOngoing.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(mentorshipOngoing), 1),
        idempotencyKey: "seed:event:admin-explorer:mentorship-program",
        kind: "event_ticket",
        squarePaymentId: "seed:payment:admin-explorer:mentorship-program",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(industryTalkUpcoming, true),
        createdAt: recentPurchaseTime,
        eventSlug: industryTalkUpcoming.event.slug,
        fulfilledAt: afterTimestamp(recentPurchaseTime, 1),
        idempotencyKey: "seed:event:admin-explorer:industry-talk-design-systems",
        kind: "event_ticket",
        squarePaymentId:
          "seed:payment:admin-explorer:industry-talk-design-systems",
        status: "completed",
      },
    ],
    registrations: [
      {
        eventSlug: industryTalkPast.event.slug,
        purchaseKey: "seed:event:admin-explorer:industry-talk-ai-and-ux",
        status: "accepted",
        attending: true,
        checkIns: {
          "Door Check-in": afterTimestamp(industryCheckIn, 8),
        },
      },
      {
        eventSlug: mentorshipOngoing.event.slug,
        purchaseKey: "seed:event:admin-explorer:mentorship-program",
        status: "accepted",
        attending: true,
      },
      {
        eventSlug: industryTalkUpcoming.event.slug,
        purchaseKey: "seed:event:admin-explorer:industry-talk-design-systems",
        status: "accepted",
        attending: true,
      },
      {
        eventSlug: designSprintPast.event.slug,
        status: "accepted",
        attending: true,
        responses: {
          [designSprintQuestions.year]: "3",
          [designSprintQuestions.figma]: "Comfortable building screens",
          [designSprintQuestions.goal]:
            "I want to practice turning research into a focused prototype and get more confident presenting design decisions.",
          [designSprintQuestions.dietary]: "Vegetarian",
        },
        checkIns: {
          "Morning Check-in": afterTimestamp(
            designSprintCheckIns[0].start_time!,
            6
          ),
          "Post-Lunch Check-in": afterTimestamp(
            designSprintCheckIns[1].start_time!,
            7
          ),
        },
      },
      {
        eventSlug: uxathonPast.event.slug,
        status: "declined",
        attending: false,
        responses: {
          [uxathonQuestions.year]: "3",
          [uxathonQuestions.contribution]: "User research, Prototyping",
          [uxathonQuestions.experience]: "Once or twice",
          [uxathonQuestions.problem]:
            "I worked on a campus wayfinding concept. The hardest part was separating navigation problems from gaps in the underlying signage system.",
          [uxathonQuestions.teammates]: "",
        },
      },
      {
        // Pending application on the draft workshop: the admin review queue
        // needs something waiting in it.
        eventSlug: researchWorkshopDraft.event.slug,
        status: "pending",
        attending: false,
        responses: {
          [designSprintQuestions.year]: "3",
          [designSprintQuestions.figma]:
            "I build components and use auto-layout daily",
          [designSprintQuestions.goal]:
            "I want to mentor newer teammates while sharpening how I scope research under a tight deadline.",
          [designSprintQuestions.dietary]: "Vegetarian",
        },
      },
    ],
  },
  {
    email: "no-membership@example.com",
    password: SEED_PASSWORD,
    membershipSlug: null,
    fullEventHistory: true,
    profile: studentProfile({
      firstName: "Maya",
      lastName: "Patel",
      phone: "6045550102",
      pronouns: "she/her",
      studentNumber: 10000002,
      faculty: "Faculty of Science",
      major: "Computer Science",
      year: "2",
    }),
    purchases: [
      {
        amountCents: ticketPriceCents(industryTalkPast, false),
        createdAt: historicalPurchaseTime(industryTalkPast),
        eventSlug: industryTalkPast.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(industryTalkPast), 1),
        idempotencyKey: "seed:event:no-membership:industry-talk-ai-and-ux",
        kind: "event_ticket",
        squarePaymentId: "seed:payment:no-membership:industry-talk-ai-and-ux",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(mentorshipOngoing, false),
        createdAt: historicalPurchaseTime(mentorshipOngoing),
        eventSlug: mentorshipOngoing.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(mentorshipOngoing), 1),
        idempotencyKey: "seed:event:no-membership:mentorship-program",
        kind: "event_ticket",
        squarePaymentId: "seed:payment:no-membership:mentorship-program",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(industryTalkUpcoming, false),
        createdAt: recentPurchaseTime,
        eventSlug: industryTalkUpcoming.event.slug,
        fulfilledAt: afterTimestamp(recentPurchaseTime, 1),
        idempotencyKey:
          "seed:event:no-membership:industry-talk-design-systems:completed",
        kind: "event_ticket",
        squarePaymentId:
          "seed:payment:no-membership:industry-talk-design-systems:completed",
        status: "completed",
      },
      {
        // The failed-payment path: a purchase row with no registration behind
        // it, which is also the only kind an admin is allowed to delete.
        amountCents: ticketPriceCents(industryTalkUpcoming, false),
        createdAt: failedPurchaseTime,
        eventSlug: industryTalkUpcoming.event.slug,
        failureReason: "Seeded card decline for testing",
        idempotencyKey:
          "seed:event:no-membership:industry-talk-design-systems:failed",
        kind: "event_ticket",
        status: "failed",
      },
    ],
    registrations: [
      {
        eventSlug: industryTalkPast.event.slug,
        purchaseKey: "seed:event:no-membership:industry-talk-ai-and-ux",
        status: "accepted",
        attending: true,
        checkIns: {
          "Door Check-in": afterTimestamp(industryCheckIn, 8),
        },
      },
      {
        eventSlug: mentorshipOngoing.event.slug,
        purchaseKey: "seed:event:no-membership:mentorship-program",
        status: "accepted",
        attending: true,
      },
      {
        eventSlug: industryTalkUpcoming.event.slug,
        purchaseKey:
          "seed:event:no-membership:industry-talk-design-systems:completed",
        status: "accepted",
        attending: true,
      },
      {
        eventSlug: uxathonPast.event.slug,
        reviewerEmail: "admin-explorer@example.com",
        status: "declined",
        attending: false,
        responses: {
          [uxathonQuestions.year]: "2",
          [uxathonQuestions.contribution]:
            "Visual and UI design, Content and copy",
          [uxathonQuestions.experience]: "No, this is my first",
          [uxathonQuestions.problem]:
            "I redesigned a course-registration flow. The difficult part was showing prerequisite conflicts without overwhelming students.",
          [uxathonQuestions.teammates]: "Jordan Lee",
        },
      },
      {
        eventSlug: researchWorkshopDraft.event.slug,
        status: "pending",
        attending: false,
        responses: {
          [designSprintQuestions.year]: "2",
          [designSprintQuestions.figma]: "I can follow a tutorial",
          [designSprintQuestions.goal]:
            "I want to experience an end-to-end design process and leave with a project I can keep developing.",
          [designSprintQuestions.dietary]: "None",
        },
      },
    ],
  },
  {
    email: "student-innovator@example.com",
    password: SEED_PASSWORD,
    membershipSlug: "innovator",
    fullEventHistory: true,
    profile: studentProfile({
      firstName: "Daniel",
      lastName: "Kim",
      phone: "6045550103",
      pronouns: "he/him",
      dietary: "Gluten-free",
      newsletter: true,
      studentNumber: 10000003,
      faculty: "Faculty of Applied Science",
      major: "Integrated Engineering",
      year: "4",
    }),
    purchases: [
      membershipPurchase(
        "student-innovator",
        "innovator",
        timestamp(addDays(today, -45), 16)
      ),
      {
        amountCents: ticketPriceCents(industryTalkPast, true),
        createdAt: historicalPurchaseTime(industryTalkPast),
        eventSlug: industryTalkPast.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(industryTalkPast), 1),
        idempotencyKey: "seed:event:student-innovator:industry-talk-ai-and-ux",
        kind: "event_ticket",
        squarePaymentId:
          "seed:payment:student-innovator:industry-talk-ai-and-ux",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(mentorshipOngoing, true),
        createdAt: historicalPurchaseTime(mentorshipOngoing),
        eventSlug: mentorshipOngoing.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(mentorshipOngoing), 1),
        idempotencyKey: "seed:event:student-innovator:mentorship-program",
        kind: "event_ticket",
        squarePaymentId: "seed:payment:student-innovator:mentorship-program",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(industryTalkUpcoming, true),
        createdAt: recentPurchaseTime,
        eventSlug: industryTalkUpcoming.event.slug,
        fulfilledAt: afterTimestamp(recentPurchaseTime, 1),
        idempotencyKey:
          "seed:event:student-innovator:industry-talk-design-systems",
        kind: "event_ticket",
        squarePaymentId:
          "seed:payment:student-innovator:industry-talk-design-systems",
        status: "completed",
      },
    ],
    registrations: [
      {
        eventSlug: industryTalkPast.event.slug,
        purchaseKey: "seed:event:student-innovator:industry-talk-ai-and-ux",
        status: "accepted",
        attending: true,
        checkIns: {
          "Door Check-in": afterTimestamp(industryCheckIn, 12),
        },
      },
      {
        eventSlug: mentorshipOngoing.event.slug,
        purchaseKey: "seed:event:student-innovator:mentorship-program",
        status: "accepted",
        attending: true,
      },
      {
        eventSlug: industryTalkUpcoming.event.slug,
        purchaseKey:
          "seed:event:student-innovator:industry-talk-design-systems",
        status: "accepted",
        attending: true,
      },
      {
        // A free past event attended without a purchase behind it.
        eventSlug: getToKnowPast.event.slug,
        status: "accepted",
        attending: true,
        checkIns: {
          "Door Check-in": afterTimestamp(getToKnowCheckIn, 5),
        },
      },
    ],
  },

  /* ── Grid fixtures ───────────────────────────────────────────────────────
   * Every membership state crossed with both roles, so any combination can be
   * signed into without hand-editing the database. Membership purchase only:
   * event history lives on the three accounts above.
   */
  {
    email: "student-explorer@example.com",
    password: SEED_PASSWORD,
    membershipSlug: "explorer",
    fullEventHistory: false,
    profile: studentProfile({
      firstName: "Sofia",
      lastName: "Martinez",
      phone: "6045550104",
      pronouns: "she/her",
      studentNumber: 10000004,
      faculty: "Faculty of Arts",
      major: "Psychology",
      year: "1",
    }),
    purchases: [
      membershipPurchase("student-explorer", "explorer", gridPurchaseTime),
    ],
    registrations: [],
  },
  {
    email: "faculty-member@ubc.ca",
    password: SEED_PASSWORD,
    membershipSlug: "faculty",
    fullEventHistory: false,
    profile: facultyProfile({
      firstName: "Avery",
      lastName: "Okafor",
      phone: "6045550105",
      pronouns: "they/them",
      email: "faculty-member@ubc.ca",
      faculty: "Faculty of Education",
    }),
    purchases: [
      membershipPurchase("faculty-member", "faculty", gridPurchaseTime),
    ],
    registrations: [],
  },
  {
    email: "non-ubc@example.com",
    password: SEED_PASSWORD,
    membershipSlug: "non-ubc",
    fullEventHistory: false,
    profile: nonUbcProfile({
      firstName: "Mateo",
      lastName: "Nguyen",
      phone: "6045550106",
      pronouns: "he/him",
      schoolInstitution: "Emily Carr University of Art and Design",
      studentStatus: "undergraduate",
      year: "3",
    }),
    purchases: [
      membershipPurchase("non-ubc", "non-ubc", gridPurchaseTime),
    ],
    registrations: [],
  },
  {
    email: "admin-innovator@example.com",
    password: SEED_PASSWORD,
    membershipSlug: "innovator",
    fullEventHistory: false,
    profile: studentProfile({
      firstName: "Priya",
      lastName: "Shah",
      phone: "6045550107",
      pronouns: "she/her",
      admin: true,
      newsletter: true,
      studentNumber: 10000005,
      faculty: "Sauder School of Business",
      major: "Business and Computer Science",
      year: "4",
    }),
    purchases: [
      membershipPurchase("admin-innovator", "innovator", gridPurchaseTime),
    ],
    registrations: [],
  },
  {
    email: "admin-faculty@ubc.ca",
    password: SEED_PASSWORD,
    membershipSlug: "faculty",
    fullEventHistory: false,
    profile: facultyProfile({
      firstName: "Nadia",
      lastName: "Rahman",
      phone: "6045550108",
      pronouns: "she/her",
      admin: true,
      email: "admin-faculty@ubc.ca",
      faculty: "Faculty of Science",
    }),
    purchases: [
      membershipPurchase("admin-faculty", "faculty", gridPurchaseTime),
    ],
    registrations: [],
  },
  {
    email: "admin-non-ubc@example.com",
    password: SEED_PASSWORD,
    membershipSlug: "non-ubc",
    fullEventHistory: false,
    profile: nonUbcProfile({
      firstName: "Jordan",
      lastName: "Dubois",
      phone: "6045550109",
      pronouns: "they/them",
      admin: true,
      schoolInstitution: "Simon Fraser University",
      studentStatus: "graduate",
    }),
    purchases: [
      membershipPurchase("admin-non-ubc", "non-ubc", gridPurchaseTime),
    ],
    registrations: [],
  },
  {
    email: "admin-no-membership@example.com",
    password: SEED_PASSWORD,
    membershipSlug: null,
    fullEventHistory: false,
    profile: studentProfile({
      firstName: "Lucas",
      lastName: "Wong",
      phone: "6045550110",
      pronouns: "he/him",
      admin: true,
      studentNumber: 10000006,
      faculty: "Faculty of Forestry",
      major: "Urban Forestry",
      year: "2",
    }),
    purchases: [],
    registrations: [],
  },
  ];
}

export const seedUsers = buildSeedUsers(seedEvents, new Date());
