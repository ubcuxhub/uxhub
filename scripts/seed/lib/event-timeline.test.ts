import { describe, expect, it } from "vitest";

import {
  buildSeedEvents,
  EVENT_PHASES,
  SEED_EVENT_SLUGS,
  type SeedEvent,
} from "../data/events.ts";
import { buildSeedUsers } from "../data/users.ts";
import { listSeedImageFiles } from "./images.ts";
import { classifySeedEvent } from "./user-fixtures.ts";

const fixedNow = new Date("2026-07-31T19:00:00.000Z");
const events = buildSeedEvents(fixedNow);
const bySlug = new Map(events.map((event) => [event.event.slug, event]));

function seedEvent(slug: string): SeedEvent {
  const event = bySlug.get(slug);
  if (!event) throw new Error(`Missing seed event "${slug}"`);
  return event;
}

function registrationIsOpen(event: SeedEvent): boolean {
  const start = new Date(event.event.registration_start_time!).getTime();
  const end = new Date(event.event.registration_end_time!).getTime();
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

    expect(counts).toEqual({ past: 4, ongoing: 3, upcoming: 8 });
  });

  it("places each declared phase where it belongs on the timeline", () => {
    for (const slug of EVENT_PHASES.past) {
      expect(classifySeedEvent(seedEvent(slug), fixedNow)).toBe("past");
      expect(seedEvent(slug).event.status).toBe("archived");
    }

    for (const slug of EVENT_PHASES.ongoing) {
      expect(classifySeedEvent(seedEvent(slug), fixedNow)).toBe("ongoing");
      expect(seedEvent(slug).event.status).toBe("active");
    }

    for (const slug of [
      ...EVENT_PHASES.purchasable,
      ...EVENT_PHASES.registrationClosed,
      ...EVENT_PHASES.registrationUpcoming,
      ...EVENT_PHASES.draft,
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

  it("covers the free, member-discount, and full-price checkout paths", () => {
    const prices = EVENT_PHASES.purchasable.map((slug) => {
      const { regular_price, member_price } = seedEvent(slug).event;
      return { regular: Number(regular_price), member: Number(member_price) };
    });

    expect(prices.some((price) => price.regular === 0)).toBe(true);
    expect(
      prices.some((price) => price.regular > 0 && price.member === price.regular)
    ).toBe(true);
    expect(
      prices.some(
        (price) => price.regular > 0 && price.member > 0 && price.member < price.regular
      )
    ).toBe(true);
  });

  it("keeps the ongoing events open through a long window", () => {
    for (const slug of EVENT_PHASES.ongoing) {
      expect(registrationIsOpen(seedEvent(slug))).toBe(true);
    }

    const longestEnd = Math.max(
      ...EVENT_PHASES.ongoing.map((slug) =>
        new Date(`${seedEvent(slug).event.end_date}T23:59:59Z`).getTime()
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
        new Date(event.event.registration_end_time!).getTime()
      ).toBeLessThan(fixedNow.getTime());
    }

    for (const slug of EVENT_PHASES.registrationUpcoming) {
      const event = seedEvent(slug);
      expect(event.event.status).toBe("active");
      expect(
        new Date(event.event.registration_start_time!).getTime()
      ).toBeGreaterThan(fixedNow.getTime());
    }
  });

  it("keeps drafts out of the public listing", () => {
    for (const slug of EVENT_PHASES.draft) {
      expect(seedEvent(slug).event.status).toBe("draft");
    }
  });

  it("keeps historical registration windows closed", () => {
    for (const slug of EVENT_PHASES.past) {
      expect(
        new Date(seedEvent(slug).event.registration_end_time!).getTime()
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
    // `/events` lists active events by `start_date` ascending, so neighbours in
    // this order are neighbours on the page.
    const listed = events
      .filter((event) => event.event.status === "active")
      .sort((left, right) =>
        String(left.event.start_date).localeCompare(String(right.event.start_date))
      );

    for (let index = 1; index < listed.length; index += 1) {
      expect(listed[index].imageKey).not.toBe(listed[index - 1].imageKey);
    }
  });
});

describe("fixture purchases", () => {
  const users = buildSeedUsers(events, fixedNow);

  it("leaves every purchasable event unbought", () => {
    // If a fixture account already holds a ticket, that account can no longer
    // exercise checkout for the event — which is the one thing this set is for.
    const purchasable = new Set<string>(EVENT_PHASES.purchasable);

    for (const user of users) {
      for (const purchase of user.purchases) {
        expect(purchasable.has(purchase.eventSlug ?? "")).toBe(false);
      }
      for (const registration of user.registrations) {
        expect(purchasable.has(registration.eventSlug)).toBe(false);
      }
    }
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
