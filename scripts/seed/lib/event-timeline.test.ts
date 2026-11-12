import { describe, expect, it } from "vitest";

import {
  buildSeedEvents,
  EVENT_PHASES,
  PURCHASABLE_MIN_SEATS_LEFT,
  SEED_EVENT_SLUGS,
  type SeedEvent,
} from "../data/events.ts";
import { buildSeedUsers } from "../data/users.ts";
import { buildSeedCrowd } from "../data/crowd.ts";
import { listSeedImageFiles } from "./images.ts";
import { classifySeedEvent, getSeatsTaken } from "./user-fixtures.ts";

const fixedNow = new Date("2026-07-31T19:00:00.000Z");
const events = buildSeedEvents(fixedNow);
const bySlug = new Map(events.map((event) => [event.event.slug, event]));

function seedEvent(slug: string): SeedEvent {
  const event = bySlug.get(slug);
  if (!event) throw new Error(`Missing seed event "${slug}"`);
  return event;
}

function registrationIsOpen(event: SeedEvent): boolean {
  const start = new Date(event.event.registration_opens_at!).getTime();
  const end = new Date(event.event.registration_closes_at!).getTime();
  return start < fixedNow.getTime() && end > fixedNow.getTime();
}

describe("relative event seed timeline", () => {
  it("declares every event in exactly one phase", () => {
    expect([...SEED_EVENT_SLUGS].sort()).toEqual(
      events.map((event) => event.event.slug).sort()
    );
    expect(new Set(SEED_EVENT_SLUGS).size).toBe(SEED_EVENT_SLUGS.length);
  });

  it("builds the intended past, ongoing, and upcoming distribution", () => {
    const counts = { past: 0, ongoing: 0, upcoming: 0 };
    for (const event of events) counts[classifySeedEvent(event, fixedNow)] += 1;

    expect(counts).toEqual({ past: 4, ongoing: 4, upcoming: 10 });
  });

  it("places each declared phase where it belongs on the timeline", () => {
    for (const slug of EVENT_PHASES.past) {
      expect(classifySeedEvent(seedEvent(slug), fixedNow)).toBe("past");
      expect(seedEvent(slug).event.status).toBe("active");
    }

    for (const slug of EVENT_PHASES.ongoing) {
      expect(classifySeedEvent(seedEvent(slug), fixedNow)).toBe("ongoing");
      expect(seedEvent(slug).event.status).toBe("active");
    }

    for (const slug of EVENT_PHASES.happeningToday) {
      expect(classifySeedEvent(seedEvent(slug), fixedNow)).toBe("ongoing");
    }

    for (const slug of [
      ...EVENT_PHASES.purchasable,
      ...EVENT_PHASES.soldOut,
      ...EVENT_PHASES.registrationClosed,
      ...EVENT_PHASES.registrationUpcoming,
      ...EVENT_PHASES.draft,
      ...EVENT_PHASES.scheduled,
    ]) {
      expect(classifySeedEvent(seedEvent(slug), fixedNow)).toBe("upcoming");
    }
  });

  it("leaves the purchasable events open, active, and publicly visible", () => {
    // The whole point of the seed: a set of events that can be bought right
    // now, over and over.
    expect(EVENT_PHASES.purchasable.length).toBeGreaterThanOrEqual(5);

    for (const slug of EVENT_PHASES.purchasable) {
      const event = seedEvent(slug);
      expect(event.event.status).toBe("active");
      expect(registrationIsOpen(event)).toBe(true);
      expect(event.event.max_capacity).toBeGreaterThan(0);
    }
  });

  it("covers free and paid checkout with active members always free", () => {
    const prices = EVENT_PHASES.purchasable.map(slug => seedEvent(slug).event);
    expect(prices.some(event => event.configured_pricing_mode === "free" && event.regular_price === 0)).toBe(true);
    expect(prices.some(event => event.configured_pricing_mode === "paid" && Number(event.regular_price) > 0)).toBe(true);
    for (const event of prices) {
      expect(event.pricing_policy).toBe("figma");
      expect(event.member_price).toBe(0);
      expect(event.configured_price).toBe(event.regular_price);
    }
  });

  it("keeps the ongoing events open through a long window", () => {
    for (const slug of EVENT_PHASES.ongoing) {
      expect(registrationIsOpen(seedEvent(slug))).toBe(true);
    }

    const longestEnd = Math.max(
      ...EVENT_PHASES.ongoing.map((slug) =>
        new Date(seedEvent(slug).event.ends_at!).getTime()
      )
    );
    expect(longestEnd - fixedNow.getTime()).toBeGreaterThan(
      18 * 30 * 24 * 60 * 60 * 1000
    );
  });

  it("keeps one closed and one not-yet-open registration window", () => {
    for (const slug of EVENT_PHASES.registrationClosed) {
      const event = seedEvent(slug);
      expect(event.event.status).toBe("active");
      expect(
        new Date(event.event.registration_closes_at!).getTime()
      ).toBeLessThan(fixedNow.getTime());
    }

    for (const slug of EVENT_PHASES.registrationUpcoming) {
      const event = seedEvent(slug);
      expect(event.event.status).toBe("active");
      expect(
        new Date(event.event.registration_opens_at!).getTime()
      ).toBeGreaterThan(fixedNow.getTime());
    }
  });

  it("keeps drafts out of the public listing", () => {
    for (const slug of [...EVENT_PHASES.draft, ...EVENT_PHASES.scheduled]) {
      expect(seedEvent(slug).event.status).toBe("draft");
    }
    for (const slug of EVENT_PHASES.draft) {
      expect(seedEvent(slug).event.publish_at ?? null).toBeNull();
    }
  });

  it("schedules a draft to publish a few days out, and nothing else", () => {
    // events_publish_schedule_requires_draft: only drafts may carry one.
    for (const event of events) {
      if (EVENT_PHASES.scheduled.includes(event.event.slug as never)) continue;
      expect(event.event.publish_at ?? null).toBeNull();
    }
    for (const slug of EVENT_PHASES.scheduled) {
      const { publish_at, starts_at, registration_opens_at } = seedEvent(slug).event;
      const publishAt = Date.parse(publish_at!);
      expect(publishAt - fixedNow.getTime()).toBeGreaterThan(24 * 60 * 60 * 1000);
      expect(publishAt - fixedNow.getTime()).toBeLessThan(7 * 24 * 60 * 60 * 1000);
      expect(publishAt).toBeLessThan(Date.parse(starts_at!));
      expect(Date.parse(registration_opens_at!)).toBeGreaterThanOrEqual(publishAt);
    }
  });

  it("runs one event right now, with check-in open", () => {
    // Hold it to the run at any hour, not only at fixedNow.
    for (const hour of [0, 7, 12, 23]) {
      const now = new Date(Date.UTC(2026, 10, 9, hour, 41));
      const today = buildSeedEvents(now).find(
        (event) => event.event.slug === EVENT_PHASES.happeningToday[0]
      )!;
      expect(classifySeedEvent(today, now)).toBe("ongoing");
      expect(Date.parse(today.event.registration_closes_at!)).toBeGreaterThan(now.getTime());
      expect(
        today.checkInSessions.some(
          (session) =>
            Date.parse(session.start_time!) <= now.getTime() &&
            now.getTime() <= Date.parse(session.end_time!)
        )
      ).toBe(true);
      // One day: six hours, long enough to work through after a seed.
      expect(Date.parse(today.event.ends_at!) - Date.parse(today.event.starts_at!)).toBe(
        6 * 60 * 60 * 1000
      );
    }
  });

  it("keeps historical registration windows closed", () => {
    for (const slug of EVENT_PHASES.past) {
      expect(
        new Date(seedEvent(slug).event.registration_closes_at!).getTime()
      ).toBeLessThan(fixedNow.getTime());
    }
  });

  it("keeps phase annotations out of the visible names", () => {
    expect(
      events.every(
        (event) => !/\[(ongoing|registration open)\]/i.test(event.event.name)
      )
    ).toBe(true);
  });
});

