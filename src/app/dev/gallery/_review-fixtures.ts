import type { ApplicationReviewState } from "@/features/admin/lib/application-review";
import type {
  ApplicationAnswers,
  ApplicationQuestion,
} from "@/features/applications/lib/application-form";
import type { ReviewerNote } from "@/features/applications/components/ReviewerNotes";

/**
 * Application review fixtures, shared by the gallery and the Applications
 * templates. Fixed dates, so the pages look the same on any day: "now" is
 * Wednesday Nov 4, 2026, 11:30 AM Pacific, the gallery's `TODAY`.
 */
export const REVIEW_NOW = new Date("2026-11-04T18:30:00Z");

/** The signed-in admin. */
export const REVIEWER = { id: "admin-alex", name: "Alex Chen", avatarUrl: "/people/david.jpg" };

const JORDAN = { id: "admin-jordan", name: "Jordan Lee", avatarUrl: "/people/elaine.jpg" };
const MIA = { id: "admin-mia", name: "Mia Tanaka", avatarUrl: "/people/Mia.png" };
const GONE = { id: "admin-gone", name: "Sam Rivera", deleted: true };

export const EVENT_NAME = "UXathon 2027";
export const CAPACITY = 60;

export interface Applicant {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  program: string;
  submittedAt: string;
  state: ApplicationReviewState;
  offerExpiresAt: string | null;
  noteCount: number;
}

const NAMES: readonly [string, string?][] = [
  ["Hana Kim"], ["Omar Aziz", "/people/owen.jpg"], ["Ivy Zhang", "/people/iris-chan.jpg"],
  ["Diego Alvarez"], ["Fatima Hassan", "/people/delia.jpg"], ["Lucas Moreau"],
  ["Noah Williams", "/people/brady.jpg"], ["Mei Tanaka"], ["Sam Okafor", "/people/justin.jpg"],
  ["Chloe Martin"], ["Arjun Mehta", "/people/sukhraj.jpg"], ["Grace Liu", "/people/lucy.jpg"],
  ["Ethan Brown"], ["Sofia Rossi", "/people/aurora.png"], ["Kenji Watanabe", "/people/taro.jpg"],
  ["Amara Okoye"], ["Liam O’Connor", "/people/brian.jpg"], ["Zara Ahmed"],
  ["Mateo García", "/people/eric.jpg"], ["Ava Nguyen", "/people/kelly.jpg"], ["Daniel Park"],
  ["Isla Thompson", "/people/ellen.jpg"], ["Ravi Singh"], ["Yuki Sato", "/people/rin.jpg"],
  ["Leah Cohen"], ["Priya Raman", "/people/carys.jpg"], ["Ben Carter", "/people/jason.jpg"],
  ["Nadia Petrova"], ["Jin Woo Choi", "/people/quang.jpg"], ["Emma Wilson"],
  ["Tariq Hussain"], ["Olivia Chen", "/people/jessie.jpg"], ["Felix Wagner"],
  ["Maya Patel", "/people/erin.jpg"], ["Hugo Laurent"], ["Aisha Bello", "/people/avia.jpg"],
  ["Ryan Murphy"], ["Lina Haddad", "/people/elisabeth.jpg"], ["Owen Davies"],
  ["Chen Wei"], ["Sara Lindqvist", "/people/aubrey.png"], ["Kofi Mensah"],
  ["Elena Popescu", "/people/cherry.jpg"], ["Marcus Reid"], ["Hiro Yamamoto"],
  ["Julia Santos", "/people/iris-danna.jpg"], ["Theo Fischer"], ["Nora Ali", "/people/Kat.png"],
];

const PROGRAMS = [
  "3rd year · Cognitive Systems",
  "2nd year · Computer Science",
  "4th year · Psychology",
  "3rd year · Design",
  "1st year · Commerce",
  "Master’s · Information Design",
];

/**
 * The first 25 (oldest) are decided, the newest 23 wait for review: 23
 * submitted, 4 waitlisted, 5 accepted, 9 going, 2 offer expired, 5 rejected.
 */
const DECIDED: readonly ApplicationReviewState[] = [
  "registered", "registered", "rejected", "registered", "accepted",
  "registered", "waitlisted", "offer_expired", "registered", "rejected",
  "registered", "accepted", "waitlisted", "registered", "rejected",
  "accepted", "registered", "offer_expired", "waitlisted", "rejected",
  "registered", "accepted", "waitlisted", "rejected", "accepted",
];

const NOTE_COUNTS = [2, 1, 3, 0, 1, 0, 2, 1, 0, 0, 1, 2];

