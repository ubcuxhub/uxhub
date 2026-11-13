/**
 * Automatic page URLs against the local database: a second event with the
 * same name is numbered past the URLs other events claim (identity slugs and
 * configured page URLs alike), re-saving keeps an event's own URL, and a URL
 * the admin typed still gets the "already in use" refusal.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const guards = vi.hoisted(() => ({ requireAdmin: vi.fn(), requireManager: vi.fn() }));
vi.mock("@/lib/auth/guards", () => guards);

import { saveAdminEventAction, type SaveAdminEventInput } from "@/features/admin/actions";
import { fetchEventById } from "@/lib/supabase-helpers/events";

const db = createIntegrationClient();

beforeEach(() => {
  guards.requireAdmin.mockResolvedValue({ id: "admin" });
});

function input(name: string, url: { edited: boolean; slug: string }, eventId?: string, expectedRevision?: number): SaveAdminEventInput {
  return {
    eventId,
    expectedRevision,
    expectedImageUrl: null,
    event: {
      name,
      short_description: "Page URL",
      description: "Page URL test.",
      status: "draft",
      starts_at: "2099-08-01T18:00:00Z",
      ends_at: "2099-08-01T19:00:00Z",
      max_capacity: 10,
      configured_marketing_mode: "disabled",
      configured_slug_edited: url.edited,
      configured_slug: url.slug,
      configured_pricing_mode: "free",
      configured_price: 0,
      ...(eventId ? {} : { regular_price: 0, member_price: 0 }),
    },
    checkInSessions: [],
    mentorIds: [],
    sponsorIds: [],
    applicationQuestions: [],
  };
}

async function save(fixtures: Fixtures, request: SaveAdminEventInput) {
  const result = await saveAdminEventAction(request);
  if ("error" in result) throw new Error(result.error);
  if (!request.eventId) fixtures.track("events", result.id);
  return { result, event: (await fetchEventById(db, result.id))! };
}

describe("automatic event page URLs", () => {
  it("numbers a second event with the same name and keeps each event's own URL on re-save", () => withFixtures(async fixtures => {
    const name = `Coffee Chat ${fixtures.tag}`;
    const base = `coffee-chat-${fixtures.tag}`;

    const first = await save(fixtures, input(name, { edited: false, slug: base }));
    expect(first.event).toMatchObject({ slug: base, configured_slug: base });

    const second = await save(fixtures, input(name, { edited: false, slug: base }));
    expect(second.event).toMatchObject({ slug: `${base}-1`, configured_slug: `${base}-1` });

    // The form still sends the name's suggestion; the event keeps its own URL.
    const resaved = await save(fixtures, input(name, { edited: false, slug: base }, second.event.id, second.result.revision));
    expect(resaved.event.configured_slug).toBe(`${base}-1`);
    const firstResaved = await save(fixtures, input(name, { edited: false, slug: base }, first.event.id, first.result.revision));
    expect(firstResaved.event.configured_slug).toBe(base);
  }));

  it("numbers both URLs past a URL another event claims only as its configured page", () => withFixtures(async fixtures => {
    const base = `meetup-${fixtures.tag}`;
    await fixtures.createEvent({ slug: `elsewhere-${fixtures.tag}`, configured_slug: base });

    const created = await save(fixtures, input(`Meetup ${fixtures.tag}`, { edited: false, slug: base }));
    expect(created.event).toMatchObject({ slug: `${base}-1`, configured_slug: `${base}-1` });
  }));

  it("refuses a typed URL another event holds", () => withFixtures(async fixtures => {
    const taken = await fixtures.createEvent({ slug: `taken-${fixtures.tag}` });

    await expect(saveAdminEventAction(input(`Typed ${fixtures.tag}`, { edited: true, slug: taken.slug! })))
      .resolves.toEqual({ error: "This page URL is already in use." });
  }));
});
