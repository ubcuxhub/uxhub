import type { TablesInsert } from "../../../src/lib/supabase/database.types.ts";
import { addDays, startOfUtcDay, timestamp } from "../lib/relative-dates.ts";
import { encodeCheckboxResponse } from "../../../src/lib/application-response.ts";
import type {
  AllergyId,
  DietId,
  SetupStep,
} from "../../../src/features/setup/lib/options.ts";
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
  /** A draft may leave required questions unanswered. */
  status: "draft" | "submitted" | "waitlisted" | "accepted" | "rejected";
  /** Required when accepted (docs/event-states.md). */
  offerExpiresAt?: string;
  /**
   * When it left draft, which the admin review list sorts by. Required for
   * everything but a draft: left out, the database would stamp the run time.
   */
  submittedAt?: string;
}

/**
 * One account's part in one event: a ticket, an application, or both. Applications
 * exist only on events that take them; responses need one, check-ins a ticket.
 */
export interface SeedRegistration {
  checkIns?: Record<string, string>;
  eventSlug: string;
  /** The completed purchase behind a paid ticket. */
  purchaseKey?: string;
  responses?: Record<string, string>;
  /**
   * File answers, question to file name. The seed uploads a small PDF to the
   * `application-files` bucket at the path the app would use, which needs the
   * application's id, and stores that path as the answer.
   */
  files?: Record<string, string>;
  ticket: boolean;
  application?: SeedApplication;
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
  /**
   * When the membership ends. Defaults to a year from the run; set it in the
   * past for a lapsed member (`membership_type_id` is never cleared when a
   * membership lapses, see `hasActiveOrPendingMembership`).
   */
  membershipExpiresAt?: string;
  /**
   * A membership bought but not yet paid for: `membership_pre_ordered_type_id`,
   * shown as "Pending — payment processing". Needs a pending or authorized
   * purchase of the same tier.
   */
  membershipPreOrderedSlug?: string;
  /** Null for a crowd account, which has a profile but no Auth user. */
  password: string | null;
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
  /**
   * Marks a UBC student as manually verified by the named manager fixture.
   * Written after every profile exists, since `student_verified_by` points at
   * the manager's row, which a fresh database has not created yet.
   */
  studentVerification?: { verifiedByEmail: string; verifiedAt: string };
  /**
   * A UBC verification by code or sign-in email. Left out, `withUbcVerification`
   * derives the rest: `manual` comes from `studentVerification`, an active or
   * pending UBC member is `grandfathered` (as the migration stamped them), and
   * anyone else is unverified, so the code flow can be tried through the dev
   * log. A faculty account's `ubc_email` is its `faculty_email`.
   */
  ubcVerification?: SeedUbcVerification;
}

export interface SeedUbcVerification {
  via: "code" | "sign_in_email";
  /** Must qualify for the account's type; a `sign_in_email` one is the account's own. */
  email: string;
  verifiedAt: string;
}

/**
 * When grandfathered fixtures were stamped. Fixed, so a second run writes the
 * same value and changes nothing.
 */
export const SEED_UBC_GRANDFATHERED_AT = "2026-11-10T05:09:57.000Z";

function holdsActiveOrPendingMembership(user: SeedUser, now: Date) {
  if (user.membershipPreOrderedSlug) return true;
  if (!user.membershipSlug) return false;
  return !user.membershipExpiresAt || new Date(user.membershipExpiresAt) > now;
}

/**
 * Writes the UBC verification columns into a fixture's profile, so every run
 * resets them to what the data describes. `manual` is applied later, once the
 * verifying manager's row exists (see `reconcileStudentVerification`).
 */
