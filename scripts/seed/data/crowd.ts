/**
 * The crowd: profile-only accounts that give admin screens volume.
 *
 * Eleven login fixtures can't fill an application review queue, a users table,
 * an attendee list or a nearly full event. The crowd can. Each member is a
 * `user_info` row with no Auth user, the same shape as a member imported
 * before they ever signed in (see `ensureUserInfo`), so nobody can sign in as
 * one and none of them ever stands in the way of checkout testing.
 *
 * Everything here is written out or derived from a list index: no randomness,
 * no clock beyond the run's own `now`, so every run builds the same people
 * with the same answers.
 *
 * Ownership: an account is the crowd's when its address is on one of
 * `CROWD_EMAIL_DOMAINS`, both reserved for this file. Locally, the seed
 * deletes a crowd account the data no longer lists, with its tickets and
 * applications. `--target=prod` writes no accounts at all, crowd included.
 */

import type { TablesInsert } from "../../../src/lib/supabase/database.types.ts";
import { DIET_OPTIONS } from "../../../src/features/setup/lib/options.ts";
import { encodeCheckboxResponse } from "../../../src/lib/application-response.ts";
import { addDays, startOfUtcDay, timestamp } from "../lib/relative-dates.ts";
import type { SeedEvent } from "./events.ts";
import {
  afterTimestamp,
  designSprintQuestions,
  facultyProfile,
  MEMBERSHIP_PRICE_CENTS,
  membershipPurchase,
  nonUbcProfile,
  requireEvent,
  studentProfile,
  ticketPriceCents,
  uxathonQuestions,
  type MembershipSlug,
  type SeedApplication,
  type SeedPurchase,
  type SeedRegistration,
  type SeedUser,
} from "./users.ts";

/**
 * Students and non-UBC members sign up with any address; faculty must use a
 * ubc.ca one matching their `faculty_email`. Neither domain is anybody's: the
 * first is under the reserved `.test` TLD, the second is a subdomain UBC does
 * not use.
 */
export const CROWD_EMAIL_DOMAINS = ["crowd.uxhub.test", "crowd.ubc.ca"] as const;

export function isCrowdEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return (CROWD_EMAIL_DOMAINS as readonly string[]).includes(domain ?? "");
}

type UniYear = NonNullable<TablesInsert<"user_info">["year"]>;

interface CrowdPersonBase {
  first: string;
  last: string;
  pronouns: string;
  interests: string[];
  birthDate: string;
  membership: MembershipSlug | null;
  dietary?: string;
  newsletter?: boolean;
  /** Lapsed: the membership ended this many days before the run. */
  expiredDaysAgo?: number;
}

type CrowdPerson =
  | (CrowdPersonBase & {
      type: "student";
      faculty: string;
      major: string;
      year: UniYear;
      verified?: boolean;
    })
  | (CrowdPersonBase & { type: "faculty"; faculty: string })
  | (CrowdPersonBase & {
      type: "nonUbc";
      school: string;
      status: "undergraduate" | "graduate" | "other";
      year?: UniYear;
    });

const ARTS = "Faculty of Arts";
const SCIENCE = "Faculty of Science";
const APSC = "Faculty of Applied Science";
const SAUDER = "Sauder School of Business";
const FORESTRY = "Faculty of Forestry";
const LFS = "Faculty of Land and Food Systems";
const EDUCATION = "Faculty of Education";
const MEDICINE = "Faculty of Medicine";

/**
 * Forty-two people. Order matters: the event plans below pick people by
 * position, so append rather than insert, or every assignment shifts.
 */
