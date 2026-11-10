import { describe, expect, it } from "vitest";

import { buildSeedEvents } from "../data/events.ts";
import { buildSeedCrowd } from "../data/crowd.ts";
import { FORMER_REVIEWER, seedReviewNotes, type SeedReviewNote } from "../data/review-notes.ts";
import { buildSeedUsers } from "../data/users.ts";
import { resolveSeedReviewNotes } from "./review-notes.ts";

// Across a few run dates, since every time follows the run.
const runs = ["2026-07-31T19:00:00.000Z", "2026-11-09T03:00:00.000Z", "2027-02-28T23:30:00.000Z"];

function everyoneAt(now: Date) {
  const events = buildSeedEvents(now);
  return [...buildSeedUsers(events, now), ...buildSeedCrowd(events, now)];
}

const now = new Date(runs[0]);
const everyone = everyoneAt(now);

function note(overrides: Partial<SeedReviewNote>): SeedReviewNote {
  return {
    applicantEmail: "noah.fischer@crowd.uxhub.test",
    eventSlug: "uxathon-upcoming",
    authorEmail: "admin-explorer@example.com",
    minutesAfterSubmission: 60,
    body: "Fine.",
    ...overrides,
  };
}

describe("seed reviewer notes", () => {
  it.each(runs)("resolve against the fixtures for a run at %s", (run) => {
    const at = new Date(run);
    const notes = resolveSeedReviewNotes(seedReviewNotes, everyoneAt(at), at);

    expect(notes).toHaveLength(seedReviewNotes.length);
    for (const resolved of notes) {
      expect(new Date(resolved.createdAt).getTime()).toBeLessThanOrEqual(at.getTime());
      if (resolved.editedAt) {
        expect(new Date(resolved.editedAt) > new Date(resolved.createdAt)).toBe(true);
      }
    }
  });

  it("cover a deleted author, an edit, a long note and several states", () => {
    const notes = resolveSeedReviewNotes(seedReviewNotes, everyone, now);
    expect(notes.some((resolved) => resolved.authorEmail === FORMER_REVIEWER.email)).toBe(true);
    expect(notes.some((resolved) => resolved.editedAt !== null)).toBe(true);
    expect(notes.some((resolved) => resolved.body.split("\n").length > 6)).toBe(true);

    const statuses = new Set(
      notes.map(
        (resolved) =>
          everyone
            .find((user) => user.email === resolved.applicantEmail)
            ?.registrations.find((registration) => registration.eventSlug === resolved.eventSlug)
            ?.application?.status
      )
    );
    expect([...statuses].sort()).toEqual(["accepted", "rejected", "submitted", "waitlisted"]);
  });

  it("keep times fixed for a run's day", () => {
    const morning = new Date("2026-11-09T01:00:00.000Z");
    const evening = new Date("2026-11-09T22:00:00.000Z");
    expect(resolveSeedReviewNotes(seedReviewNotes, everyoneAt(morning), morning)).toEqual(
      resolveSeedReviewNotes(seedReviewNotes, everyoneAt(evening), evening)
    );
  });

  it("refuse a note on a draft", () => {
    expect(() =>
      resolveSeedReviewNotes(
        [note({ applicantEmail: "student-innovator@example.com" })],
        everyone,
        now
      )
    ).toThrow("draft");
  });

  it("refuse a note on an application that doesn't exist", () => {
    expect(() =>
      resolveSeedReviewNotes([note({ eventSlug: "figma-basics-workshop" })], everyone, now)
    ).toThrow("no such application");
  });

  it.each([
    ["a member", "student-explorer@example.com"],
    ["a crowd account", "amara.osei@crowd.uxhub.test"],
    ["an unknown address", "nobody@example.com"],
  ])("refuse %s as the author", (_, authorEmail) => {
    expect(() => resolveSeedReviewNotes([note({ authorEmail })], everyone, now)).toThrow(
      "admin login fixture"
    );
  });

  it("accept the manager as an author", () => {
    expect(() =>
      resolveSeedReviewNotes(
        [note({ authorEmail: "manager-no-membership@example.com" })],
        everyone,
        now
      )
    ).not.toThrow();
  });

  it.each([
    ["empty", ""],
    ["untrimmed", " Fine. "],
    ["too long", "a".repeat(2001)],
  ])("refuse text that is %s", (_, body) => {
    expect(() => resolveSeedReviewNotes([note({ body })], everyone, now)).toThrow("characters");
  });

  it("refuse a note dated after the run", () => {
    expect(() =>
      resolveSeedReviewNotes([note({ minutesAfterSubmission: 10 * 365 * 24 * 60 })], everyone, now)
    ).toThrow("after the run");
  });
});