describe("seed event cover images", () => {
  it("names a file that exists on disk", async () => {
    const available = new Set(await listSeedImageFiles());

    expect(available.size).toBeGreaterThan(0);
    for (const event of events) {
      expect(available.has(event.imageKey)).toBe(true);
    }
  });

  it("does not repeat a cover on adjacent public cards", () => {
    // `/events` lists active events by `starts_at` ascending, so neighbours in
    // this order are neighbours on the page.
    const listed = events
      .filter((event) => event.event.status === "active")
      .sort((left, right) =>
        Date.parse(left.event.starts_at!) - Date.parse(right.event.starts_at!)
      );

    for (let index = 1; index < listed.length; index += 1) {
      expect(listed[index].imageKey).not.toBe(listed[index - 1].imageKey);
    }
  });
});

describe("fixture purchases", () => {
  const users = buildSeedUsers(events, fixedNow);
  const crowd = buildSeedCrowd(events, fixedNow);
  const seatsTaken = getSeatsTaken([...users, ...crowd], fixedNow);

  it("leaves every purchasable event unbought by the login fixtures", () => {
    // If a fixture account already holds a ticket, that account can no longer
    // exercise checkout for the event — which is the one thing this set is for.
    // The crowd is exempt: nobody signs in as it, so its tickets never stand
    // between a tester and checkout. Its seats are held to the next test.
    const purchasable = new Set<string>(EVENT_PHASES.purchasable);

    for (const user of users) {
      for (const purchase of user.purchases) {
        expect(purchasable.has(purchase.eventSlug ?? "")).toBe(false);
      }
      // A draft application holds no seat and buys nothing, so it leaves the
      // event checkout-ready; anything else on one does not.
      for (const registration of user.registrations) {
        if (
          !registration.ticket &&
          !registration.purchaseKey &&
          registration.application?.status === "draft"
        ) {
          continue;
        }
        expect(purchasable.has(registration.eventSlug)).toBe(false);
      }
    }
  });

  it("leaves seats on every purchasable event after the crowd", () => {
    // Crowd tickets and open offers take seats, and a sold-out event can't be
    // bought by anyone. Each purchasable event keeps enough for a few
    // checkouts between seed runs.
    for (const slug of EVENT_PHASES.purchasable) {
      const capacity = seedEvent(slug).event.max_capacity!;
      expect(capacity - (seatsTaken.get(slug) ?? 0)).toBeGreaterThanOrEqual(
        PURCHASABLE_MIN_SEATS_LEFT
      );
    }
  });

  it("makes thinkbox nearly full and the sold-out event exactly full", () => {
    const thinkbox = seedEvent("thinkbox-office-tour").event.max_capacity!;
    expect(thinkbox - seatsTaken.get("thinkbox-office-tour")!).toBe(
      PURCHASABLE_MIN_SEATS_LEFT
    );
    for (const slug of EVENT_PHASES.soldOut) {
      const event = seedEvent(slug);
      expect(seatsTaken.get(slug)).toBe(event.event.max_capacity);
      expect(event.event.status).toBe("active");
      // Still open, so the badge reads "Full" rather than "Registration closed".
      expect(registrationIsOpen(event)).toBe(true);
    }
  });

  it("gives a deep fixture a ticket to today's event, unchecked", () => {
    const today = users.flatMap((user) =>
      user.registrations
        .filter((registration) => registration.eventSlug === EVENT_PHASES.happeningToday[0])
        .map((registration) => ({ user, registration }))
    );
    expect(today).toHaveLength(1);
    expect(today[0].user.fullEventHistory).toBe(true);
    expect(today[0].registration.ticket).toBe(true);
    expect(today[0].registration.checkIns).toBeUndefined();
  });

  it("still gives every account a failed purchase to look at somewhere", () => {
    const failed = users.flatMap((user) =>
      user.purchases.filter((purchase) => purchase.status === "failed")
    );

    expect(failed.length).toBeGreaterThan(0);
    for (const purchase of failed) {
      expect(purchase.fulfilledAt).toBeUndefined();
      expect(purchase.failureReason).toBeTruthy();
    }
  });
});

describe("pacificTimestamp", () => {
  it("reads the time as Vancouver wall clock", async () => {
    const { pacificTimestamp } = await import("./relative-dates.ts");
    // PST, UTC-8, in a past year so future offset changes can't move it.
    expect(pacificTimestamp(new Date("2025-01-15T00:00:00Z"), "18:30")).toBe(
      "2025-01-16T02:30:00.000Z"
    );
    // PDT, UTC-7.
    expect(pacificTimestamp(new Date("2025-07-15T00:00:00Z"), "09:00")).toBe(
      "2025-07-15T16:00:00.000Z"
    );
  });
});