export function withUbcVerification(user: SeedUser, now: Date): SeedUser {
  const { profile } = user;
  const columns: Pick<
    SeedProfile,
    "ubc_email" | "ubc_verified_at" | "ubc_verified_via" | "ubc_verified_by"
  > = { ubc_email: null, ubc_verified_at: null, ubc_verified_via: null, ubc_verified_by: null };

  if (profile.user_type === "ubcStudent" || profile.user_type === "faculty") {
    if (profile.user_type === "faculty") columns.ubc_email = profile.faculty_email ?? null;
    if (user.ubcVerification) {
      columns.ubc_email = user.ubcVerification.email;
      columns.ubc_verified_at = user.ubcVerification.verifiedAt;
      columns.ubc_verified_via = user.ubcVerification.via;
    } else if (!user.studentVerification && holdsActiveOrPendingMembership(user, now)) {
      columns.ubc_verified_at = SEED_UBC_GRANDFATHERED_AT;
      columns.ubc_verified_via = "grandfathered";
    }
  }
  return { ...user, profile: { ...profile, ...columns } };
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

export const designSprintQuestions = {
  year: "What year of study are you in?",
  figma: "How would you describe your experience with Figma?",
  goal: "What do you want to walk away from the Design Sprint with? Two or three sentences is plenty.",
  dietary: "Any dietary restrictions we should know about for lunch?",
} as const;

export const uxathonQuestions = {
  year: "What year of study are you in?",
  contribution: "Which area do you most want to contribute in?",
  experience: "Have you participated in a hackathon or design sprint before?",
  problem: "Tell us about a design problem you have worked on recently. What was hard about it?",
  teammates: "Are you applying with teammates? List their names and we will keep you together.",
  heardFrom: "How did you hear about UXathon?",
  portfolio: "Attach a resume or portfolio if you have one (PDF, up to 5 MB).",
} as const;

export function requireEvent(events: SeedEvent[], slug: string): SeedEvent {
  const event = events.find((candidate) => candidate.event.slug === slug);
  if (!event) throw new Error(`Missing seed event "${slug}"`);
  return event;
}

export function ticketPriceCents(event: SeedEvent, isMember: boolean): number {
  const price = isMember ? event.event.member_price : event.event.regular_price;
  return Math.round(Number(price) * 100);
}

export function afterTimestamp(value: string, minutes: number): string {
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
export interface CommonProfileInput {
  firstName: string;
  birthDate?: string;
  interests?: string[];
  lastName: string;
  phone: string;
  pronouns: string;
  admin?: boolean;
  role?: TablesInsert<"user_info">["role_access"];
  diets?: DietId[];
  allergies?: AllergyId[];
  otherAllergies?: string[];
  /** Defaults to `done`: only the dedicated new-member fixture starts setup. */
  setupStep?: SetupStep;
  /**
   * Whether the account answered "What best describes you?". Defaults to
   * true: every fixture but new-member chose its type through the join flow,
   * like the members the migration backfilled, so join skips the question.
   */
  userTypeConfirmed?: boolean;
  newsletter?: boolean;
}

/**
 * When the confirmed fixtures answered. Fixed, so a second run writes the
 * same value and changes nothing.
 */
export const SEED_USER_TYPE_CONFIRMED_AT = "2026-09-01T16:00:00.000Z";

function baseProfile(input: CommonProfileInput) {
  return {
    first_name: input.firstName,
    birth_date: input.birthDate ?? null,
    interests: input.interests ?? [],
    // Only managers set these, through the admin dialog. Writing them on every
    // run is what undoes a verification or photo added through the UI; the
    // fixtures that should start verified get it in a later pass.
    profile_photo_path: null,
    student_verified_at: null,
    student_verified_by: null,
    last_name: input.lastName,
    phone: input.phone,
    preferred_pronouns: input.pronouns,
    role_access: input.role ?? (input.admin ? "admin" : "basic"),
    // Written in full every run, which undoes setup done through the UI.
    // The legacy free text mirrors `other_allergies` (see the migration), so
    // it is written to match rather than left to keep an old value.
    setup_step: input.setupStep ?? "done",
    user_type_confirmed_at: (input.userTypeConfirmed ?? true) ? SEED_USER_TYPE_CONFIRMED_AT : null,
    diets: input.diets ?? [],
    allergies: input.allergies ?? [],
    other_allergies: input.otherAllergies ?? [],
    dietary_restrictions: input.otherAllergies?.length ? input.otherAllergies.join(", ") : null,
    avatar_preset: null,
    newsletter: input.newsletter ?? false,
    square_customer_id: null,
  };
}

export function studentProfile(
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

export function facultyProfile(
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

export function nonUbcProfile(
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
export const MEMBERSHIP_PRICE_CENTS = {
  explorer: 1200,
  innovator: 1800,
  faculty: 1800,
  "non-ubc": 2400,
} as const;

export type MembershipSlug = keyof typeof MEMBERSHIP_PRICE_CENTS;

/**
 * The membership purchase every member fixture needs.
 *
 * `validateUserFixtures` requires a member to hold a completed purchase for
 * their own tier, so this is the minimum a grid account can carry.
 */
export function membershipPurchase(
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
 * run. Purchase history instead hangs off the past events, the ongoing
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
  const uxathonUpcoming = requireEvent(events, "uxathon-upcoming");
  const designJamToday = requireEvent(events, "design-jam-today");

  const industryCheckIn = industryTalkPast.checkInSessions[0]?.start_time;
  const getToKnowCheckIn = getToKnowPast.checkInSessions[0]?.start_time;
  const designSprintCheckIns = designSprintPast.checkInSessions;

  if (!industryCheckIn || !getToKnowCheckIn || designSprintCheckIns.length < 2) {
    throw new Error("Purchased event fixtures need their expected check-in sessions");
  }

  const historicalPurchaseTime = (event: SeedEvent) => {
    const registrationStart = event.event.registration_opens_at;
    if (!registrationStart) throw new Error(`Event "${event.event.slug}" has no registration start`);
    return afterTimestamp(registrationStart, 24 * 60);
  };
  const recentPurchaseTime = timestamp(addDays(today, -7), 18);
  const failedPurchaseTime = timestamp(addDays(today, -3), 18);

  const gridPurchaseTime = timestamp(addDays(today, -60), 15);

  const users: SeedUser[] = [
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
      birthDate: "2003-03-14",
      interests: ["UX research", "Interaction design", "Accessibility"],
      lastName: "Chen",
      phone: "6045550101",
      pronouns: "they/them",
      admin: true,
      diets: ["vegetarian"],
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
        ticket: true,
        checkIns: {
          "Door Check-in": afterTimestamp(industryCheckIn, 8),
        },
      },
      {
        eventSlug: mentorshipOngoing.event.slug,
        purchaseKey: "seed:event:admin-explorer:mentorship-program",
        ticket: true,
      },
      {
        eventSlug: industryTalkUpcoming.event.slug,
        purchaseKey: "seed:event:admin-explorer:industry-talk-design-systems",
        ticket: true,
      },
      {
        eventSlug: designSprintPast.event.slug,
        ticket: true,
        application: {
          status: "accepted",
          offerExpiresAt: historicalPurchaseTime(designSprintPast),
          submittedAt: afterTimestamp(
            designSprintPast.event.registration_opens_at!,
            3 * 60
          ),
        },
        responses: {
          [designSprintQuestions.year]: "3",
          [designSprintQuestions.figma]: "Comfortable building screens",
          [designSprintQuestions.goal]:
            "I want to practice turning research into a focused prototype and get more confident presenting design decisions.",
          [designSprintQuestions.dietary]: encodeCheckboxResponse(["Vegetarian"]),
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
        ticket: false,
        application: {
          status: "rejected",
          submittedAt: afterTimestamp(uxathonPast.event.registration_opens_at!, 26 * 60),
        },
        responses: {
          [uxathonQuestions.year]: "3",
          // Comma-joined, as answers were stored before drafts: the admin
          // review page still has to read this form.
          [uxathonQuestions.contribution]: "User research, Prototyping",
          [uxathonQuestions.experience]: "Once or twice",
          [uxathonQuestions.heardFrom]: "A friend or classmate",
          [uxathonQuestions.problem]:
            "I worked on a campus wayfinding concept. The hardest part was separating navigation problems from gaps in the underlying signage system.",
          [uxathonQuestions.teammates]: "",
        },
      },
      {
        // Pending application on the draft workshop: the admin review queue
        // needs something waiting in it.
        eventSlug: researchWorkshopDraft.event.slug,
        ticket: false,
        application: { status: "submitted", submittedAt: timestamp(addDays(today, -4), 21, 12) },
        responses: {
          [designSprintQuestions.year]: "3",
          [designSprintQuestions.figma]:
            "I build components and use auto-layout daily",
          [designSprintQuestions.goal]:
            "I want to mentor newer teammates while sharpening how I scope research under a tight deadline.",
          [designSprintQuestions.dietary]: encodeCheckboxResponse(["Vegetarian"]),
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
      birthDate: "2005-07-22",
      interests: ["Visual design", "Illustration", "Photography"],
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
        ticket: true,
        checkIns: {
          "Door Check-in": afterTimestamp(industryCheckIn, 8),
        },
      },
      {
        eventSlug: mentorshipOngoing.event.slug,
        purchaseKey: "seed:event:no-membership:mentorship-program",
        ticket: true,
      },
      {
        eventSlug: industryTalkUpcoming.event.slug,
        purchaseKey:
          "seed:event:no-membership:industry-talk-design-systems:completed",
        ticket: true,
      },
      {
        eventSlug: uxathonPast.event.slug,
        ticket: false,
        application: {
          status: "rejected",
          submittedAt: afterTimestamp(uxathonPast.event.registration_opens_at!, 50 * 60),
        },
        responses: {
          [uxathonQuestions.year]: "2",
          [uxathonQuestions.contribution]: encodeCheckboxResponse([
            "Visual and UI design",
            "Content and copy",
          ]),
          [uxathonQuestions.experience]: "No, this is my first",
          [uxathonQuestions.heardFrom]: "UX Hub newsletter",
          [uxathonQuestions.problem]:
            "I redesigned a course-registration flow. The difficult part was showing prerequisite conflicts without overwhelming students.",
          [uxathonQuestions.teammates]: "Jordan Lee",
        },
      },
      {
        // Waitlisted, so the review queue shows more than one state.
        eventSlug: researchWorkshopDraft.event.slug,
        ticket: false,
        application: { status: "waitlisted", submittedAt: timestamp(addDays(today, -6), 17, 40) },
        responses: {
          [designSprintQuestions.year]: "2",
          [designSprintQuestions.figma]: "I can follow a tutorial",
          [designSprintQuestions.goal]:
            "I want to experience an end-to-end design process and leave with a project I can keep developing.",
          [designSprintQuestions.dietary]: encodeCheckboxResponse(["None"]),
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
      birthDate: "2002-11-08",
      interests: ["Prototyping", "Design systems", "Creative coding"],
      lastName: "Kim",
      phone: "6045550103",
      pronouns: "he/him",
      allergies: ["gluten"],
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
        ticket: true,
        checkIns: {
          "Door Check-in": afterTimestamp(industryCheckIn, 12),
        },
      },
      {
        eventSlug: mentorshipOngoing.event.slug,
        purchaseKey: "seed:event:student-innovator:mentorship-program",
        ticket: true,
      },
      {
        eventSlug: industryTalkUpcoming.event.slug,
        purchaseKey:
          "seed:event:student-innovator:industry-talk-design-systems",
        ticket: true,
      },
      {
        // Today's free drop-in, not checked in yet: sign in as an admin and
        // scan this account's ticket to rehearse check-in.
        eventSlug: designJamToday.event.slug,
        ticket: true,
      },
      {
        // A free past event attended without a purchase behind it.
        eventSlug: getToKnowPast.event.slug,
        ticket: true,
        checkIns: {
          "Door Check-in": afterTimestamp(getToKnowCheckIn, 5),
        },
      },
      {
        // A half-finished application to the upcoming UXathon: the member
        // application form resumes it. Drafts are never shown to admins.
        eventSlug: uxathonUpcoming.event.slug,
        ticket: false,
        application: { status: "draft" },
        responses: {
          [uxathonQuestions.year]: "4",
          [uxathonQuestions.contribution]: encodeCheckboxResponse([
            "Prototyping",
            "Front-end development",
          ]),
          [uxathonQuestions.problem]:
            "I am redesigning our club's event check-in so volunteers can",
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
      birthDate: "2006-02-17",
      interests: ["Psychology", "UX research", "Inclusive design"],
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
    studentVerification: {
      verifiedByEmail: "manager-no-membership@example.com",
      verifiedAt: afterTimestamp(gridPurchaseTime, 24 * 60),
    },
  },
  {
    email: "faculty-member@ubc.ca",
    password: SEED_PASSWORD,
    ubcVerification: {
      via: "sign_in_email",
      email: "faculty-member@ubc.ca",
      verifiedAt: gridPurchaseTime,
    },
    membershipSlug: "faculty",
    fullEventHistory: false,
    profile: facultyProfile({
      firstName: "Avery",
      birthDate: "1988-09-25",
      interests: ["Learning design", "Accessibility", "Mentorship"],
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
      birthDate: "2004-06-12",
      interests: ["Animation", "Visual storytelling", "Typography"],
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
    // Joined after the code step shipped.
    ubcVerification: {
      via: "code",
      email: "seed-admin-innovator@student.ubc.ca",
      verifiedAt: gridPurchaseTime,
    },
    membershipSlug: "innovator",
    fullEventHistory: false,
    profile: studentProfile({
      firstName: "Priya",
      birthDate: "2002-12-03",
      interests: ["Product strategy", "Design systems", "Entrepreneurship"],
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
    ubcVerification: {
      via: "sign_in_email",
      email: "admin-faculty@ubc.ca",
      verifiedAt: gridPurchaseTime,
    },
    membershipSlug: "faculty",
    fullEventHistory: false,
    profile: facultyProfile({
      firstName: "Nadia",
      birthDate: "1985-04-19",
      interests: ["Data visualization", "Science communication", "Mentorship"],
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
      birthDate: "1999-08-30",
      interests: ["Human-computer interaction", "Service design", "Sustainability"],
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
    // Verified over a year ago: shown as expired, and the next join asks again.
    ubcVerification: {
      via: "code",
      email: "seed-admin-no-membership@student.ubc.ca",
      verifiedAt: timestamp(addDays(today, -400), 18),
    },
    membershipSlug: null,
    fullEventHistory: false,
    profile: studentProfile({
      // No birthday or interests, so the admin dialog's empty state is
      // reachable without clearing them by hand.
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
  {
    email: "manager-no-membership@example.com",
    password: SEED_PASSWORD,
    // Verified recently, so joining skips the code.
    ubcVerification: {
      via: "code",
      email: "seed-manager@student.ubc.ca",
      verifiedAt: timestamp(addDays(today, -20), 18),
    },
    membershipSlug: null,
    fullEventHistory: false,
    profile: studentProfile({
      firstName: "Morgan",
      birthDate: "2002-05-26",
      interests: ["Community building", "Interaction design", "Workshop facilitation"],
      lastName: "Lee",
      phone: "6045550111",
      pronouns: "they/them",
      role: "manager",
      studentNumber: 10000007,
      faculty: "Faculty of Arts",
      major: "Design",
      year: "4",
    }),
    purchases: [],
    registrations: [],
  },

  /* ── Setup fixture ───────────────────────────────────────────────────────
   * The one account that has not done member setup, so the portal home sends
   * it to /portal/setup. Every other fixture is `done`, like the existing
   * members the setup migration backfilled. Each run puts it back at step 1,
   * "What best describes you?", unanswered.
   */
  {
    email: "new-member@example.com",
    password: SEED_PASSWORD,
    membershipSlug: null,
    fullEventHistory: false,
    profile: studentProfile({
      // Fresh from sign-up: no birthday, interests, dietary needs or photo.
      firstName: "Jamie",
      lastName: "Lee",
      phone: "6045550112",
      pronouns: "they/them",
      setupStep: "about",
      userTypeConfirmed: false,
      studentNumber: 10000008,
      faculty: "Faculty of Arts",
      major: "Cognitive Systems",
      year: "1",
    }),
    purchases: [],
    registrations: [],
  },
  ];
  return users.map((user) => withUbcVerification(user, now));
}

export const seedUsers = buildSeedUsers(seedEvents, new Date());