/** Oldest first: Oct 15 to Nov 1, every 9 hours (Priya: Oct 24, 11:42 AM Pacific). */
export const APPLICANTS: readonly Applicant[] = NAMES.map(([name, avatarUrl], index) => {
  const state = DECIDED[index] ?? "submitted";
  const [first, ...rest] = name.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").split(" ");
  return {
    id: `app-${String(index + 1).padStart(2, "0")}`,
    name,
    email: `${first}.${rest.join("")}@student.ubc.ca`,
    avatarUrl,
    program: PROGRAMS[index % PROGRAMS.length],
    submittedAt: new Date(Date.UTC(2026, 9, 15, 9, 42) + index * 9 * 3600 * 1000).toISOString(),
    state,
    offerExpiresAt:
      state === "accepted"
        ? "2026-11-12T06:59:00Z"
        : state === "offer_expired"
          ? "2026-11-01T06:59:00Z"
          : null,
    noteCount: name === "Priya Raman" ? 3 : state === "submitted" ? NOTE_COUNTS[index % NOTE_COUNTS.length] : 1 + (index % 3),
  };
});

/** The applicant the detail page opens on: submitted, with a thread. */
export const FEATURED_APPLICANT = APPLICANTS.find((applicant) => applicant.name === "Priya Raman")!;

const LONG_NOTE = [
  "Read all three case studies. The course planner one is the strongest: she ran five moderated sessions, synthesised them into a journey map, and you can see the prototype change between rounds.",
  "",
  "Concerns: the portfolio is research-heavy and light on visual craft, and she’s only free Saturday. Teams work best when everyone’s there both days, so if we accept, pair her with someone strong in visual design who can carry Sunday’s polish.",
  "",
  "Overall a yes from me. She’d also be a great candidate for next term’s mentorship pilot.",
].join("\n");

/** Priya's thread: a colleague, a long note, a deleted account, and your own edited note. */
export const REVIEW_NOTES: readonly ReviewerNote[] = [
  {
    id: "note-1",
    body: "Met her at Design Crit Night. Asked sharp questions about recruiting participants.",
    createdAt: "2026-10-30T01:12:00Z",
    author: GONE,
  },
  {
    id: "note-2",
    body: LONG_NOTE,
    createdAt: "2026-11-03T23:05:00Z",
    author: JORDAN,
  },
  {
    id: "note-3",
    body: "Agree on pairing. Leaning accept once we know how many seats the sponsors need.",
    createdAt: "2026-11-04T16:20:00Z",
    editedAt: "2026-11-04T16:31:00Z",
    author: REVIEWER,
  },
];

const POOL: readonly Omit<ReviewerNote, "id">[] = [
  { body: "Solid portfolio, clear process write-ups.", createdAt: "2026-11-02T20:10:00Z", author: MIA },
  { body: "Second this. Good fit for a research-led team.", createdAt: "2026-11-03T17:45:00Z", author: JORDAN },
  { body: "Only free Sunday; check with them before accepting.", createdAt: "2026-11-04T15:02:00Z", author: REVIEWER },
];

/** Every applicant's thread: Priya's, else generic notes to match `noteCount`. */
export function notesFor(applicant: Applicant): ReviewerNote[] {
  if (applicant.id === FEATURED_APPLICANT.id) return [...REVIEW_NOTES];
  return POOL.slice(0, applicant.noteCount).map((note, index) => ({
    ...note,
    id: `${applicant.id}-note-${index}`,
  }));
}

export const QUESTIONS: readonly ApplicationQuestion[] = [
  {
    id: "q-portfolio",
    question: "Portfolio link",
    description: null,
    response_type: "short_text",
    is_required: true,
    max_char_limit: null,
    response_options: null,
  },
  {
    id: "q-why",
    question: "Why do you want to join UXathon?",
    description: null,
    response_type: "long_text",
    is_required: true,
    max_char_limit: 600,
    response_options: null,
  },
  {
    id: "q-role",
    question: "Which role fits you best?",
    description: null,
    response_type: "multiple_choice",
    is_required: true,
    max_char_limit: null,
    response_options: ["Research", "Visual design", "Prototyping", "Development"],
  },
  {
    id: "q-days",
    question: "Which days can you come?",
    description: null,
    response_type: "checkbox",
    is_required: true,
    max_char_limit: null,
    response_options: ["Saturday, Jan 9", "Sunday, Jan 10"],
  },
  {
    id: "q-resume",
    question: "Résumé",
    description: null,
    response_type: "file_upload",
    is_required: false,
    max_char_limit: null,
    response_options: null,
  },
];

export function answersFor(applicant: Applicant): ApplicationAnswers {
  const slug = applicant.email.split("@")[0];
  const featured = applicant.id === FEATURED_APPLICANT.id;
  return {
    "q-portfolio": `https://${slug.replace(".", "")}.design`,
    "q-why": featured
      ? "I ran usability tests for our faculty’s course planner last term and want to try the whole loop, research to prototype, in one weekend.\n\nI’d love a team that includes a developer, so I can learn how my research turns into something people can actually use."
      : `I want to practise working end to end on a real brief with people from other programs. ${applicant.program.split(" · ")[1]} taught me the theory; UXathon is where I’d like to try it under time pressure.`,
    "q-role": featured ? "Research" : ["Visual design", "Prototyping", "Development", "Research"][applicant.name.length % 4],
    "q-days": featured ? ["Saturday, Jan 9"] : ["Saturday, Jan 9", "Sunday, Jan 10"],
    "q-resume": featured || applicant.name.length % 2 === 0 ? `${slug}/resume.pdf` : "",
  };
}