const PEOPLE: CrowdPerson[] = [
  { type: "student", first: "Amara", last: "Osei", pronouns: "she/her", faculty: ARTS, major: "Cognitive Systems", year: "3", membership: "explorer", interests: ["UX research", "Accessibility"], birthDate: "2004-02-11", newsletter: true, verified: true },
  { type: "student", first: "Ethan", last: "Zhao", pronouns: "he/him", faculty: SCIENCE, major: "Computer Science", year: "4", membership: "innovator", interests: ["Front-end development", "Design systems"], birthDate: "2003-06-02" },
  { type: "student", first: "Leila", last: "Haddad", pronouns: "she/her", faculty: ARTS, major: "Psychology", year: "2", membership: null, interests: ["UX research", "Behavioural science"], birthDate: "2005-09-19", dietary: "Halal" },
  { type: "student", first: "Noah", last: "Fischer", pronouns: "he/him", faculty: APSC, major: "Mechanical Engineering", year: "3", membership: "explorer", interests: ["Prototyping", "Industrial design"], birthDate: "2004-01-27" },
  { type: "student", first: "Hana", last: "Sato", pronouns: "she/her", faculty: ARTS, major: "Visual Arts", year: "4", membership: "innovator", interests: ["Visual design", "Illustration", "Typography"], birthDate: "2003-03-08", newsletter: true, verified: true },
  { type: "student", first: "Diego", last: "Ramírez", pronouns: "he/him", faculty: SAUDER, major: "Business Technology Management", year: "3", membership: null, interests: ["Product strategy", "Entrepreneurship"], birthDate: "2004-07-14" },
  { type: "student", first: "Chloé", last: "Tremblay", pronouns: "she/her", faculty: ARTS, major: "English Literature", year: "2", membership: "explorer", interests: ["Content design", "UX writing"], birthDate: "2005-04-30", dietary: "Vegetarian" },
  { type: "student", first: "Arjun", last: "Mehta", pronouns: "he/him", faculty: SCIENCE, major: "Computer Science", year: "5+", membership: "innovator", interests: ["Creative coding", "Interaction design"], birthDate: "2001-12-05", newsletter: true },
  { type: "student", first: "Grace", last: "Liu", pronouns: "she/her", faculty: SCIENCE, major: "Statistics", year: "3", membership: null, interests: ["Data visualization", "UX research"], birthDate: "2004-10-21" },
  { type: "student", first: "Kofi", last: "Mensah", pronouns: "he/him", faculty: APSC, major: "Electrical Engineering", year: "2", membership: "explorer", interests: ["Hardware prototyping", "Interaction design"], birthDate: "2005-05-16" },
  { type: "student", first: "Isabel", last: "Costa", pronouns: "she/they", faculty: ARTS, major: "Media Studies", year: "4", membership: "innovator", interests: ["Motion design", "Visual storytelling"], birthDate: "2003-08-09", dietary: "Vegan", verified: true },
  { type: "student", first: "Ryan", last: "O'Connor", pronouns: "he/him", faculty: SAUDER, major: "Marketing", year: "1", membership: null, interests: ["Branding", "Service design"], birthDate: "2006-03-22" },
  { type: "student", first: "Mei", last: "Tanaka", pronouns: "she/her", faculty: SCIENCE, major: "Cognitive Systems", year: "4", membership: "explorer", interests: ["Accessibility", "Inclusive design"], birthDate: "2003-11-13", newsletter: true },
  { type: "student", first: "Samuel", last: "Adeyemi", pronouns: "he/him", faculty: SCIENCE, major: "Mathematics", year: "3", membership: null, interests: ["Information architecture", "Data visualization"], birthDate: "2004-04-04" },
  { type: "student", first: "Priyanka", last: "Nair", pronouns: "she/her", faculty: APSC, major: "Computer Engineering", year: "4", membership: "innovator", interests: ["Design systems", "Front-end development"], birthDate: "2003-02-17", dietary: "Vegetarian" },
  { type: "student", first: "Lucas", last: "Moreau", pronouns: "he/him", faculty: ARTS, major: "Geography", year: "2", membership: null, interests: ["Maps", "Civic tech"], birthDate: "2005-07-28" },
  { type: "student", first: "Zara", last: "Ahmed", pronouns: "she/her", faculty: SCIENCE, major: "Biology", year: "1", membership: "explorer", interests: ["Health tech", "UX research"], birthDate: "2006-01-09", dietary: "Halal" },
  { type: "student", first: "Ben", last: "Carter", pronouns: "he/him", faculty: ARTS, major: "Economics", year: "3", membership: null, interests: ["Product strategy", "Behavioural science"], birthDate: "2004-09-01" },
  { type: "student", first: "Yuna", last: "Park", pronouns: "she/her", faculty: ARTS, major: "Cognitive Systems", year: "2", membership: "innovator", interests: ["Interaction design", "Prototyping"], birthDate: "2005-03-12", newsletter: true, verified: true },
  { type: "student", first: "Omar", last: "Farouk", pronouns: "he/him", faculty: APSC, major: "Integrated Engineering", year: "5+", membership: null, interests: ["Service design", "Sustainability"], birthDate: "2001-06-25" },
  { type: "student", first: "Nina", last: "Kowalski", pronouns: "she/her", faculty: FORESTRY, major: "Natural Resources Conservation", year: "3", membership: "explorer", interests: ["Sustainability", "Visual design"], birthDate: "2004-12-30" },
  { type: "student", first: "Tariq", last: "Hassan", pronouns: "he/him", faculty: SCIENCE, major: "Computer Science", year: "2", membership: null, interests: ["Game design", "Prototyping"], birthDate: "2005-08-18" },
  { type: "student", first: "Sophie", last: "Bergström", pronouns: "she/her", faculty: ARTS, major: "Art History", year: "4", membership: "innovator", interests: ["Typography", "Visual design"], birthDate: "2003-05-06" },
  { type: "student", first: "Jae", last: "Kim", pronouns: "they/them", faculty: ARTS, major: "Design", year: "3", membership: "explorer", interests: ["Interaction design", "Motion design"], birthDate: "2004-03-03", verified: true },
  { type: "student", first: "Fatima", last: "Diallo", pronouns: "she/her", faculty: LFS, major: "Food, Nutrition and Health", year: "2", membership: null, interests: ["Health tech", "Service design"], birthDate: "2005-11-02", dietary: "Halal" },
  { type: "student", first: "Marco", last: "Bianchi", pronouns: "he/him", faculty: SAUDER, major: "Business and Computer Science", year: "4", membership: "innovator", interests: ["Product management", "Design systems"], birthDate: "2003-01-20" },
  { type: "student", first: "Aisha", last: "Rahman", pronouns: "she/her", faculty: SCIENCE, major: "Cognitive Systems", year: "1", membership: null, interests: ["UX research", "Psychology"], birthDate: "2006-06-14" },
  { type: "student", first: "Felix", last: "Wagner", pronouns: "he/him", faculty: APSC, major: "Civil Engineering", year: "3", membership: "explorer", interests: ["Civic tech", "Information architecture"], birthDate: "2004-08-08" },
  // Lapsed: the renewal flow, and the same again with a renewal pending.
  { type: "student", first: "Olivia", last: "Brooks", pronouns: "she/her", faculty: ARTS, major: "Psychology", year: "4", membership: "explorer", expiredDaysAgo: 40, interests: ["UX research", "Inclusive design"], birthDate: "2003-04-15" },
  { type: "student", first: "Hiro", last: "Yamamoto", pronouns: "he/him", faculty: SCIENCE, major: "Computer Science", year: "5+", membership: "explorer", expiredDaysAgo: 25, interests: ["Creative coding", "Prototyping"], birthDate: "2002-10-10" },
  // Never a member: one abandoned checkout, one sold-out attempt.
  { type: "student", first: "Elena", last: "Popescu", pronouns: "she/her", faculty: ARTS, major: "International Relations", year: "2", membership: null, interests: ["Service design", "Civic tech"], birthDate: "2005-02-26" },
  { type: "student", first: "Kai", last: "Nakamura", pronouns: "he/they", faculty: ARTS, major: "Cognitive Systems", year: "3", membership: null, interests: ["Interaction design", "Accessibility"], birthDate: "2004-05-19", newsletter: true },
  { type: "faculty", first: "Margaret", last: "Ellis", pronouns: "she/her", faculty: SCIENCE, membership: "faculty", interests: ["Human-computer interaction", "Mentorship"], birthDate: "1979-07-03", newsletter: true },
  { type: "faculty", first: "Rajesh", last: "Iyer", pronouns: "he/him", faculty: APSC, membership: "faculty", interests: ["Engineering design", "Accessibility"], birthDate: "1975-02-14" },
  { type: "faculty", first: "Claire", last: "Dubois", pronouns: "she/her", faculty: EDUCATION, membership: null, interests: ["Learning design", "Inclusive design"], birthDate: "1983-09-27" },
  { type: "faculty", first: "Thomas", last: "Nguyen", pronouns: "he/him", faculty: MEDICINE, membership: "faculty", interests: ["Health tech", "Service design"], birthDate: "1981-12-01" },
  { type: "nonUbc", first: "Ava", last: "Thompson", pronouns: "she/her", school: "Simon Fraser University", status: "undergraduate", year: "3", membership: "non-ubc", interests: ["Interaction design", "Visual design"], birthDate: "2004-06-06" },
  { type: "nonUbc", first: "Mateus", last: "Silva", pronouns: "he/him", school: "Emily Carr University of Art and Design", status: "undergraduate", year: "4", membership: "non-ubc", interests: ["Illustration", "Motion design"], birthDate: "2003-09-09", newsletter: true },
  { type: "nonUbc", first: "Sara", last: "Lindqvist", pronouns: "she/her", school: "BCIT", status: "other", membership: null, interests: ["Front-end development", "Design systems"], birthDate: "1998-03-30" },
  { type: "nonUbc", first: "Daniel", last: "Abebe", pronouns: "he/him", school: "Simon Fraser University", status: "graduate", membership: "non-ubc", expiredDaysAgo: 60, interests: ["UX research", "Service design"], birthDate: "1997-11-11" },
  { type: "nonUbc", first: "Lina", last: "Morales", pronouns: "she/her", school: "Langara College", status: "undergraduate", year: "2", membership: null, interests: ["Visual design", "Branding"], birthDate: "2005-01-15" },
  { type: "nonUbc", first: "Wei", last: "Chen", pronouns: "he/him", school: "University of Victoria", status: "graduate", membership: "non-ubc", interests: ["Data visualization", "HCI research"], birthDate: "1999-05-05" },
];

