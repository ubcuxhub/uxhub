/**
 * Reviewer notes: the comment thread admins keep on an application under
 * review (docs/design/application-review.md §5).
 *
 * They sit on the crowd's `uxathon-upcoming` applications, written by the admin
 * login fixtures, so signing in as any admin shows a thread with other
 * reviewers' notes beside your own. Between them they cover:
 *
 * - a thread of three, one by a deleted account ("Deleted user")
 * - an edited note, and a long one cut at six lines ("Show more")
 * - notes on waitlisted, rejected and accepted applications, not just
 *   submitted ones
 * - plenty of applications with none, for the "No notes yet" filter
 *
 * Times follow the application's own `submitted_at`, so they are fixed for a
 * run's day and the review list doesn't reshuffle between runs.
 *
 * Local only, with the user fixtures: `--target=prod` writes no accounts, so
 * no notes.
 */

/**
 * The author of the "Deleted user" notes: a profile shaped the way
 * `delete_account` leaves one (no Auth user, no personal details, `deleted_at`
 * set), so the thread shows how a former exec's notes outlive their account.
 * The address is on the domain `delete_account` uses and is the seed's alone;
 * the seed recognises the profile by it.
 */
export const FORMER_REVIEWER = {
  email: "deleted+seed-former-reviewer@deleted.uxhub.invalid",
  first_name: "Deleted",
  last_name: "member",
  role_access: "basic",
} as const;

export interface SeedReviewNote {
  /** The crowd member whose application the note is on. */
  applicantEmail: string;
  eventSlug: string;
  /** A login fixture with admin access, or FORMER_REVIEWER.email. */
  authorEmail: string;
  /** When it was posted, counted from the application's `submitted_at`. */
  minutesAfterSubmission: number;
  body: string;
  /** Edited this long after posting; omitted for a note never edited. */
  editedMinutesLater?: number;
}

const UXATHON = "uxathon-upcoming";

export const seedReviewNotes: SeedReviewNote[] = [
  // A thread of three on a submitted application, one by a deleted account.
  {
    applicantEmail: "noah.fischer@crowd.uxhub.test",
    eventSlug: UXATHON,
    authorEmail: FORMER_REVIEWER.email,
    minutesAfterSubmission: 3 * 60,
    body: "Portfolio is mostly mechanical work, but the case study on the bike rack redesign shows real user research. Worth a closer look.",
  },
  {
    applicantEmail: "noah.fischer@crowd.uxhub.test",
    eventSlug: UXATHON,
    authorEmail: "admin-explorer@example.com",
    minutesAfterSubmission: 26 * 60,
    body: "Agreed. Their answer on teamwork was specific and honest about what went wrong. I'd lean accept.",
  },
  {
    applicantEmail: "noah.fischer@crowd.uxhub.test",
    eventSlug: UXATHON,
    authorEmail: "manager-no-membership@example.com",
    minutesAfterSubmission: 27 * 60 + 40,
    body: "Same. Would pair well with a team that's light on prototyping.",
  },
  // A long note, edited, cut at six lines in the thread.
  {
    applicantEmail: "isabel.costa@crowd.uxhub.test",
    eventSlug: UXATHON,
    authorEmail: "admin-innovator@example.com",
    minutesAfterSubmission: 5 * 60,
    editedMinutesLater: 45,
    body: [
      "Strengths:",
      "- Motion work in the portfolio is genuinely polished; the onboarding prototype reads like a shipped product.",
      "- Clear about their role on each project, including what they didn't do.",
      "",
      "Concerns:",
      "- Little evidence of research or testing; every case study starts at visuals.",
      "- Says they want to \"own the whole thing\", which can be hard in a team of four.",
      "",
      "Overall a strong maybe. I'd want to see them on a team with a researcher, and I'm happy to vouch for them if we're split.",
    ].join("\n"),
  },
  {
    applicantEmail: "mei.tanaka@crowd.uxhub.test",
    eventSlug: UXATHON,
    authorEmail: "admin-explorer@example.com",
    minutesAfterSubmission: 2 * 24 * 60,
    body: "Accessibility focus is exactly what we said we wanted more of this year.",
  },
  // Decided applications keep their discussion.
  {
    applicantEmail: "ben.carter@crowd.uxhub.test",
    eventSlug: UXATHON,
    authorEmail: "admin-faculty@ubc.ca",
    minutesAfterSubmission: 8 * 60,
    body: "Good answers, but thin on design experience. Waitlist?",
  },
  {
    applicantEmail: "ben.carter@crowd.uxhub.test",
    eventSlug: UXATHON,
    authorEmail: "admin-explorer@example.com",
    minutesAfterSubmission: 9 * 60 + 15,
    editedMinutesLater: 10,
    body: "Waitlisted. First in line if an offer lapses.",
  },
  {
    applicantEmail: "kofi.mensah@crowd.uxhub.test",
    eventSlug: UXATHON,
    authorEmail: "admin-non-ubc@example.com",
    minutesAfterSubmission: 6 * 60,
    body: "Answers were one line each. Encourage them to apply to the next workshop instead.",
  },
  {
    applicantEmail: "ethan.zhao@crowd.uxhub.test",
    eventSlug: UXATHON,
    authorEmail: "admin-no-membership@example.com",
    minutesAfterSubmission: 4 * 60,
    body: "Front-end skills plus a design systems interest. Easy yes.",
  },
];
