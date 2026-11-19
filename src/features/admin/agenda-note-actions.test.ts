import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), client: vi.fn(), save: vi.fn(), warn: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireAdmin: mocks.guard }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase-helpers/event-agenda-notes", () => ({ saveAgendaNote: mocks.save }));
vi.mock("@/lib/log", () => ({ log: { warn: mocks.warn } }));
import { saveAgendaNoteAction } from "./agenda-note-actions";

const input = { eventId: "00000000-0000-4000-8000-000000000001", itemId: "00000000-0000-4000-8000-000000000002", body: "  Text\n ", expectedRevision: 0 };
beforeEach(() => { vi.resetAllMocks(); mocks.client.mockResolvedValue({}); });

describe("agenda note action", () => {
  it("denies access before creating a client or touching note data", async () => {
    mocks.guard.mockRejectedValue(new Error("Denied"));
    await expect(saveAgendaNoteAction(input)).rejects.toThrow("Denied");
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("passes text unchanged without a character cap and returns the committed note", async () => {
    const long = { ...input, body: input.body.repeat(10000) };
    const note = { item_id: input.itemId, body: long.body, revision: 1 };
    mocks.save.mockResolvedValue({ ok: true, note });
    expect(await saveAgendaNoteAction(long)).toEqual({ ok: true, note });
    expect(mocks.save).toHaveBeenCalledWith({}, long);
  });
  it("returns the current revision on conflict and offers a retry on server failure", async () => {
    const note = { item_id: input.itemId, body: "Another operator", revision: 2 };
    mocks.save.mockResolvedValue({ ok: false, note });
    expect(await saveAgendaNoteAction(input)).toMatchObject({ ok: false, current: note });
    mocks.save.mockRejectedValue(new Error("Secret row contents"));
    const failed = await saveAgendaNoteAction(input);
    expect(failed).toMatchObject({ ok: false, error: expect.stringContaining("Try saving again") });
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain("Secret row contents");
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain(input.body);
  });
  it("refuses invalid targets and revisions before a database call", async () => {
    for (const bad of [{ eventId: "foreign" }, { itemId: "bad" }, { expectedRevision: -1 }, { expectedRevision: 1.1 }, { body: null }]) {
      expect(await saveAgendaNoteAction({ ...input, ...bad } as typeof input)).toMatchObject({ ok: false });
    }
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