/** `amara-osei`: ASCII, lowercase, hyphenated. */
function handleOf(person: CrowdPerson): string {
  return `${person.first}-${person.last}`
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z-]/g, "")
    .toLowerCase();
}

function emailOf(person: CrowdPerson): string {
  const local = handleOf(person).replace("-", ".");
  return `${local}@${person.type === "faculty" ? CROWD_EMAIL_DOMAINS[1] : CROWD_EMAIL_DOMAINS[0]}`;
}

function fullName(person: CrowdPerson): string {
  return `${person.first} ${person.last}`;
}

/** Eight digits, distinct, and not a pattern `validateStudentNumber` rejects. */
function studentNumber(index: number): number {
  return 31_000_000 + index * 104_729;
}

function profileOf(person: CrowdPerson, index: number) {
  const common = {
    firstName: person.first,
    lastName: person.last,
    pronouns: person.pronouns,
    birthDate: person.birthDate,
    interests: person.interests,
    diets: DIET_OPTIONS.filter((option) => option.label === person.dietary).map((option) => option.id),
    newsletter: person.newsletter ?? false,
    phone: `60455502${String(index).padStart(2, "0")}`,
  };
  switch (person.type) {
    case "student":
      return studentProfile({
        ...common,
        studentNumber: studentNumber(index),
        faculty: person.faculty,
        major: person.major,
        year: person.year,
      });
    case "faculty":
      return facultyProfile({ ...common, email: emailOf(person), faculty: person.faculty });
    case "nonUbc":
      return nonUbcProfile({
        ...common,
        schoolInstitution: person.school,
        studentStatus: person.status,
        year: person.year,
      });
  }
}

