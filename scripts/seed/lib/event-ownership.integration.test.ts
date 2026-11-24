import { describe, expect, it } from "vitest";
import { createIntegrationClient, withFixtures } from "@/test/integration";
import { buildSeedEvents, type SeedEvent } from "../data/events.ts";
import type { SeedUser } from "../data/users.ts";
import {
  fetchSeedOwnedProfileIds,
  findEventHolders,
  inspectProdEvents,
} from "./event-ownership.ts";

const db = createIntegrationClient();
const [template] = buildSeedEvents(new Date());

/** A seed event under a test-owned slug. */
function seedFor(slug: string): SeedEvent {
  const seed = structuredClone(template);
  seed.event.slug = slug;
  seed.event.configured_slug = slug;
  return seed;
}

describe("seed event ownership against the database", () => {
  it("reports the records hand-made accounts hold, and only those", () => withFixtures(async fixtures => {
    const [mine, theirs, ticketed, empty] = await Promise.all(
      ["mine", "theirs", "ticketed", "empty"].map((name) =>
        fixtures.createEvent({ slug: `integration-event-${fixtures.tag}-${name}`, status: "active" })
      )
    );
    const fixture = await fixtures.createUser();
    const outsider = await fixtures.createUser();

    const applications = await db.from("event_applications").insert([
      { event_id: mine.id, user_id: fixture.id, status: "submitted" },
      { event_id: theirs.id, user_id: outsider.id, status: "submitted" },
    ]);
    if (applications.error) throw applications.error;
    const ticket = await db.from("event_tickets").insert({ event_id: ticketed.id, user_id: outsider.id });
    if (ticket.error) throw ticket.error;

    const holders = await findEventHolders(
      db,
      [mine.id, theirs.id, ticketed.id, empty.id],
      [fixture.id]
    );
    expect(Object.fromEntries(holders)).toEqual({
      [theirs.id]: ["applications"],
      [ticketed.id]: ["tickets"],
    });

    // With no fixture accounts (prod), every record counts.
    expect((await findEventHolders(db, [mine.id], [])).get(mine.id)).toEqual(["applications"]);
  }));

  it("counts login fixtures and Auth-less crowd profiles as the seed's, nobody else", () => withFixtures(async fixtures => {
    const login = await fixtures.createUser();
    const outsider = await fixtures.createUser();
    const crowd = await db
      .from("user_info")
      .insert({
        email: `${fixtures.tag}@crowd.uxhub.test`,
        first_name: "Crowd",
        last_name: "Member",
        role_access: "basic",
      })
      .select("id")
      .single();
    if (crowd.error) throw crowd.error;
    fixtures.track("user_info", crowd.data.id);

    const owned = await fetchSeedOwnedProfileIds(
      db,
      [{ email: login.email, password: "123456" } as SeedUser],
      []
    );
    expect(owned).toContain(login.id);
    expect(owned).toContain(crowd.data.id);
    expect(owned).not.toContain(outsider.id);
  }));

  it("updates an untouched demo event on prod and leaves a real one alone", () => withFixtures(async fixtures => {
    const demoSeed = seedFor(`integration-event-${fixtures.tag}-demo`);
    const realSeed = seedFor(`integration-event-${fixtures.tag}-real`);
    const newSeed = seedFor(`integration-event-${fixtures.tag}-new`);
    const demo = await fixtures.createEvent({
      slug: demoSeed.event.slug,
      status: "draft",
      name: demoSeed.event.name,
      short_description: demoSeed.event.short_description,
      description: demoSeed.event.description,
    });
    // An admin's event that happens to share a seed slug.
    const real = await fixtures.createEvent({ slug: realSeed.event.slug, status: "active" });
    const member = await fixtures.createUser();
    const ticket = await db.from("event_tickets").insert({ event_id: real.id, user_id: member.id });
    if (ticket.error) throw ticket.error;

    const decisions = await inspectProdEvents(db, [demoSeed, realSeed, newSeed]);
    expect(decisions).toEqual([
      { slug: demoSeed.event.slug, action: "update", id: demo.id },
      { slug: realSeed.event.slug, action: "skip", id: real.id, reason: expect.stringMatching(/registered/) },
      { slug: newSeed.event.slug, action: "create" },
    ]);
  }));
});
