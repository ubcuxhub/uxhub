import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewerNote } from "@/features/applications/components/ReviewerNotes";
import type { UserInfoRow } from "@/lib/supabase/models";

vi.mock("server-only", () => ({}));

const APPLICATION_ID = "123e4567-e89b-12d3-a456-426614174000";
const NOTE_ID = "223e4567-e89b-12d3-a456-426614174000";
const SECRET = "Their portfolio was the strongest this round.";

const guards = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const notes = vi.hoisted(() => ({
  insertReviewerNote: vi.fn(),
  updateReviewerNoteBody: vi.fn(),
  deleteReviewerNote: vi.fn(),
}));
const revalidatePath = vi.hoisted(() => vi.fn());
const log = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
const sessionClient = vi.hoisted(() => ({ client: "session" }));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/guards", () => guards);
vi.mock("@/lib/supabase-helpers/application-review-notes", () => notes);
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => sessionClient) }));
vi.mock("@/lib/log", () => ({ log, errorFields: () => ({ errorType: "SupabaseError" }) }));

import {
  addReviewerNote,
  deleteReviewerNote,
  editReviewerNote,
} from "./reviewer-note-actions";

const admin = { id: "admin-1", role_access: "admin" } as UserInfoRow;

function note(overrides: Partial<ReviewerNote> = {}): ReviewerNote {
  return {
    id: NOTE_ID,
    body: SECRET,
    createdAt: "2026-11-09T18:00:00.000Z",
    editedAt: null,
    author: { id: admin.id, name: "Ada Admin", avatarUrl: null, deleted: false },
    ...overrides,
  };
}

/** No log line may carry the note's text. */
function expectNoBodyInLogs() {
  for (const call of [...log.warn.mock.calls, ...log.error.mock.calls]) {
    expect(JSON.stringify(call)).not.toContain("portfolio");
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  guards.requireAdmin.mockResolvedValue(admin);
});

