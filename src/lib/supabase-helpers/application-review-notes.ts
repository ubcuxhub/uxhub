import type {
  ReviewerNote,
  ReviewerNoteAuthor,
} from "@/features/applications/components/ReviewerNotes";

import { BUCKETS } from "./buckets";
import { TABLES } from "./tables";
import type { DbClient } from "./types";
import { formatUserName } from "@/lib/user-name";

export type { ReviewerNote, ReviewerNoteAuthor };

/**
 * Reviewer notes on an application (docs/design/application-review.md §5–6).
 *
 * RLS does the gatekeeping: through a signed-in client, only admins and
 * managers read notes, never on a draft, and each changes only their own. A
 * write the policies refuse matches no row rather than raising, so the
 * mutations below return null or false for it, and the caller decides what to
 * say.
 */

const NOTE_COLUMNS =
  "id, body, created_at, edited_at, " +
  "author:user_info!application_review_notes_author_id_fkey(id, first_name, last_name, profile_photo_path, deleted_at)";

/** An `.in()` filter travels in the URL, so long id lists go a chunk at a time. */
const IN_CHUNK = 50;

interface NoteRow {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author: {
    id: string;
    first_name: string;
    last_name: string;
    profile_photo_path: string | null;
    deleted_at: string | null;
  } | null;
}

function toAuthor(supabase: DbClient, row: NoteRow): ReviewerNoteAuthor {
  const author = row.author;
  // Admins read every profile, so a missing author means the reader can't see
  // it; show it the way a deleted account shows rather than guess a name.
  if (!author) return { id: "", name: "", avatarUrl: null, deleted: true };
  if (author.deleted_at) {
    return { id: author.id, name: "", avatarUrl: null, deleted: true };
  }
  return {
    id: author.id,
    name: formatUserName(author),
    avatarUrl: author.profile_photo_path
      ? supabase.storage
          .from(BUCKETS.profilePhotos)
          .getPublicUrl(author.profile_photo_path).data.publicUrl
      : null,
    deleted: false,
  };
}

function toNote(supabase: DbClient, row: NoteRow): ReviewerNote {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    author: toAuthor(supabase, row),
  };
}

/** One application's notes, oldest first, each with its author. */
export async function fetchReviewerNotes(
  supabase: DbClient,
  applicationId: string
): Promise<ReviewerNote[]> {
  const { data, error } = await supabase
    .from(TABLES.applicationReviewNotes)
    .select(NOTE_COLUMNS)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as NoteRow[]).map((row) => toNote(supabase, row));
}

/**
 * How many notes each application has, for the review list. An application
 * with none is absent: read a missing id as 0.
 */
export async function fetchReviewerNoteCounts(
  supabase: DbClient,
  applicationIds: readonly string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const ids = [...new Set(applicationIds)];

  for (let start = 0; start < ids.length; start += IN_CHUNK) {
    const { data, error } = await supabase
      .from(TABLES.applicationReviewNotes)
      .select("application_id")
      .in("application_id", ids.slice(start, start + IN_CHUNK));

    if (error) throw error;
    for (const row of data ?? []) {
      counts[row.application_id] = (counts[row.application_id] ?? 0) + 1;
    }
  }

  return counts;
}

/**
 * Adds a note as `authorId` (a `user_info` id). Through a signed-in client the
 * insert policy holds `authorId` to the caller and refuses a draft, which
 * surfaces as a thrown row-level security error.
 */
export async function insertReviewerNote(
  supabase: DbClient,
  input: { applicationId: string; authorId: string; body: string }
): Promise<ReviewerNote> {
  const { data, error } = await supabase
    .from(TABLES.applicationReviewNotes)
    .insert({
      application_id: input.applicationId,
      author_id: input.authorId,
      body: input.body,
    })
    .select(NOTE_COLUMNS)
    .single();

  if (error) throw error;
  return toNote(supabase, data as unknown as NoteRow);
}

/**
 * Replaces a note's text. Returns null when no note was changed: it doesn't
 * exist, or it isn't the caller's. The database moves `edited_at` only when the
 * text really changed.
 */
export async function updateReviewerNoteBody(
  supabase: DbClient,
  noteId: string,
  body: string
): Promise<ReviewerNote | null> {
  const { data, error } = await supabase
    .from(TABLES.applicationReviewNotes)
    .update({ body })
    .eq("id", noteId)
    .select(NOTE_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return data ? toNote(supabase, data as unknown as NoteRow) : null;
}

/**
 * Deletes a note for good. Returns false when nothing was deleted: it doesn't
 * exist, or it isn't the caller's.
 */
export async function deleteReviewerNote(
  supabase: DbClient,
  noteId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLES.applicationReviewNotes)
    .delete()
    .eq("id", noteId)
    .select("id");

  if (error) throw error;
  return (data ?? []).length > 0;
}