/** The answer to "What year of study are you in?" */
function yearAnswer(person: CrowdPerson): string {
  if (person.type === "faculty") return "Not a student";
  if (person.year) return person.year;
  return person.type === "nonUbc" && person.status === "graduate" ? "5+" : "Not a student";
}

/** Picks from `pool` by position, so the same person always gets the same answer. */
function pick<T>(pool: readonly T[], index: number): T {
  return pool[index % pool.length];
}

const UXATHON_PROBLEMS = [
  "I redesigned the sign-up flow for a campus food bank. The hard part was asking for eligibility details without making anyone feel they had to justify being hungry.",
  "Our team built a study-room booking prototype. Students wanted to see availability at a glance, but the library needed people to commit to a time, and those pulled in opposite directions.",
  "I worked on a transit-delay notification concept. Getting the timing right was harder than the UI: too early and people ignore it, too late and it is useless.",
  "For a class project I redesigned a medication reminder app for older adults. Testing with my grandparents showed that every icon I thought was obvious needed a label.",
  "I mapped how international students find housing. The hardest part was synthesis: forty sticky notes of frustration and no obvious single problem to solve.",
  "I designed a volunteer shift-swap feature for a non-profit. Trust was the problem — people needed to know a swap was confirmed without a coordinator in the loop.",
  "I prototyped a course-planning tool. Prerequisites form a graph, and showing that graph without overwhelming first-years took five rounds of paper prototypes.",
  "I helped a local café redo their online ordering. The owner wanted upsells everywhere and the customers wanted to be done in thirty seconds.",
  "I audited my faculty's website for accessibility. Fixing contrast was easy; convincing the people who own the content to write alt text was not.",
  "I designed an onboarding flow for a budgeting app. The hard part was asking for bank access in a way that did not feel like a phishing attempt.",
  "I worked on wayfinding for a hospital clinic. Signage, the app and the front desk all used different names for the same rooms.",
  "I built a habit tracker for a design course. Users loved streaks until they broke one, then quit entirely, so I had to design for failure.",
];

