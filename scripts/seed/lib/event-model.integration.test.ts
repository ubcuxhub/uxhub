import { describe, expect, it } from "vitest";
import { createIntegrationClient, withFixtures } from "@/test/integration";
import { buildSeedEvents } from "../data/events.ts";
import { buildSeedUsers } from "../data/users.ts";
import { reconcileBuilderSettings } from "./builder-settings.ts";
import { prepareLegacySeedPricing } from "./event-model.ts";

const db = createIntegrationClient();
const options = { target: "local", users: true, prune: true, dryRun: false };

describe("seed conversion with real pricing and durable question guards", () => {
  it("converts only fixture locks, preserves application identity and never clears its durable marker", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ status: "active" });
    const user = await fixtures.createUser();
    const definitions = buildSeedEvents(new Date());
    const seed = structuredClone(definitions[0]);
    seed.event.slug = event.slug;
    seed.event.configured_slug = event.slug;
    const fixture = { ...buildSeedUsers(definitions, new Date())[0], email: user.email! };
    const question = await db.from("event_application_questions").insert({ event_id: event.id, question: "Why join?", response_type: "short_text", is_required: true }).select("id").single();
    if (question.error) throw question.error;
    const application = await db.from("event_applications").insert({ event_id: event.id, user_id: user.id, status: "accepted", offer_expires_at: new Date(Date.now() + 86400000).toISOString() }).select("id").single();
    if (application.error) throw application.error;
    const marker = await db.from("event_application_settings").select("questions_locked_at").eq("event_id", event.id).single();
    const purchase = await db.from("purchases").insert({ user_id: user.id, event_id: event.id, kind: "event_ticket", status: "completed", amount_cents: 1000, currency: "CAD", idempotency_key: `${fixtures.tag}-legacy` }).select("id").single();
    if (purchase.error) throw purchase.error;
    fixtures.track("purchases", purchase.data.id);
    const ticket = await db.from("event_tickets").insert({ event_id: event.id, user_id: user.id, purchase_id: purchase.data.id });
    if (ticket.error) throw ticket.error;
    const pricing = { configured_pricing_mode: "free", configured_price: 0, regular_price: 0, member_price: 0 };
    expect((await db.from("events").update(pricing).eq("id", event.id)).error?.message).toMatch(/locked/);
    expect(await prepareLegacySeedPricing(db, [seed], [fixture], { ...options, dryRun: true })).toBe(1);
    expect((await db.from("event_tickets").select("id").eq("event_id", event.id)).data).toHaveLength(1);
    expect(await prepareLegacySeedPricing(db, [seed], [fixture], options)).toBe(1);
    expect((await db.from("events").update(pricing).eq("id", event.id)).error).toBeNull();
    expect((await db.from("event_applications").select("id").eq("event_id", event.id)).data).toEqual([{ id: application.data.id }]);
    await reconcileBuilderSettings(db, event.id, { ...seed, applicationQuestions: [{ question: "Why join?", response_type: "short_text", is_required: true }] });
    expect((await db.from("event_application_settings").select("questions_locked_at").eq("event_id", event.id).single()).data).toEqual(marker.data);
    expect((await db.from("event_application_questions").update({ question: "Changed" }).eq("id", question.data.id)).error?.message).toMatch(/locked/);
    expect(await prepareLegacySeedPricing(db, [seed], [fixture], options)).toBe(0);
  }));

  it("preserves handmade tickets and refuses before deleting fixture records", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ status: "active" });
    const user = await fixtures.createUser();
    const outsider = await fixtures.createUser();
    const definitions = buildSeedEvents(new Date());
    const seed = structuredClone(definitions[0]);
    seed.event.slug = event.slug;
    const fixture = { ...buildSeedUsers(definitions, new Date())[0], email: user.email! };
    const tickets = await db.from("event_tickets").insert([user, outsider].map(person => ({ event_id: event.id, user_id: person.id })));
    if (tickets.error) throw tickets.error;
    await expect(prepareLegacySeedPricing(db, [seed], [fixture], options)).rejects.toThrow("non-fixture");
    expect((await db.from("event_tickets").select("id").eq("event_id", event.id)).data).toHaveLength(2);
    expect((await db.from("events").select("pricing_policy").eq("id", event.id).single()).data?.pricing_policy).toBe("legacy");
  }));
});
