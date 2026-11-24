import { describe, expect, it } from "vitest";

import { clientAs, withFixtures } from "@/test/integration";
import { fetchFeaturedEvent } from "./events";

// Far enough ahead that no seeded event is still upcoming, so only this
// test's events can qualify.
const NOW = new Date("2091-03-01T12:00:00Z");
const at = (iso: string) => ({ starts_at: `${iso}T18:00:00Z`, ends_at: `${iso}T20:00:00Z` });

describe("fetchFeaturedEvent", () => {
  it("picks the soonest published, featured event that hasn't ended or been canceled", () =>
    withFixtures(async (fixtures) => {
      const member = clientAs(await fixtures.createUser());
      const slug = (name: string) => `${name}-${fixtures.tag}`;

      await fixtures.createEvent({ slug: slug("not-featured"), status: "active", is_featured: false, ...at("2091-03-02") });
      await fixtures.createEvent({ slug: slug("draft"), status: "draft", is_featured: true, ...at("2091-03-03") });
      await fixtures.createEvent({ slug: slug("canceled"), status: "active", is_featured: true, canceled_at: "2091-02-01T00:00:00Z", ...at("2091-03-04") });
      await fixtures.createEvent({ slug: slug("ended"), status: "active", is_featured: true, ...at("2091-02-20") });
      const later = await fixtures.createEvent({ slug: slug("later"), status: "active", is_featured: true, ...at("2091-03-10") });
      const sooner = await fixtures.createEvent({ slug: slug("sooner"), status: "active", is_featured: true, ...at("2091-03-05") });

      expect((await fetchFeaturedEvent(member, NOW))?.id).toBe(sooner.id);
      // Once the sooner one ends, the next featured event takes its place.
      expect((await fetchFeaturedEvent(member, new Date("2091-03-06T00:00:00Z")))?.id).toBe(later.id);
    }));

  it("still features an event that is in progress", () =>
    withFixtures(async (fixtures) => {
      const member = clientAs(await fixtures.createUser());
      const live = await fixtures.createEvent({
        slug: `live-${fixtures.tag}`,
        status: "active",
        is_featured: true,
        starts_at: "2091-03-01T10:00:00Z",
        ends_at: "2091-03-01T14:00:00Z",
      });

      expect((await fetchFeaturedEvent(member, NOW))?.id).toBe(live.id);
    }));

  it("returns null when nothing is featured", () =>
    withFixtures(async (fixtures) => {
      const member = clientAs(await fixtures.createUser());
      expect(await fetchFeaturedEvent(member, new Date("2099-01-01T00:00:00Z"))).toBeNull();
    }));
});