const DESIGN_SPRINT_GOALS = [
  "A real project for my portfolio that goes from research to a tested prototype, not just polished screens.",
  "Practice running interviews and turning what I hear into a clear problem statement.",
  "I want to see how working designers critique, and get better at defending my own decisions.",
  "Experience with a team under a deadline. My classes are mostly solo work.",
  "I am switching into UX from engineering and want to learn the research half properly.",
  "Confidence presenting. I can design, but I freeze when explaining why.",
  "To learn how to scope a big problem down to something two weeks can actually answer.",
  "Meet people in the club and build something we are proud to show.",
];

const CONTRIBUTIONS = [
  "User research",
  "Visual and UI design",
  "Prototyping",
  "Content and copy",
  "Front-end development",
  "Presenting and storytelling",
] as const;

const FIGMA_LEVELS = [
  "Never used it",
  "I can follow a tutorial",
  "Comfortable building screens",
  "I build components and use auto-layout daily",
] as const;

const EXPERIENCE = ["No, this is my first", "Once or twice", "Several times"] as const;

const HEARD_FROM = [
  "Instagram",
  "UX Hub newsletter",
  "A friend or classmate",
  "A class or professor",
  "Somewhere else",
] as const;

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Halal", "Gluten-free", "Nut allergy", "Dairy-free"];

function dietaryAnswer(person: CrowdPerson): string {
  const choice = person.dietary && DIETARY_OPTIONS.includes(person.dietary) ? person.dietary : "None";
  return encodeCheckboxResponse([choice]);
}

/** One to three areas, starting from a different one for each applicant. */
function contributionAnswer(index: number): string {
  const count = 1 + (index % 3);
  return encodeCheckboxResponse(
    Array.from({ length: count }, (_, offset) => pick(CONTRIBUTIONS, index + offset * 2))
  );
}

function uxathonResponses(person: CrowdPerson, index: number, teammate?: CrowdPerson) {
  return {
    [uxathonQuestions.year]: yearAnswer(person),
    [uxathonQuestions.contribution]: contributionAnswer(index),
    [uxathonQuestions.experience]: pick(EXPERIENCE, index),
    [uxathonQuestions.problem]: pick(UXATHON_PROBLEMS, index),
    [uxathonQuestions.teammates]: teammate ? fullName(teammate) : "",
    [uxathonQuestions.heardFrom]: pick(HEARD_FROM, index),
  };
}

function designSprintResponses(person: CrowdPerson, index: number) {
  return {
    [designSprintQuestions.year]: yearAnswer(person),
    [designSprintQuestions.figma]: pick(FIGMA_LEVELS, index),
    [designSprintQuestions.goal]: pick(DESIGN_SPRINT_GOALS, index),
    [designSprintQuestions.dietary]: dietaryAnswer(person),
  };
}

/** Where an application stands, which decides its status, deadline and ticket. */
type Decision =
  | "submitted"
  | "waitlisted"
  | "rejected"
  /** Accepted, deadline ahead, no ticket yet. Holds a seat. */
  | "offered"
  /** Accepted, deadline passed, no ticket: shown as "Offer expired". */
  | "expired"
  /** Accepted and paid: shown as "Registered". */
  | "registered";

interface ApplicationPlan {
  person: number;
  decision: Decision;
  /** Attaches a portfolio PDF to the UXathon's file question. */
  portfolio?: boolean;
  /** Names another crowd member as a teammate. */
  teammate?: number;
  /** Check-in sessions attended, for past events. */
  checkIns?: string[];
}

/**
 * The upcoming UXathon's review queue: every state the review list can show,
 * submitted first because that is where admins start. Applications hold no
 * seat until accepted, and only `offered` holds one then.
 */
const UXATHON_UPCOMING: ApplicationPlan[] = [
  { person: 0, decision: "registered" },
  { person: 7, decision: "registered", teammate: 14 },
  { person: 14, decision: "registered", teammate: 7 },
  { person: 23, decision: "registered", portfolio: true },
  { person: 4, decision: "expired" },
  { person: 13, decision: "expired" },
  { person: 1, decision: "offered", portfolio: true },
  { person: 19, decision: "offered" },
  { person: 36, decision: "offered" },
  { person: 9, decision: "rejected" },
  { person: 21, decision: "rejected" },
  { person: 40, decision: "rejected" },
  { person: 2, decision: "waitlisted" },
  { person: 17, decision: "waitlisted", teammate: 25 },
  { person: 25, decision: "waitlisted", teammate: 17 },
  { person: 37, decision: "waitlisted", portfolio: true },
  { person: 3, decision: "submitted", portfolio: true },
  { person: 10, decision: "submitted", portfolio: true },
  { person: 12, decision: "submitted" },
  { person: 15, decision: "submitted" },
  { person: 22, decision: "submitted", portfolio: true },
  { person: 26, decision: "submitted" },
  { person: 31, decision: "submitted", teammate: 18 },
  { person: 41, decision: "submitted", portfolio: true },
];