describe("addReviewerNote", () => {
  it("posts the trimmed text as the signed-in admin and refreshes the review pages", async () => {
    notes.insertReviewerNote.mockResolvedValue(note());

    await expect(
      addReviewerNote({ applicationId: APPLICATION_ID, body: `  ${SECRET}\n\n` })
    ).resolves.toEqual(note());

    expect(notes.insertReviewerNote).toHaveBeenCalledWith(sessionClient, {
      applicationId: APPLICATION_ID,
      authorId: admin.id,
      body: SECRET,
    });
    expect(revalidatePath).toHaveBeenCalledWith(
      "/admin/events/[event]/review-applications",
      "page"
    );
    expect(revalidatePath).toHaveBeenCalledWith(
      "/admin/events/[event]/review-applications/[applicationId]",
      "page"
    );
  });

  it("keeps line breaks inside the note", async () => {
    notes.insertReviewerNote.mockResolvedValue(note());
    await addReviewerNote({ applicationId: APPLICATION_ID, body: "One.\n\nTwo." });
    expect(notes.insertReviewerNote.mock.calls[0][1].body).toBe("One.\n\nTwo.");
  });

  it.each([
    ["empty", ""],
    ["whitespace", " \n\t "],
    ["over the limit", "a".repeat(2001)],
    ["not text", 42],
  ])("refuses a note that is %s", async (_, body) => {
    await expect(
      addReviewerNote({ applicationId: APPLICATION_ID, body: body as string })
    ).rejects.toThrow();
    expect(notes.insertReviewerNote).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("allows exactly 2000 characters, counted as the database counts them", async () => {
    notes.insertReviewerNote.mockResolvedValue(note());
    await addReviewerNote({ applicationId: APPLICATION_ID, body: "a".repeat(2000) });
    // Each emoji is two UTF-16 units but one character.
    await addReviewerNote({ applicationId: APPLICATION_ID, body: "🙂".repeat(2000) });
    expect(notes.insertReviewerNote).toHaveBeenCalledTimes(2);
  });

  it.each([["not-a-uuid"], [""], [undefined]])(
    "refuses application id %s",
    async (applicationId) => {
      await expect(
        addReviewerNote({ applicationId: applicationId as string, body: SECRET })
      ).rejects.toThrow("application id");
      expect(notes.insertReviewerNote).not.toHaveBeenCalled();
    }
  );

  it("stops at the admin guard", async () => {
    guards.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      addReviewerNote({ applicationId: APPLICATION_ID, body: SECRET })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(notes.insertReviewerNote).not.toHaveBeenCalled();
  });

  it("throws and logs ids, not the text, when the database refuses", async () => {
    notes.insertReviewerNote.mockRejectedValue({ code: "42501", message: SECRET });

    await expect(
      addReviewerNote({ applicationId: APPLICATION_ID, body: SECRET })
    ).rejects.toThrow("Couldn’t post the note.");

    expect(log.warn).toHaveBeenCalledWith("admin.reviewer_note_add_failed", {
      applicationId: APPLICATION_ID,
      userId: admin.id,
      errorType: "SupabaseError",
    });
    expect(log.error).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expectNoBodyInLogs();
  });
});

describe("editReviewerNote", () => {
  it("saves the trimmed text and returns the note", async () => {
    const edited = note({ body: "Better.", editedAt: "2026-11-09T19:00:00.000Z" });
    notes.updateReviewerNoteBody.mockResolvedValue(edited);

    await expect(editReviewerNote({ noteId: NOTE_ID, body: " Better. " })).resolves.toEqual(
      edited
    );
    expect(notes.updateReviewerNoteBody).toHaveBeenCalledWith(sessionClient, NOTE_ID, "Better.");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("throws when the note is gone or someone else's", async () => {
    notes.updateReviewerNoteBody.mockResolvedValue(null);

    await expect(editReviewerNote({ noteId: NOTE_ID, body: SECRET })).rejects.toThrow(
      "isn’t yours to edit"
    );
    expect(log.warn).toHaveBeenCalledWith("admin.reviewer_note_edit_refused", {
      noteId: NOTE_ID,
      userId: admin.id,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expectNoBodyInLogs();
  });

  it("throws when the database fails", async () => {
    notes.updateReviewerNoteBody.mockRejectedValue(new Error(SECRET));
    await expect(editReviewerNote({ noteId: NOTE_ID, body: SECRET })).rejects.toThrow(
      "Couldn’t save the note."
    );
    expect(log.warn).toHaveBeenCalledWith(
      "admin.reviewer_note_edit_failed",
      expect.objectContaining({ noteId: NOTE_ID })
    );
    expectNoBodyInLogs();
  });

  it("validates before writing", async () => {
    await expect(editReviewerNote({ noteId: "nope", body: SECRET })).rejects.toThrow("note id");
    await expect(editReviewerNote({ noteId: NOTE_ID, body: "   " })).rejects.toThrow();
    expect(notes.updateReviewerNoteBody).not.toHaveBeenCalled();
  });
});

describe("deleteReviewerNote", () => {
  it("deletes the note and refreshes the review pages", async () => {
    notes.deleteReviewerNote.mockResolvedValue(true);

    await expect(deleteReviewerNote({ noteId: NOTE_ID })).resolves.toBeUndefined();
    expect(notes.deleteReviewerNote).toHaveBeenCalledWith(sessionClient, NOTE_ID);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("throws when nothing was deleted", async () => {
    notes.deleteReviewerNote.mockResolvedValue(false);

    await expect(deleteReviewerNote({ noteId: NOTE_ID })).rejects.toThrow(
      "isn’t yours to delete"
    );
    expect(log.warn).toHaveBeenCalledWith("admin.reviewer_note_delete_refused", {
      noteId: NOTE_ID,
      userId: admin.id,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws when the database fails", async () => {
    notes.deleteReviewerNote.mockRejectedValue({ code: "XX000" });
    await expect(deleteReviewerNote({ noteId: NOTE_ID })).rejects.toThrow(
      "Couldn’t delete the note."
    );
    expect(log.warn).toHaveBeenCalledWith(
      "admin.reviewer_note_delete_failed",
      expect.objectContaining({ noteId: NOTE_ID })
    );
  });

  it("refuses a malformed id", async () => {
    await expect(deleteReviewerNote({ noteId: "1; drop table" })).rejects.toThrow("note id");
    expect(notes.deleteReviewerNote).not.toHaveBeenCalled();
  });
});
