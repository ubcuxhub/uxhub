import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { UserInfoRow } from "@/lib/supabase/models";
import { clientAs, withFixtures, type Fixtures, type IntegrationClient } from "@/test/integration";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({
  user: null as UserInfoRow | null,
  client: null as IntegrationClient | null,
}));
vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: vi.fn(async () => session.user),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => session.client),
}));

import {
  addReviewerNote,
  deleteReviewerNote,
  editReviewerNote,
} from "@/features/admin/reviewer-note-actions";
import {
  fetchReviewerNoteCounts,
  fetchReviewerNotes,
  insertReviewerNote,
} from "./application-review-notes";

/** An application on `eventId` from a fresh member. */
async function apply(
  fixtures: Fixtures,
  eventId: string,
  status: "submitted" | "draft" = "submitted"
) {
  const applicant = await fixtures.createUser();
  const { data, error } = await fixtures.supabase
    .from("event_applications")
    .insert({ event_id: eventId, user_id: applicant.id, status })
    .select("id")
    .single();
  if (error) throw error;
  fixtures.track("event_applications", data.id);
  return { applicant, applicationId: data.id };
}

/** Writes a note as the service role, with a fixed time when given. */
async function seedNote(
  fixtures: Fixtures,
  applicationId: string,
  authorId: string,
  body: string,
  createdAt?: string
) {
  const { data, error } = await fixtures.supabase
    .from("application_review_notes")
    .insert({ application_id: applicationId, author_id: authorId, body, created_at: createdAt })
    .select("id")
    .single();
  if (error) throw error;
  return fixtures.track("application_review_notes", data.id);
}

function actAs(user: UserInfoRow) {
  session.user = user;
  session.client = clientAs(user);
}

describe("fetchReviewerNotes", () => {
  it("reads one application's notes oldest first, with their authors", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ requires_application: true });
      const { applicant, applicationId } = await apply(fixtures, event.id);
      const other = await apply(fixtures, event.id);
      const reader = await fixtures.createUser({ role_access: "admin" });
      const pictured = await fixtures.createUser({
        role_access: "manager",
        first_name: "Pat",
        last_name: "Pictured",
      });
      const photoPath = `profiles/${pictured.id}/${randomUUID()}.png`;
      const { error: photoError } = await fixtures.supabase
        .from("user_info")
        .update({ profile_photo_path: photoPath })
        .eq("id", pictured.id);
      if (photoError) throw photoError;
      const leaver = await fixtures.createUser({ role_access: "admin" });

      // Written out of order, so the read has to sort.
      const second = await seedNote(fixtures, applicationId, pictured.id, "Second.\nTwo lines.", "2026-11-02T10:00:00.000Z");
      const first = await seedNote(fixtures, applicationId, leaver.id, "First.", "2026-11-01T10:00:00.000Z");
      const third = await seedNote(fixtures, applicationId, reader.id, "Third.", "2026-11-03T10:00:00.000Z");
      await seedNote(fixtures, other.applicationId, reader.id, "Elsewhere.");

      // Accounts are anonymised, not removed: the note stays as "Deleted user".
      const { error: deleteError } = await fixtures.supabase.rpc("delete_account", {
        p_auth_user_id: leaver.auth_user_id!,
      });
      if (deleteError) throw deleteError;

      const notes = await fetchReviewerNotes(clientAs(reader), applicationId);
      expect(notes.map((note) => note.id)).toEqual([first, second, third]);
      expect(notes[0]).toEqual({
        id: first,
        body: "First.",
        createdAt: expect.any(String),
        editedAt: null,
        author: { id: leaver.id, name: "", avatarUrl: null, deleted: true },
      });
      expect(new Date(notes[0].createdAt).toISOString()).toBe("2026-11-01T10:00:00.000Z");
      expect(notes[1].body).toBe("Second.\nTwo lines.");
      expect(notes[1].author).toMatchObject({ id: pictured.id, name: "Pat Pictured", deleted: false });
      expect(notes[1].author.avatarUrl).toContain(`profile-photos/${photoPath}`);
      expect(notes[2].author).toEqual({
        id: reader.id,
        name: "Integration Test",
        avatarUrl: null,
        deleted: false,
      });

      // Applicants never see the thread, not even on their own application.
      expect(await fetchReviewerNotes(clientAs(applicant), applicationId)).toEqual([]);
      expect(await fetchReviewerNotes(clientAs(null), applicationId).catch(() => "refused")).toBe(
        "refused"
      );
    }));

  it("hides notes on a draft, even from admins", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ requires_application: true });
      const { applicationId } = await apply(fixtures, event.id, "draft");
      const admin = await fixtures.createUser({ role_access: "admin" });
      await seedNote(fixtures, applicationId, admin.id, "Too early.");

      expect(await fetchReviewerNotes(clientAs(admin), applicationId)).toEqual([]);
    }));
});

