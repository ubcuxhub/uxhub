import { describe, expect, it } from "vitest";
import { clientAs, withFixtures } from "@/test/integration";
import { fetchEventById, fetchEventPricingLocked } from "@/lib/supabase-helpers/events";

const config = { configured_slug_edited: false, configured_marketing_mode: "external", configured_marketing_url: "https://devpost.com/design", configured_slug: "design", configured_pricing_mode: "paid", configured_price: 12.5, is_featured: true };

describe("form-first event configuration", () => {
  it("persists configuration atomically without activating it or rewriting legacy prices/links", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ marketing_url: "https://existing.example.com", regular_price: 20, member_price: 5, status: "draft" });
    const configured = { ...config, configured_slug: `config-${fixtures.tag}` };
    const result = await fixtures.supabase.rpc("save_admin_event_builder", { p_event_id: event.id, p_event: configured, p_draft_id: null!, p_draft_revision: 0, p_slug: null!, p_expected_image_url: null!, p_expected_header_image_url: null!, p_check_in_sessions: [], p_application_questions: [], p_mentors: [], p_sponsors: [] });
    expect(result.error).toBeNull();
    expect(await fetchEventById(fixtures.supabase, event.id)).toMatchObject({ ...configured, regular_price: 20, member_price: 5, marketing_url: "https://existing.example.com", slug: event.slug, pricing_policy: "legacy" });
  }));
  it("keeps new-policy events as drafts and rejects premature purchases and tickets", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ ...config, configured_slug: `new-config-${fixtures.tag}`, status: "draft" });
    expect(event.pricing_policy).toBe("figma_pending");
    for (const update of [{ status: "active" as const }, { publish_at: "2099-01-01T00:00:00Z" }, { pricing_policy: "legacy" }]) {
      expect((await fixtures.supabase.from("events").update(update).eq("id", event.id)).error).not.toBeNull();
    }
    const user = await fixtures.createUser();
    expect((await fixtures.supabase.from("event_tickets").insert({ event_id: event.id, user_id: user.id })).error?.message).toMatch(/integration/);
    expect((await fixtures.supabase.from("purchases").insert({ event_id: event.id, user_id: user.id, amount_cents: 1250, currency: "CAD", status: "pending", kind: "event_ticket", idempotency_key: `pending-${fixtures.tag}` })).error?.message).toMatch(/integration/);
  }));
  it("locks both pricing representations once a registration exists while allowing unrelated edits", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent();
    const user = await fixtures.createUser();
    const ticket = await fixtures.supabase.from("event_tickets").insert({ event_id: event.id, user_id: user.id }).select().single();
    if (ticket.error) throw ticket.error;
    expect(await fetchEventPricingLocked(fixtures.supabase, event.id)).toBe(true);
    for (const update of [{ regular_price: 99 }, { member_price: 0 }, { configured_pricing_mode: "paid", configured_price: 15 }]) {
      expect((await fixtures.supabase.from("events").update(update).eq("id", event.id)).error?.message).toMatch(/Pricing is locked/);
    }
    expect((await fixtures.supabase.from("events").update({ name: "Unrelated edit", regular_price: event.regular_price }).eq("id", event.id)).error).toBeNull();
    expect((await fixtures.supabase.from("event_tickets").select().eq("id", ticket.data.id)).data).toEqual([ticket.data]);
  }));
  it("preserves a published URL permanently, including after returning to draft", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ status: "active" });
    expect(event.first_published_at).not.toBeNull();
    expect((await fixtures.supabase.from("events").update({ configured_slug: event.slug }).eq("id", event.id)).error).toBeNull();
    expect((await fixtures.supabase.from("events").update({ status: "draft", first_published_at: null }).eq("id", event.id)).error).toBeNull();
    for (const update of [{ configured_slug: "forged-url" }, { slug: "forged-identity" }]) expect((await fixtures.supabase.from("events").update(update).eq("id", event.id)).error?.message).toMatch(/locked after first publication/);
  }));
  it("reserves a shared URL namespace and rejects invalid destinations/amounts", () => withFixtures(async fixtures => {
    const first = await fixtures.createEvent({ configured_slug: `claimed-${fixtures.tag}` });
    const second = await fixtures.createEvent({ slug: `second-${fixtures.tag}` });
    for (const configured_slug of [first.slug!, first.configured_slug!, "admin", "../invalid"]) expect((await fixtures.supabase.from("events").update({ configured_slug }).eq("id", second.id)).error).not.toBeNull();
    for (const update of [{ configured_marketing_mode: "external", configured_marketing_url: null }, { configured_marketing_mode: "external", configured_marketing_url: "javascript:alert(1)" }, { configured_pricing_mode: "paid", configured_price: -1 }, { configured_pricing_mode: "paid", configured_price: 1.001 }]) expect((await fixtures.supabase.from("events").update(update).eq("id", second.id)).error).not.toBeNull();
    const races = await Promise.all([first, second].map(event => fixtures.supabase.from("events").update({ configured_slug: `race-${fixtures.tag}` }).eq("id", event.id)));
    expect(races.filter(result => result.error === null)).toHaveLength(1);
  }));
  it("locks configuration for held offers and in-flight payments", () => withFixtures(async fixtures => {
    for (const kind of ["offer", "payment"]) {
      const event = await fixtures.createEvent({ slug: `${kind}-${fixtures.tag}` });
      const user = await fixtures.createUser();
      const result = kind === "offer"
        ? await fixtures.supabase.from("event_applications").insert({ event_id: event.id, user_id: user.id, status: "accepted", offer_expires_at: "2099-01-01T00:00:00Z" })
        : await fixtures.supabase.from("purchases").insert({ event_id: event.id, user_id: user.id, amount_cents: 1000, currency: "CAD", status: "pending", kind: "event_ticket", idempotency_key: `flight-${fixtures.tag}` });
      if (result.error) throw result.error;
      expect(await fetchEventPricingLocked(fixtures.supabase, event.id)).toBe(true);
      expect((await fixtures.supabase.from("events").update({ configured_pricing_mode: "free", configured_price: 0 }).eq("id", event.id)).error?.message).toMatch(/Pricing is locked/);
    }
  }));
  it("serializes concurrent configuration edits and ticket registration", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent();
    const user = await fixtures.createUser();
    const [edit, registration] = await Promise.all([
      fixtures.supabase.from("events").update({ configured_pricing_mode: "paid", configured_price: 15 }).eq("id", event.id),
      fixtures.supabase.from("event_tickets").insert({ event_id: event.id, user_id: user.id }),
    ]);
    expect(registration.error).toBeNull();
    expect(edit.error === null || /Pricing is locked/.test(edit.error.message)).toBe(true);
    expect(await fetchEventPricingLocked(fixtures.supabase, event.id)).toBe(true);
    expect((await fixtures.supabase.from("events").update({ configured_pricing_mode: "paid", configured_price: 99 }).eq("id", event.id)).error?.message).toMatch(/Pricing is locked/);
    expect((await fetchEventById(fixtures.supabase, event.id))?.configured_price).toBe(edit.error ? null : 15);
  }));
  it("restricts the lock aggregate to staff and denies nonstaff configuration writes", () => withFixtures(async fixtures => {
    const event = await fixtures.createEvent({ status: "active" });
    const member = await fixtures.createUser();
    for (const user of [null, member]) {
      await expect(fetchEventPricingLocked(clientAs(user), event.id)).rejects.toBeDefined();
      const write = await clientAs(user).from("events").update({ configured_price: 10, configured_pricing_mode: "paid" }).eq("id", event.id).select();
      expect(write.error !== null || write.data?.length === 0).toBe(true);
      expect((await fetchEventById(fixtures.supabase, event.id))?.configured_price).toBeNull();
      expect((await clientAs(user).from("event_url_claims").select()).error).not.toBeNull();
    }
    for (const role_access of ["admin", "manager"] as const) {
      const staff = await fixtures.createUser({ role_access });
      expect(await fetchEventPricingLocked(clientAs(staff), event.id)).toBe(false);
    }
  }));
});