const DESIGN_SPRINT_UPCOMING: ApplicationPlan[] = [
  { person: 6, decision: "registered" },
  { person: 24, decision: "registered" },
  { person: 11, decision: "offered" },
  { person: 27, decision: "offered" },
  { person: 16, decision: "waitlisted" },
  { person: 30, decision: "waitlisted" },
  { person: 20, decision: "rejected" },
  { person: 5, decision: "submitted" },
  { person: 8, decision: "submitted" },
  { person: 18, decision: "submitted" },
  { person: 28, decision: "submitted" },
  { person: 38, decision: "submitted" },
];

/** Last year's UXathon: who came, and who checked in when. */
const UXATHON_PAST: ApplicationPlan[] = [
  { person: 1, decision: "registered", checkIns: ["Opening Ceremony Check-in", "Evening Headcount", "Final Presentations Check-in"] },
  { person: 4, decision: "registered", checkIns: ["Opening Ceremony Check-in", "Final Presentations Check-in"] },
  { person: 7, decision: "registered", checkIns: ["Opening Ceremony Check-in", "Evening Headcount", "Final Presentations Check-in"] },
  { person: 10, decision: "registered", checkIns: ["Opening Ceremony Check-in"] },
  { person: 14, decision: "registered", checkIns: ["Opening Ceremony Check-in", "Evening Headcount"] },
  { person: 25, decision: "registered", checkIns: [] },
  { person: 12, decision: "rejected" },
  { person: 22, decision: "rejected" },
];

/**
 * Tickets without applications, by position in `PEOPLE`. Thinkbox is the
 * nearly full one: 22 of its 25 seats, leaving `PURCHASABLE_MIN_SEATS_LEFT`.
 * The Figma workshop is sold out to the seat.
 */
const THINKBOX_TICKETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 18, 20, 22, 32, 33, 36, 39];
const FIGMA_WORKSHOP_TICKETS = [2, 3, 6, 8, 9, 11, 13, 15, 16, 17, 19, 20, 21, 23, 24, 26, 27, 28, 37, 40];
/** Tried to buy the sold-out workshop and was turned away. */
const FIGMA_WORKSHOP_SOLD_OUT = 31;
/** Today's drop-in; the first `DESIGN_JAM_CHECKED_IN` are through the door. */
const DESIGN_JAM_TICKETS = [0, 3, 5, 8, 11, 12, 15, 18, 19, 21, 24, 26, 29, 34, 38, 41];
const DESIGN_JAM_CHECKED_IN = 9;
/** Last year's welcome night, free, with door check-ins. */
const GET_TO_KNOW_TICKETS = [0, 1, 3, 4, 6, 7, 9, 10, 12, 14, 16, 19, 20, 23, 24, 27, 28, 29, 32, 35];
const GET_TO_KNOW_ABSENT = new Set([12, 27, 35]);

/** Lapsed explorer who has already started renewing: payment still pending. */
const RENEWAL_PENDING = 29;
/** Never a member: started an Innovator checkout and abandoned it. */
const MEMBERSHIP_CANCELED = 30;
/** Never a member: card declined on a Non-UBC membership. */
const MEMBERSHIP_FAILED = 40;

