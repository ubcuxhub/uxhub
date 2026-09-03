import { describe, expect, it } from "vitest";

import { buildSeedEvents } from "../data/events.ts";
import { classifySeedEvent } from "./user-fixtures.ts";

const fixedNow = new Date("2026-07-31T19:00:00.000Z");
const events = buildSeedEvents(fixedNow);

describe("relative event seed timeline", () => {
  it("builds the intended past, ongoing, and upcoming distribution", () => {
    const counts = { past: 0, ongoing: 0, upcoming: 0 };
    for (const event of events) counts[classifySeedEvent(event, fixedNow)] += 1;

    expect(counts).toEqual({ past: 5, ongoing: 3, upcoming: 6 });
  });

  it("assigns lifecycle statuses to match the seeded timeline", () => {
    const byPhase = {
      past: events.filter(
        (event) => classifySeedEvent(event, fixedNow) === "past"
      ),
      ongoing: events.filter(
        (event) => classifySeedEvent(event, fixedNow) === "ongoing"
      ),
      upcoming: events.filter(
        (event) => classifySeedEvent(event, fixedNow) === "upcoming"
      ),
    };

    expect(byPhase.past.every((event) => event.event.status === "archived")).toBe(
      true
    );
    expect(byPhase.ongoing.every((event) => event.event.status === "active")).toBe(
      true
    );
    expect(
      byPhase.upcoming
        .filter((event) => event.event.status === "draft")
        .map((event) => event.event.slug)
        .sort()
    ).toEqual(["design-sprint-2026", "student-panel-2026"]);
    expect(
      byPhase.upcoming.filter((event) => event.event.status === "active")
    ).toHaveLength(4);
  });

  it("keeps long-running events active with registration open", () => {
    const ongoing = events.filter(
      (event) => classifySeedEvent(event, fixedNow) === "ongoing"
    );

    expect(ongoing).toHaveLength(3);
    for (const event of ongoing) {
      expect(new Date(event.event.registration_start_time!).getTime()).toBeLessThan(
        fixedNow.getTime()
      );
      expect(new Date(event.event.registration_end_time!).getTime()).toBeGreaterThan(
        fixedNow.getTime()
      );
    }

    const longestEnd = Math.max(
      ...ongoing.map((event) => new Date(`${event.event.end_date}T23:59:59Z`).getTime())
    );
    expect(longestEnd - fixedNow.getTime()).toBeGreaterThan(
      18 * 30 * 24 * 60 * 60 * 1000
    );
  });

  it("opens registration for exactly five far-future events", () => {
    const openUpcoming = events.filter(
      (event) =>
        classifySeedEvent(event, fixedNow) === "upcoming" &&
        new Date(event.event.registration_start_time!).getTime() <
          fixedNow.getTime() &&
        new Date(event.event.registration_end_time!).getTime() >
          fixedNow.getTime()
    );

    expect(openUpcoming).toHaveLength(5);
    for (const event of openUpcoming) {
      expect(classifySeedEvent(event, fixedNow)).toBe("upcoming");
      expect(new Date(event.event.registration_start_time!).getTime()).toBeLessThan(
        fixedNow.getTime()
      );
      expect(new Date(event.event.registration_end_time!).getTime()).toBeGreaterThan(
        fixedNow.getTime()
      );
    }

    const studentPanel = events.find(
      (event) => event.event.slug === "student-panel-2026"
    );
    expect(studentPanel).toBeDefined();
    expect(new Date(studentPanel!.event.registration_start_time!).getTime()).toBeGreaterThan(
      fixedNow.getTime()
    );
    expect(events.every((event) => !/\[(ongoing|registration open)\]/i.test(event.event.name))).toBe(
      true
    );
  });

  it("keeps historical registration windows closed and slugs stable", () => {
    const past = events.filter(
      (event) => classifySeedEvent(event, fixedNow) === "past"
    );
    for (const event of past) {
      expect(new Date(event.event.registration_end_time!).getTime()).toBeLessThan(
        fixedNow.getTime()
      );
    }

    expect(events.map((event) => event.event.slug)).toEqual([
      "get-to-know-ux-hub-2025",
      "design-sprint-2025",
      "student-panel-2025",
      "uxathon-2026",
      "thinkbox-office-tour-2026",
      "industry-talk-ai-and-ux-2026",
      "get-to-know-ux-hub-2026",
      "design-sprint-2026",
      "portfolio-review-night-2027",
      "resume-clinic-2027",
      "student-panel-2026",
      "coffee-chat-social-2026",
      "uxathon-2027",
      "thinkbox-office-tour-2027",
    ]);
  });
});
