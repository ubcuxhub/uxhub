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

export interface SeedApplication {
  attendanceStatus?:
    | "awaiting_confirmation"
    | "confirmed"
    | "not_attending"
    | null;
  eventSlug: string;
  responses: Record<string, string>;
  reviewerEmail?: string;
  status: "pending" | "accepted" | "rejected";
}

export interface SeedRegistration {
  checkIns?: Record<string, string>;
  eventSlug: string;
  purchaseKey?: string;
}

export interface SeedUser {
  applications: SeedApplication[];
  email: string;
  membershipSlug: string | null;
  password: string;
  profile: Omit<
    TablesInsert<"user_info">,
    | "auth_user_id"
    | "email"
    | "membership_expires_at"
    | "membership_pre_ordered_type_id"
    | "membership_type_id"
  >;
  purchases: SeedPurchase[];
  registrations: SeedRegistration[];
}

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

export function buildSeedUsers(events: SeedEvent[], now: Date): SeedUser[] {
  const today = startOfUtcDay(now);
  const designSprintPast = requireEvent(events, "design-sprint-2025");
  const uxathonPast = requireEvent(events, "uxathon-2026");
  const designSprintFuture = requireEvent(events, "design-sprint-2026");
  const industryTalkPast = requireEvent(events, "industry-talk-ai-and-ux-2026");
  const mentorshipOngoing = requireEvent(events, "student-panel-2025");
  const thinkboxFuture = requireEvent(events, "thinkbox-office-tour-2027");
  const portfolioReviewFuture = requireEvent(events, "portfolio-review-night-2027");
  const industryCheckIn = industryTalkPast.checkInSessions[0]?.start_time;
  const designSprintCheckIns = designSprintPast.checkInSessions;

  if (!industryCheckIn || designSprintCheckIns.length < 2) {
    throw new Error("Purchased event fixtures need their expected check-in sessions");
  }

  const historicalPurchaseTime = (event: SeedEvent) => {
    const registrationStart = event.event.registration_start_time;
    if (!registrationStart) throw new Error(`Event "${event.event.slug}" has no registration start`);
    return afterTimestamp(registrationStart, 24 * 60);
  };
  const futurePurchaseTime = timestamp(addDays(today, -7), 18);
  const failedPurchaseTime = timestamp(addDays(today, -3), 18);

  return [
  {
    email: "admin-explorer@gmail.com",
    password: "ux-hub",
    membershipSlug: "explorer",
    profile: {
      name: "Admin Explorer",
      phone: "6045550101",
      student_number: 10000001,
      faculty: "Faculty of Arts",
      major: "Cognitive Systems",
      year: "3",
      role_access: "admin",
      user_type: "ubcStudent",
      dietary_restrictions: "Vegetarian",
      newsletter: true,
      preferred_pronouns: "they/them",
      square_customer_id: null,
    },
    purchases: [
      {
        amountCents: 1200,
        createdAt: timestamp(addDays(today, -30), 17),
        fulfilledAt: timestamp(addDays(today, -30), 17, 1),
        idempotencyKey: "seed:membership:admin-explorer:explorer",
        kind: "membership",
        membershipSlug: "explorer",
        squarePaymentId: "seed:payment:admin-explorer:explorer",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(industryTalkPast, true),
        createdAt: historicalPurchaseTime(industryTalkPast),
        eventSlug: industryTalkPast.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(industryTalkPast), 1),
        idempotencyKey: "seed:event:admin-explorer:industry-talk-ai-and-ux-2026",
        kind: "event_ticket",
        squarePaymentId:
          "seed:payment:admin-explorer:industry-talk-ai-and-ux-2026",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(mentorshipOngoing, true),
        createdAt: historicalPurchaseTime(mentorshipOngoing),
        eventSlug: mentorshipOngoing.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(mentorshipOngoing), 1),
        idempotencyKey: "seed:event:admin-explorer:student-panel-2025",
        kind: "event_ticket",
        squarePaymentId: "seed:payment:admin-explorer:student-panel-2025",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(thinkboxFuture, true),
        createdAt: futurePurchaseTime,
        eventSlug: thinkboxFuture.event.slug,
        fulfilledAt: afterTimestamp(futurePurchaseTime, 1),
        idempotencyKey: "seed:event:admin-explorer:thinkbox-office-tour-2027",
        kind: "event_ticket",
        squarePaymentId:
          "seed:payment:admin-explorer:thinkbox-office-tour-2027",
        status: "completed",
      },
    ],
    applications: [
      {
        attendanceStatus: "confirmed",
        eventSlug: designSprintPast.event.slug,
        reviewerEmail: "admin-explorer@gmail.com",
        status: "accepted",
        responses: {
          [designSprintQuestions.year]: "3",
          [designSprintQuestions.figma]: "Comfortable building screens",
          [designSprintQuestions.goal]:
            "I want to practice turning research into a focused prototype and get more confident presenting design decisions.",
          [designSprintQuestions.dietary]: "Vegetarian",
        },
      },
      {
        eventSlug: uxathonPast.event.slug,
        reviewerEmail: "admin-explorer@gmail.com",
        status: "rejected",
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
        eventSlug: designSprintFuture.event.slug,
        status: "pending",
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
    registrations: [
      {
        eventSlug: industryTalkPast.event.slug,
        purchaseKey:
          "seed:event:admin-explorer:industry-talk-ai-and-ux-2026",
        checkIns: {
          "Door Check-in": afterTimestamp(industryCheckIn, 8),
        },
      },
      {
        eventSlug: mentorshipOngoing.event.slug,
        purchaseKey: "seed:event:admin-explorer:student-panel-2025",
      },
      {
        eventSlug: thinkboxFuture.event.slug,
        purchaseKey:
          "seed:event:admin-explorer:thinkbox-office-tour-2027",
      },
      {
        eventSlug: designSprintPast.event.slug,
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
    ],
  },
  {
    email: "not-member@gmail.com",
    password: "ux-hub",
    membershipSlug: null,
    profile: {
      name: "Not Member",
      phone: "6045550102",
      student_number: 10000002,
      faculty: "Faculty of Science",
      major: "Computer Science",
      year: "2",
      role_access: "basic",
      user_type: "ubcStudent",
      dietary_restrictions: null,
      newsletter: false,
      preferred_pronouns: "she/her",
      square_customer_id: null,
    },
    purchases: [
      {
        amountCents: ticketPriceCents(industryTalkPast, false),
        createdAt: historicalPurchaseTime(industryTalkPast),
        eventSlug: industryTalkPast.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(industryTalkPast), 1),
        idempotencyKey: "seed:event:not-member:industry-talk-ai-and-ux-2026",
        kind: "event_ticket",
        squarePaymentId:
          "seed:payment:not-member:industry-talk-ai-and-ux-2026",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(mentorshipOngoing, false),
        createdAt: historicalPurchaseTime(mentorshipOngoing),
        eventSlug: mentorshipOngoing.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(mentorshipOngoing), 1),
        idempotencyKey: "seed:event:not-member:student-panel-2025",
        kind: "event_ticket",
        squarePaymentId: "seed:payment:not-member:student-panel-2025",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(thinkboxFuture, false),
        createdAt: futurePurchaseTime,
        eventSlug: thinkboxFuture.event.slug,
        fulfilledAt: afterTimestamp(futurePurchaseTime, 1),
        idempotencyKey:
          "seed:event:not-member:thinkbox-office-tour-2027:completed",
        kind: "event_ticket",
        squarePaymentId:
          "seed:payment:not-member:thinkbox-office-tour-2027:completed",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(thinkboxFuture, false),
        createdAt: failedPurchaseTime,
        eventSlug: thinkboxFuture.event.slug,
        failureReason: "Seeded card decline for testing",
        idempotencyKey: "seed:event:not-member:thinkbox-office-tour-2027:failed",
        kind: "event_ticket",
        status: "failed",
      },
    ],
    applications: [
      {
        eventSlug: uxathonPast.event.slug,
        reviewerEmail: "admin-explorer@gmail.com",
        status: "rejected",
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
        eventSlug: designSprintFuture.event.slug,
        status: "pending",
        responses: {
          [designSprintQuestions.year]: "2",
          [designSprintQuestions.figma]: "I can follow a tutorial",
          [designSprintQuestions.goal]:
            "I want to experience an end-to-end design process and leave with a project I can keep developing.",
          [designSprintQuestions.dietary]: "None",
        },
      },
    ],
    registrations: [
      {
        eventSlug: industryTalkPast.event.slug,
        purchaseKey: "seed:event:not-member:industry-talk-ai-and-ux-2026",
        checkIns: {
          "Door Check-in": afterTimestamp(industryCheckIn, 8),
        },
      },
      {
        eventSlug: mentorshipOngoing.event.slug,
        purchaseKey: "seed:event:not-member:student-panel-2025",
      },
      {
        eventSlug: thinkboxFuture.event.slug,
        purchaseKey:
          "seed:event:not-member:thinkbox-office-tour-2027:completed",
      },
    ],
  },
  {
    email: "mock-member@example.com",
    password: "ux-hub",
    membershipSlug: "innovator",
    profile: {
      name: "Mock Member",
      phone: "6045550103",
      student_number: 10000003,
      faculty: "Faculty of Applied Science",
      major: "Integrated Engineering",
      year: "4",
      role_access: "basic",
      user_type: "ubcStudent",
      dietary_restrictions: "Gluten-free",
      newsletter: true,
      preferred_pronouns: "he/him",
      square_customer_id: null,
    },
    purchases: [
      {
        amountCents: 1800,
        createdAt: timestamp(addDays(today, -45), 16),
        fulfilledAt: timestamp(addDays(today, -45), 16, 1),
        idempotencyKey: "seed:membership:mock-member:innovator",
        kind: "membership",
        membershipSlug: "innovator",
        squarePaymentId: "seed:payment:mock-member:innovator",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(industryTalkPast, true),
        createdAt: historicalPurchaseTime(industryTalkPast),
        eventSlug: industryTalkPast.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(industryTalkPast), 1),
        idempotencyKey: "seed:event:mock-member:industry-talk-ai-and-ux-2026",
        kind: "event_ticket",
        squarePaymentId:
          "seed:payment:mock-member:industry-talk-ai-and-ux-2026",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(mentorshipOngoing, true),
        createdAt: historicalPurchaseTime(mentorshipOngoing),
        eventSlug: mentorshipOngoing.event.slug,
        fulfilledAt: afterTimestamp(historicalPurchaseTime(mentorshipOngoing), 1),
        idempotencyKey: "seed:event:mock-member:student-panel-2025",
        kind: "event_ticket",
        squarePaymentId: "seed:payment:mock-member:student-panel-2025",
        status: "completed",
      },
      {
        amountCents: ticketPriceCents(portfolioReviewFuture, true),
        createdAt: futurePurchaseTime,
        eventSlug: portfolioReviewFuture.event.slug,
        fulfilledAt: afterTimestamp(futurePurchaseTime, 1),
        idempotencyKey: "seed:event:mock-member:portfolio-review-night-2027",
        kind: "event_ticket",
        squarePaymentId:
          "seed:payment:mock-member:portfolio-review-night-2027",
        status: "completed",
      },
    ],
    applications: [],
    registrations: [
      {
        eventSlug: industryTalkPast.event.slug,
        purchaseKey:
          "seed:event:mock-member:industry-talk-ai-and-ux-2026",
        checkIns: {
          "Door Check-in": afterTimestamp(industryCheckIn, 12),
        },
      },
      {
        eventSlug: mentorshipOngoing.event.slug,
        purchaseKey: "seed:event:mock-member:student-panel-2025",
      },
      {
        eventSlug: portfolioReviewFuture.event.slug,
        purchaseKey:
          "seed:event:mock-member:portfolio-review-night-2027",
      },
    ],
  },
  ];
}

export const seedUsers = buildSeedUsers(seedEvents, new Date());