export function buildSeedCrowd(events: SeedEvent[], now: Date): SeedUser[] {
  const today = startOfUtcDay(now);
  const thinkbox = requireEvent(events, "thinkbox-office-tour");
  const figmaWorkshop = requireEvent(events, "figma-basics-workshop");
  const designJam = requireEvent(events, "design-jam-today");
  const getToKnow = requireEvent(events, "get-to-know-ux-hub");
  const uxathonUpcoming = requireEvent(events, "uxathon-upcoming");
  const uxathonPast = requireEvent(events, "uxathon-past");
  const designSprintUpcoming = requireEvent(events, "design-sprint-upcoming");

  const users: SeedUser[] = PEOPLE.map((person, index) => {
    const handle = handleOf(person);
    const membershipExpiresAt =
      person.membership && person.expiredDaysAgo !== undefined
        ? timestamp(addDays(today, -person.expiredDaysAgo), 7)
        : undefined;
    // A lapsed member bought a year before it ended; everyone else at some
    // point in the last two months.
    const boughtAt = membershipExpiresAt
      ? timestamp(addDays(new Date(membershipExpiresAt), -365), 19)
      : timestamp(addDays(today, -(14 + index)), 15 + (index % 6));

    return {
      email: emailOf(person),
      password: null,
      membershipSlug: person.membership,
      membershipExpiresAt,
      fullEventHistory: false,
      profile: profileOf(person, index),
      purchases: person.membership
        ? [{ ...membershipPurchase(`crowd:${handle}`, person.membership, boughtAt) }]
        : [],
      registrations: [],
      studentVerification:
        person.type === "student" && person.verified
          ? {
              verifiedByEmail: "manager-no-membership@example.com",
              verifiedAt: afterTimestamp(boughtAt, 2 * 24 * 60),
            }
          : undefined,
    };
  });

  const userAt = (index: number) => {
    const user = users[index];
    if (!user) throw new Error(`No crowd member at position ${index}`);
    return user;
  };
  const handleAt = (index: number) => handleOf(PEOPLE[index]);
  const isActiveMember = (user: SeedUser) =>
    Boolean(user.membershipSlug) &&
    (!user.membershipExpiresAt || new Date(user.membershipExpiresAt) > now);

  /** A completed purchase for every ticket, including charge-free registrations. */
  const buyTicket = (index: number, event: SeedEvent, createdAt: string) => {
    const user = userAt(index);
    const amountCents = ticketPriceCents(event, isActiveMember(user));
    const key = `seed:crowd:event:${handleAt(index)}:${event.event.slug}`;
    user.purchases.push({
      amountCents,
      createdAt,
      eventSlug: event.event.slug,
      fulfilledAt: afterTimestamp(createdAt, 1),
      idempotencyKey: key,
      kind: "event_ticket",
      squarePaymentId: amountCents > 0 ? `seed:crowd:payment:${handleAt(index)}:${event.event.slug}` : undefined,
      status: "completed",
    });
    return key;
  };

  const register = (index: number, registration: SeedRegistration) => {
    userAt(index).registrations.push(registration);
  };

  /* ── Tickets without applications ── */
  const ticketsFor = (
    event: SeedEvent,
    people: number[],
    checkIn?: (position: number) => Record<string, string> | undefined
  ) => {
    const opensAt = event.event.registration_opens_at!;
    people.forEach((index, position) => {
      // Spread across the first days of the registration window, in list order.
      const createdAt = afterTimestamp(opensAt, (position + 1) * 5 * 60 + index);
      register(index, {
        eventSlug: event.event.slug,
        ticket: true,
        purchaseKey: buyTicket(index, event, createdAt),
        checkIns: checkIn?.(position),
      });
    });
  };

  ticketsFor(thinkbox, THINKBOX_TICKETS);
  ticketsFor(figmaWorkshop, FIGMA_WORKSHOP_TICKETS);

  const designJamDoor = designJam.checkInSessions[0];
  ticketsFor(designJam, DESIGN_JAM_TICKETS, (position) =>
    position < DESIGN_JAM_CHECKED_IN
      ? { [designJamDoor.name]: afterTimestamp(designJamDoor.start_time!, 4 + position * 4) }
      : undefined
  );

  const getToKnowDoor = getToKnow.checkInSessions[0];
  ticketsFor(getToKnow, GET_TO_KNOW_TICKETS, (position) =>
    GET_TO_KNOW_ABSENT.has(GET_TO_KNOW_TICKETS[position])
      ? undefined
      : { [getToKnowDoor.name]: afterTimestamp(getToKnowDoor.start_time!, 2 + position * 3) }
  );

  /* ── Applications ── */
  const applyTo = (
    event: SeedEvent,
    plans: ApplicationPlan[],
    responsesOf: (person: CrowdPerson, index: number, plan: ApplicationPlan) => Record<string, string>
  ) => {
    const opensAt = event.event.registration_opens_at!;
    const sessionStart = new Map(
      event.checkInSessions.map((session) => [session.name, session.start_time!])
    );
    // Accepted offers last a week from the decision. "Offered" ones are still
    // open; "expired" ones lapsed two days before the run.
    const liveDeadline = timestamp(addDays(today, 5), 23, 59);
    const lapsedDeadline = timestamp(addDays(today, -2), 23, 59);

    plans.forEach((plan, position) => {
      const person = PEOPLE[plan.person];
      // Earlier in the list, earlier in the window: decisions went to the
      // first applicants, the queue holds the latest.
      const submittedAt = afterTimestamp(opensAt, (position + 1) * 20 * 60 + plan.person);
      const application: SeedApplication = { status: "submitted", submittedAt };
      let purchaseKey: string | undefined;

      switch (plan.decision) {
        case "submitted":
        case "waitlisted":
        case "rejected":
          application.status = plan.decision;
          break;
        case "offered":
          application.status = "accepted";
          application.offerExpiresAt = liveDeadline;
          break;
        case "expired":
          application.status = "accepted";
          application.offerExpiresAt = lapsedDeadline;
          break;
        case "registered":
          application.status = "accepted";
          application.offerExpiresAt = afterTimestamp(submittedAt, 7 * 24 * 60);
          purchaseKey = buyTicket(
            plan.person,
            event,
            afterTimestamp(submittedAt, 2 * 24 * 60)
          );
          break;
      }

      const checkIns = plan.checkIns?.length
        ? Object.fromEntries(
            plan.checkIns.map((name, offset) => [
              name,
              afterTimestamp(sessionStart.get(name)!, 3 + offset + plan.person),
            ])
          )
        : undefined;

      register(plan.person, {
        eventSlug: event.event.slug,
        ticket: plan.decision === "registered",
        purchaseKey,
        application,
        responses: responsesOf(person, plan.person, plan),
        files: plan.portfolio
          ? {
              [uxathonQuestions.portfolio]: `${person.first}_${person.last}_Portfolio.pdf`
                .normalize("NFKD")
                .replace(/[̀-ͯ']/g, ""),
            }
          : undefined,
        checkIns,
      });
    });
  };

  const uxathonAnswers = (person: CrowdPerson, index: number, plan: ApplicationPlan) =>
    uxathonResponses(
      person,
      index,
      plan.teammate === undefined ? undefined : PEOPLE[plan.teammate]
    );
  applyTo(uxathonUpcoming, UXATHON_UPCOMING, uxathonAnswers);
  applyTo(uxathonPast, UXATHON_PAST, uxathonAnswers);
  applyTo(designSprintUpcoming, DESIGN_SPRINT_UPCOMING, (person, index) =>
    designSprintResponses(person, index)
  );

  /* ── Purchases that never became anything ── */
  const renewal = userAt(RENEWAL_PENDING);
  renewal.membershipPreOrderedSlug = renewal.membershipSlug!;
  renewal.purchases.push({
    // Created before the card is charged, so no Square payment yet.
    amountCents: MEMBERSHIP_PRICE_CENTS[renewal.membershipSlug as MembershipSlug],
    createdAt: timestamp(addDays(today, -1), 18, 5),
    idempotencyKey: `seed:crowd:membership:${handleAt(RENEWAL_PENDING)}:renewal`,
    kind: "membership",
    membershipSlug: renewal.membershipSlug!,
    status: "pending",
  });

  const abandoned: SeedPurchase = {
    amountCents: MEMBERSHIP_PRICE_CENTS.innovator,
    createdAt: timestamp(addDays(today, -9), 20, 30),
    idempotencyKey: `seed:crowd:membership:${handleAt(MEMBERSHIP_CANCELED)}:innovator`,
    kind: "membership",
    membershipSlug: "innovator",
    squarePaymentId: `seed:crowd:payment:${handleAt(MEMBERSHIP_CANCELED)}:innovator`,
    status: "canceled",
  };
  userAt(MEMBERSHIP_CANCELED).purchases.push(abandoned);

  userAt(MEMBERSHIP_FAILED).purchases.push({
    amountCents: MEMBERSHIP_PRICE_CENTS["non-ubc"],
    createdAt: timestamp(addDays(today, -12), 2, 10),
    failureReason: "Card declined (CVV_FAILURE)",
    idempotencyKey: `seed:crowd:membership:${handleAt(MEMBERSHIP_FAILED)}:non-ubc`,
    kind: "membership",
    membershipSlug: "non-ubc",
    status: "failed",
  });

  // Paid, then voided when the seat reservation found the workshop full.
  const soldOutBuyer = userAt(FIGMA_WORKSHOP_SOLD_OUT);
  soldOutBuyer.purchases.push({
    amountCents: ticketPriceCents(figmaWorkshop, isActiveMember(soldOutBuyer)),
    createdAt: timestamp(addDays(today, -1), 3, 45),
    eventSlug: figmaWorkshop.event.slug,
    failureReason: "This event is sold out.",
    idempotencyKey: `seed:crowd:event:${handleAt(FIGMA_WORKSHOP_SOLD_OUT)}:${figmaWorkshop.event.slug}`,
    kind: "event_ticket",
    squarePaymentId: `seed:crowd:payment:${handleAt(FIGMA_WORKSHOP_SOLD_OUT)}:${figmaWorkshop.event.slug}`,
    status: "canceled",
  });

  return users;
}