describe("fetchReviewerNoteCounts", () => {
  it("counts notes per application; an application without notes is absent", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ requires_application: true });
      const busy = await apply(fixtures, event.id);
      const quiet = await apply(fixtures, event.id);
      const draft = await apply(fixtures, event.id, "draft");
      const admin = await fixtures.createUser({ role_access: "admin" });
      await seedNote(fixtures, busy.applicationId, admin.id, "One.");
      await seedNote(fixtures, busy.applicationId, admin.id, "Two.");
      await seedNote(fixtures, draft.applicationId, admin.id, "Hidden.");

      const counts = await fetchReviewerNoteCounts(clientAs(admin), [
        busy.applicationId,
        quiet.applicationId,
        draft.applicationId,
        busy.applicationId,
      ]);
      expect(counts).toEqual({ [busy.applicationId]: 2 });
      expect(counts[quiet.applicationId] ?? 0).toBe(0);

      const member = await fixtures.createUser();
      expect(await fetchReviewerNoteCounts(clientAs(member), [busy.applicationId])).toEqual({});
      expect(await fetchReviewerNoteCounts(clientAs(admin), [])).toEqual({});
    }));
});

describe("insertReviewerNote", () => {
  it("refuses a note posted under another admin's name", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ requires_application: true });
      const { applicationId } = await apply(fixtures, event.id);
      const admin = await fixtures.createUser({ role_access: "admin" });
      const other = await fixtures.createUser({ role_access: "admin" });

      await expect(
        insertReviewerNote(clientAs(admin), { applicationId, authorId: other.id, body: "Spoofed." })
      ).rejects.toMatchObject({ code: "42501" });
    }));
});

describe("reviewer note actions", () => {
  it("post, edit and delete a note through the admin's own session", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ requires_application: true });
      const { applicationId } = await apply(fixtures, event.id);
      const admin = await fixtures.createUser({
        role_access: "admin",
        first_name: "Ada",
        last_name: "Admin",
      });
      actAs(admin);

      const posted = await addReviewerNote({ applicationId, body: "  Clear thinking.  " });
      fixtures.track("application_review_notes", posted.id);
      expect(posted).toMatchObject({
        body: "Clear thinking.",
        editedAt: null,
        author: { id: admin.id, name: "Ada Admin", deleted: false },
      });

      // Saving the same text leaves the note unedited.
      const unchanged = await editReviewerNote({ noteId: posted.id, body: "Clear thinking." });
      expect(unchanged.editedAt).toBeNull();

      const edited = await editReviewerNote({ noteId: posted.id, body: "Clear thinking, kind tone." });
      expect(edited).toMatchObject({ id: posted.id, body: "Clear thinking, kind tone." });
      expect(edited.editedAt).not.toBeNull();
      expect(new Date(edited.createdAt).getTime()).toBe(new Date(posted.createdAt).getTime());

      expect((await fetchReviewerNotes(clientAs(admin), applicationId)).map((note) => note.id)).toEqual([
        posted.id,
      ]);

      await deleteReviewerNote({ noteId: posted.id });
      expect(await fetchReviewerNotes(clientAs(admin), applicationId)).toEqual([]);

      // Deleting it again finds nothing to delete.
      await expect(deleteReviewerNote({ noteId: posted.id })).rejects.toThrow();
    }));

  it("refuse another admin's note and a draft", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ requires_application: true });
      const { applicationId } = await apply(fixtures, event.id);
      const draft = await apply(fixtures, event.id, "draft");
      const author = await fixtures.createUser({ role_access: "admin" });
      const other = await fixtures.createUser({ role_access: "manager" });
      const noteId = await seedNote(fixtures, applicationId, author.id, "Mine.");

      actAs(other);
      await expect(editReviewerNote({ noteId, body: "Yours now." })).rejects.toThrow();
      await expect(deleteReviewerNote({ noteId })).rejects.toThrow();
      await expect(
        addReviewerNote({ applicationId: draft.applicationId, body: "Too early." })
      ).rejects.toThrow();

      const [kept] = await fetchReviewerNotes(clientAs(author), applicationId);
      expect(kept).toMatchObject({ id: noteId, body: "Mine.", editedAt: null });
    }));

  it("leave a demoted admin's notes in place but out of their reach", () =>
    withFixtures(async (fixtures) => {
      const event = await fixtures.createEvent({ requires_application: true });
      const { applicationId } = await apply(fixtures, event.id);
      const demoted = await fixtures.createUser({ role_access: "admin" });
      const colleague = await fixtures.createUser({ role_access: "admin" });
      const noteId = await seedNote(fixtures, applicationId, demoted.id, "Before.");
      const { error } = await fixtures.supabase
        .from("user_info")
        .update({ role_access: "basic" })
        .eq("id", demoted.id);
      if (error) throw error;

      expect(await fetchReviewerNotes(clientAs(demoted), applicationId)).toEqual([]);
      // The guard would stop them first; the database stops them anyway.
      actAs({ ...demoted, role_access: "basic" });
      await expect(editReviewerNote({ noteId, body: "After." })).rejects.toThrow();

      const [note] = await fetchReviewerNotes(clientAs(colleague), applicationId);
      expect(note).toMatchObject({ id: noteId, body: "Before.", author: { id: demoted.id } });
    }));
});
