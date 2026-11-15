import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/supabase/models";
import type { DbClient } from "@/lib/supabase-helpers/types";
import {
  findAdminEvent,
  querySuffix,
  resolveAdminEvent,
} from "./resolve-event-param";

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";
const SLUG = "uxathon-2026";

const mocks = vi.hoisted(() => ({
  fetchEventById: vi.fn(),
  fetchEventBySlug: vi.fn(),
  // The real redirect() and notFound() throw; a mock that returned would let
  // execution run past them and hide the bug these tests exist to catch.
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT ${destination}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));

vi.mock("@/lib/supabase-helpers/events", () => ({
  fetchEventById: mocks.fetchEventById,
  fetchEventBySlug: mocks.fetchEventBySlug,
}));

const supabase = {} as DbClient;

function event(overrides: Partial<EventRow> = {}) {
  return { id: EVENT_ID, slug: SLUG, status: "draft", ...overrides } as EventRow;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchEventById.mockResolvedValue(null);
  mocks.fetchEventBySlug.mockResolvedValue(null);
});

describe("resolveAdminEvent", () => {
  it("returns the event a slug names, without an ID query", async () => {
    mocks.fetchEventBySlug.mockResolvedValue(event());

    await expect(resolveAdminEvent(supabase, SLUG, "/edit")).resolves.toEqual(event());
    // No status option: drafts must resolve too.
    expect(mocks.fetchEventBySlug).toHaveBeenCalledWith(supabase, SLUG);
    expect(mocks.fetchEventById).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects an event ID to its slug, keeping the rest of the path", async () => {
    mocks.fetchEventById.mockResolvedValue(event());

    await expect(
      resolveAdminEvent(supabase, EVENT_ID, "/check-in")
    ).rejects.toThrow(`NEXT_REDIRECT /admin/events/${SLUG}/check-in`);
    expect(mocks.fetchEventById).toHaveBeenCalledWith(supabase, EVENT_ID);
  });

  it("redirects an ID to the bare slug path when there is no suffix", async () => {
    mocks.fetchEventById.mockResolvedValue(event());

    await expect(resolveAdminEvent(supabase, EVENT_ID)).rejects.toThrow(
      `NEXT_REDIRECT /admin/events/${SLUG}`
    );
  });

  it("keeps the builder's /edit suffix and a query string on an ID redirect", async () => {
    mocks.fetchEventById.mockResolvedValue(event());

    await expect(
      resolveAdminEvent(supabase, EVENT_ID, "/edit")
    ).rejects.toThrow(`NEXT_REDIRECT /admin/events/${SLUG}/edit`);
    await expect(
      resolveAdminEvent(supabase, EVENT_ID, "/review-applications?status=submitted")
    ).rejects.toThrow(
      `NEXT_REDIRECT /admin/events/${SLUG}/review-applications?status=submitted`
    );
  });

  it("serves an event whose slug is a reserved route name by its ID", async () => {
    const reserved = event({ slug: "drafts" });
    mocks.fetchEventById.mockResolvedValue(reserved);

    await expect(resolveAdminEvent(supabase, EVENT_ID, "/edit")).resolves.toBe(reserved);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("treats a UUID-shaped param that is no event's ID as a slug", async () => {
    const odd = event({ slug: EVENT_ID, id: "00000000-0000-4000-8000-000000000000" });
    mocks.fetchEventBySlug.mockResolvedValue(odd);

    await expect(resolveAdminEvent(supabase, EVENT_ID)).resolves.toBe(odd);
    expect(mocks.fetchEventBySlug).toHaveBeenCalledWith(supabase, EVENT_ID);
  });

  it("404s when no event has the slug, without querying it as an ID", async () => {
    await expect(
      resolveAdminEvent(supabase, "nope", "/check-in")
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.fetchEventById).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("404s when no event has the ID", async () => {
    await expect(resolveAdminEvent(supabase, EVENT_ID)).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("findAdminEvent", () => {
  it("returns the event a slug names", async () => {
    mocks.fetchEventBySlug.mockResolvedValue(event());

    await expect(findAdminEvent(supabase, SLUG)).resolves.toEqual(event());
  });

  it("redirects an ID like resolveAdminEvent", async () => {
    mocks.fetchEventById.mockResolvedValue(event());

    await expect(findAdminEvent(supabase, EVENT_ID)).rejects.toThrow(
      `NEXT_REDIRECT /admin/events/${SLUG}`
    );
  });

  it("returns null instead of a 404 when nothing matches", async () => {
    await expect(findAdminEvent(supabase, "nope")).resolves.toBeNull();
    await expect(findAdminEvent(supabase, EVENT_ID)).resolves.toBeNull();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("querySuffix", () => {
  it("serializes search params, repeating array values", () => {
    expect(querySuffix({ status: "submitted", tag: ["a", "b"], gone: undefined })).toBe(
      "?status=submitted&tag=a&tag=b"
    );
  });

  it("is empty without params", () => {
    expect(querySuffix({})).toBe("");
  });
});
