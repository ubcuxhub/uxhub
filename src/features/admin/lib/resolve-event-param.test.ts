import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/lib/supabase-helpers/types";
import { resolveAdminEventId } from "./resolve-event-param";

const EVENT_ID = "123e4567-e89b-12d3-a456-426614174000";

const mocks = vi.hoisted(() => ({
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
  fetchEventBySlug: mocks.fetchEventBySlug,
}));

const supabase = {} as DbClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveAdminEventId", () => {
  it("returns a UUID unchanged without querying", async () => {
    await expect(resolveAdminEventId(supabase, EVENT_ID)).resolves.toBe(
      EVENT_ID
    );
    expect(mocks.fetchEventBySlug).not.toHaveBeenCalled();
  });

  it("redirects a matching slug to the ID, keeping the rest of the path", async () => {
    mocks.fetchEventBySlug.mockResolvedValue({ id: EVENT_ID });

    await expect(
      resolveAdminEventId(supabase, "uxathon-2026", "/check-in")
    ).rejects.toThrow(`NEXT_REDIRECT /admin/events/${EVENT_ID}/check-in`);
    // No status option: drafts must resolve too.
    expect(mocks.fetchEventBySlug).toHaveBeenCalledWith(
      supabase,
      "uxathon-2026"
    );
  });

  it("redirects to the bare event path when there is no suffix", async () => {
    mocks.fetchEventBySlug.mockResolvedValue({ id: EVENT_ID });

    await expect(resolveAdminEventId(supabase, "uxathon-2026")).rejects.toThrow(
      `NEXT_REDIRECT /admin/events/${EVENT_ID}`
    );
  });

  it("404s when no event has the slug", async () => {
    mocks.fetchEventBySlug.mockResolvedValue(null);

    await expect(
      resolveAdminEventId(supabase, "nope", "/check-in")
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
