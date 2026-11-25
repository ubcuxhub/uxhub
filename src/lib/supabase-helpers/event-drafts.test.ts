import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "./types";
import { fetchEventDraft } from "./event-drafts";
import { fetchEventByLegacyDraftId } from "./events";

describe("draft lookups by id or legacy draft id", () => {
  it.each([
    ["fetchEventDraft", fetchEventDraft],
    ["fetchEventByLegacyDraftId", fetchEventByLegacyDraftId],
  ] as const)("%s never builds an .or() filter from a non-UUID", async (_name, lookup) => {
    const client = { from: vi.fn() } as unknown as DbClient;
    // Filter syntax appended to the id would widen the service-role query.
    await expect(lookup(client, "x,slug.neq.null")).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });
});
