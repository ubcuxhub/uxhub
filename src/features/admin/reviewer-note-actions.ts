"use server";

import { revalidatePath } from "next/cache";

import type { ReviewerNote } from "@/features/applications/components/ReviewerNotes";
import { requireAdmin } from "@/lib/auth/guards";
import { errorFields, log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import {
  deleteReviewerNote as deleteNote,
  insertReviewerNote,
  updateReviewerNoteBody,
} from "@/lib/supabase-helpers/application-review-notes";
import { isUuid } from "@/lib/uuid";

/**
 * Reviewer notes: post, edit and delete (docs/design/application-review.md §5).
 *
 * Each action runs as the signed-in admin's own client, so RLS has the last
 * word: a note on a draft can't be added, and only its author can change or
 * delete a note. Every failure throws, which `ReviewerNotes` turns into its
 * inline error with the text kept. A production server action hides a thrown
 * message, so the messages are for logs and tests, not for the page.
 *
 * Failures are logged at `warn` (a refusal is expected, not an outage) with
 * ids only, never the note's text.
 */

/**
 * NOTE_MAX_LENGTH in ReviewerNotes.tsx and the table's check constraint.
 * Repeated rather than imported: a value from a "use client" module is a
 * client reference on the server, not the number.
 */
const NOTE_MAX_LENGTH = 2000;

const REVIEW_LIST_ROUTE = "/admin/events/[event]/review-applications";
const REVIEW_APPLICATION_ROUTE =
  "/admin/events/[event]/review-applications/[applicationId]";

function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || !isUuid(value)) {
    throw new Error(`A valid ${label} is required.`);
  }
  return value;
}

/** Trims the note; refuses an empty one or one over the limit. */
function requireBody(value: unknown): string {
  if (typeof value !== "string") throw new Error("Write a note first.");
  const body = value.trim();
  if (!body) throw new Error("Write a note first.");
  // The database counts characters (code points), not UTF-16 units.
  if ([...body].length > NOTE_MAX_LENGTH) {
    throw new Error(`Keep notes to ${NOTE_MAX_LENGTH} characters.`);
  }
  return body;
}

function revalidateReviewPages() {
  revalidatePath(REVIEW_LIST_ROUTE, "page");
  revalidatePath(REVIEW_APPLICATION_ROUTE, "page");
}

export async function addReviewerNote(input: {
  applicationId: string;
  body: string;
}): Promise<ReviewerNote> {
  const user = await requireAdmin();
  const applicationId = requireId(input?.applicationId, "application id");
  const body = requireBody(input?.body);

  let note: ReviewerNote;
  try {
    const supabase = await createClient();
    note = await insertReviewerNote(supabase, {
      applicationId,
      authorId: user.id,
      body,
    });
  } catch (error) {
    log.warn("admin.reviewer_note_add_failed", {
      applicationId,
      userId: user.id,
      ...errorFields(error),
    });
    throw new Error("Couldn’t post the note.");
  }

  revalidateReviewPages();
  return note;
}

export async function editReviewerNote(input: {
  noteId: string;
  body: string;
}): Promise<ReviewerNote> {
  const user = await requireAdmin();
  const noteId = requireId(input?.noteId, "note id");
  const body = requireBody(input?.body);

  let note: ReviewerNote | null;
  try {
    const supabase = await createClient();
    note = await updateReviewerNoteBody(supabase, noteId, body);
  } catch (error) {
    log.warn("admin.reviewer_note_edit_failed", {
      noteId,
      userId: user.id,
      ...errorFields(error),
    });
    throw new Error("Couldn’t save the note.");
  }

  if (!note) {
    // Gone, or somebody else's: RLS matched no row.
    log.warn("admin.reviewer_note_edit_refused", { noteId, userId: user.id });
    throw new Error("This note no longer exists, or isn’t yours to edit.");
  }

  revalidateReviewPages();
  return note;
}

export async function deleteReviewerNote(input: { noteId: string }): Promise<void> {
  const user = await requireAdmin();
  const noteId = requireId(input?.noteId, "note id");

  let deleted: boolean;
  try {
    const supabase = await createClient();
    deleted = await deleteNote(supabase, noteId);
  } catch (error) {
    log.warn("admin.reviewer_note_delete_failed", {
      noteId,
      userId: user.id,
      ...errorFields(error),
    });
    throw new Error("Couldn’t delete the note.");
  }

  if (!deleted) {
    log.warn("admin.reviewer_note_delete_refused", { noteId, userId: user.id });
    throw new Error("This note no longer exists, or isn’t yours to delete.");
  }

  revalidateReviewPages();
}
