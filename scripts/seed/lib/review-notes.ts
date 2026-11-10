import type { SupabaseClient } from "@supabase/supabase-js";

import { FORMER_REVIEWER, type SeedReviewNote } from "../data/review-notes.ts";
import type { SeedUser } from "../data/users.ts";
import { afterTimestamp } from "../data/users.ts";
import { planPrune } from "./prune.ts";
import { emptyCounts, type Counts } from "./reconcile.ts";

const TABLE = {
  events: "events",
  eventApplications: "event_applications",
  reviewNotes: "application_review_notes",
  userInfo: "user_info",
} as const;

/** NOTE_MAX_LENGTH in src/features/applications/components/ReviewerNotes.tsx. */
const NOTE_MAX_LENGTH = 2000;

const IN_CHUNK = 40;

/** A seed note with its times worked out. */
export interface ResolvedReviewNote {
  applicantEmail: string;
  eventSlug: string;
  authorEmail: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

/**
 * Works out each note's times and checks it against the fixtures, before
 * anything is written: the application must exist past draft (admins never see
 * drafts, and the database refuses notes on them), the author must be an admin
 * login fixture or the former reviewer, and nothing may be dated after `now`.
 */
export function resolveSeedReviewNotes(
  notes: readonly SeedReviewNote[],
  users: readonly SeedUser[],
  now: Date
): ResolvedReviewNote[] {
  const usersByEmail = new Map(users.map((user) => [user.email, user]));

  return notes.map((note) => {
    const label = `Reviewer note by ${note.authorEmail} on ${note.applicantEmail}/${note.eventSlug}`;

    const application = usersByEmail
      .get(note.applicantEmail)
      ?.registrations.find((registration) => registration.eventSlug === note.eventSlug)
      ?.application;
    if (!application) throw new Error(`${label}: no such application`);
    if (application.status === "draft" || !application.submittedAt) {
      throw new Error(`${label}: notes can't go on a draft`);
    }

    if (note.authorEmail !== FORMER_REVIEWER.email) {
      const author = usersByEmail.get(note.authorEmail);
      const role = author?.profile.role_access;
      if (!author || author.password === null || (role !== "admin" && role !== "manager")) {
        throw new Error(`${label}: the author must be an admin login fixture`);
      }
    }

    const body = note.body.trim();
    if (body !== note.body || body.length === 0 || [...body].length > NOTE_MAX_LENGTH) {
      throw new Error(`${label}: the text must be trimmed and 1-${NOTE_MAX_LENGTH} characters`);
    }

    const createdAt = afterTimestamp(application.submittedAt, note.minutesAfterSubmission);
    const editedAt =
      note.editedMinutesLater === undefined
        ? null
        : afterTimestamp(createdAt, note.editedMinutesLater);
    if (note.minutesAfterSubmission < 0 || (note.editedMinutesLater ?? 0) < 0) {
      throw new Error(`${label}: times must move forwards`);
    }
    if (new Date(editedAt ?? createdAt) > now) {
      throw new Error(`${label}: dated after the run`);
    }

    return {
      applicantEmail: note.applicantEmail,
      eventSlug: note.eventSlug,
      authorEmail: note.authorEmail,
      body,
      createdAt,
      editedAt,
    };
  });
}

interface NoteRow {
  id: string;
  application_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
}

function timeKey(value: string | null): string {
  return value === null ? "" : String(new Date(value).getTime());
}

function noteKey(applicationId: string, authorId: string, createdAt: string): string {
  return [applicationId, authorId, timeKey(createdAt)].join("\u0000");
}

async function selectNotesBy(
  supabase: SupabaseClient,
  authorIds: string[]
): Promise<NoteRow[]> {
  const rows: NoteRow[] = [];
  for (let start = 0; start < authorIds.length; start += IN_CHUNK) {
    const { data, error } = await supabase
      .from(TABLE.reviewNotes)
      .select("id, application_id, author_id, body, created_at, edited_at")
      .in("author_id", authorIds.slice(start, start + IN_CHUNK));
    if (error) throw new Error(`Reading reviewer notes failed: ${error.message}`);
    rows.push(...((data ?? []) as NoteRow[]));
  }
  return rows;
}

async function deleteNotes(supabase: SupabaseClient, ids: string[], label: string) {
  for (let start = 0; start < ids.length; start += IN_CHUNK) {
    const { error } = await supabase
      .from(TABLE.reviewNotes)
      .delete()
      .in("id", ids.slice(start, start + IN_CHUNK));
    if (error) throw new Error(`Deleting ${label} failed: ${error.message}`);
  }
}

/**
 * The former reviewer's profile, made or put back to the shape
 * `delete_account` leaves. Returns its id, or null on a dry run that would
 * create it.
 */
async function reconcileFormerReviewer(
  supabase: SupabaseClient,
  dryRun: boolean
): Promise<{ id: string | null; counts: Counts }> {
  const counts = emptyCounts();
  const { data, error } = await supabase
    .from(TABLE.userInfo)
    .select("id, deleted_at")
    .eq("email", FORMER_REVIEWER.email)
    .maybeSingle();
  if (error) throw new Error(`Reading the former reviewer failed: ${error.message}`);

  const shape = {
    auth_user_id: null,
    first_name: FORMER_REVIEWER.first_name,
    last_name: FORMER_REVIEWER.last_name,
    role_access: FORMER_REVIEWER.role_access,
  };

  if (data) {
    counts.updated += 1;
    if (!dryRun) {
      const { error: updateError } = await supabase
        .from(TABLE.userInfo)
        .update({ ...shape, deleted_at: data.deleted_at ?? new Date().toISOString() })
        .eq("id", data.id);
      if (updateError) {
        throw new Error(`Updating the former reviewer failed: ${updateError.message}`);
      }
    }
    return { id: data.id as string, counts };
  }

  counts.created += 1;
  if (dryRun) return { id: null, counts };

  const { data: created, error: insertError } = await supabase
    .from(TABLE.userInfo)
    .insert({ ...shape, email: FORMER_REVIEWER.email, deleted_at: new Date().toISOString() })
    .select("id")
    .single();
  if (insertError) {
    throw new Error(`Creating the former reviewer failed: ${insertError.message}`);
  }
  return { id: created.id as string, counts };
}

/**
 * Makes the fixture accounts' reviewer notes match `notes`.
 *
 * A note is the seed's when a fixture account (or the former reviewer) wrote
 * it, and it is matched on application, author and time. One the data
 * describes differently is replaced, since the database moves `edited_at` on
 * an edit and the seed has to write it as given. With `prune`, notes a fixture
 * wrote that the data doesn't describe, such as one posted through the review
 * page, are deleted, as a fixture's purchases are. Notes by any other account
 * are never touched.
 */
export async function reconcileReviewNotes(
  supabase: SupabaseClient,
  notes: readonly ResolvedReviewNote[],
  profileIds: Map<string, string>,
  options: { dryRun: boolean; prune: boolean }
): Promise<{ profile: Counts; notes: Counts }> {
  const former = await reconcileFormerReviewer(supabase, options.dryRun);
  const counts = emptyCounts();

  const authorIdOf = (email: string) =>
    email === FORMER_REVIEWER.email ? former.id : profileIds.get(email) ?? null;

  // The applications the notes sit on, by applicant and event.
  const slugs = [...new Set(notes.map((note) => note.eventSlug))];
  const { data: events, error: eventsError } = await supabase
    .from(TABLE.events)
    .select("id, slug")
    .in("slug", slugs);
  if (eventsError) throw new Error(`Reading events failed: ${eventsError.message}`);
  const eventIdBySlug = new Map(
    (events ?? []).map((event) => [event.slug as string, event.id as string])
  );

  const applicantIds = [
    ...new Set(
      notes.flatMap((note) => {
        const id = profileIds.get(note.applicantEmail);
        return id ? [id] : [];
      })
    ),
  ];
  const applicationIdByKey = new Map<string, string>();
  if (applicantIds.length > 0 && eventIdBySlug.size > 0) {
    const { data, error } = await supabase
      .from(TABLE.eventApplications)
      .select("id, event_id, user_id")
      .in("user_id", applicantIds)
      .in("event_id", [...eventIdBySlug.values()]);
    if (error) throw new Error(`Reading event applications failed: ${error.message}`);
    for (const row of data ?? []) {
      applicationIdByKey.set(`${row.user_id}:${row.event_id}`, row.id as string);
    }
  }

  const desired = notes.flatMap((note) => {
    const authorId = authorIdOf(note.authorEmail);
    const applicantId = profileIds.get(note.applicantEmail);
    const eventId = eventIdBySlug.get(note.eventSlug);
    const applicationId =
      applicantId && eventId ? applicationIdByKey.get(`${applicantId}:${eventId}`) : undefined;
    if (!applicationId || !authorId) {
      // Only a dry run reaches here legitimately: the rows it would write
      // first don't exist yet.
      if (!options.dryRun) {
        throw new Error(
          `No application or author for the reviewer note by ${note.authorEmail} on ${note.applicantEmail}`
        );
      }
      counts.created += 1;
      return [];
    }
    return [
      {
        key: noteKey(applicationId, authorId, note.createdAt),
        row: {
          application_id: applicationId,
          author_id: authorId,
          body: note.body,
          created_at: note.createdAt,
          edited_at: note.editedAt,
        },
      },
    ];
  });

  const authorIds = [
    ...new Set([...profileIds.values(), ...(former.id ? [former.id] : [])]),
  ];
  const existing = await selectNotesBy(supabase, authorIds);
  const existingByKey = new Map(
    existing.map((row) => [noteKey(row.application_id, row.author_id, row.created_at), row])
  );

  const stale: string[] = [];
  const toInsert = desired.flatMap(({ key, row }) => {
    const current = existingByKey.get(key);
    if (!current) {
      counts.created += 1;
      return [row];
    }
    counts.updated += 1;
    if (current.body === row.body && timeKey(current.edited_at) === timeKey(row.edited_at)) {
      return [];
    }
    stale.push(current.id);
    return [row];
  });

  const plan = planPrune(
    existing,
    (row) => noteKey(row.application_id, row.author_id, row.created_at),
    desired.map(({ key }) => key)
  );
  const pruned = options.prune ? plan.remove.map((entry) => entry.row.id) : [];
  counts.pruned = pruned.length;

  if (options.dryRun) return { profile: former.counts, notes: counts };

  await deleteNotes(supabase, stale, "changed reviewer notes");
  await deleteNotes(supabase, pruned, "stale reviewer notes");
  if (toInsert.length > 0) {
    const { error } = await supabase.from(TABLE.reviewNotes).insert(toInsert);
    if (error) throw new Error(`Writing reviewer notes failed: ${error.message}`);
  }

  return { profile: former.counts, notes: counts };
}

/**
 * Deletes the notes these profiles wrote, so the profiles themselves can be
 * deleted: `application_review_notes.author_id` is `no action`, because a real
 * account is anonymised rather than removed and its notes stay.
 */
export async function releaseReviewNotesBy(
  supabase: SupabaseClient,
  profileIds: string[]
): Promise<void> {
  for (let start = 0; start < profileIds.length; start += IN_CHUNK) {
    const { error } = await supabase
      .from(TABLE.reviewNotes)
      .delete()
      .in("author_id", profileIds.slice(start, start + IN_CHUNK));
    if (error) throw new Error(`Deleting their reviewer notes failed: ${error.message}`);
  }
}
