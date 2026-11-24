import { formatUserName } from "@/lib/user-name";

import { TABLES } from "./tables";
import type { DbClient } from "./types";

/** Shown instead of a name once someone has deleted their account. */
export const DELETED_ACTOR_NAME = "Deleted user";

/** One column an admin changed, as the History tab renders it. */
export interface AuditChange {
  column: string;
  from: unknown;
  to: unknown;
}

/** One entry in a subject's change history. */
export interface AuditHistoryEntry {
  id: string;
  createdAt: string;
  action: string;
  /** The admin who made the change, or null when the entry predates attribution. */
  actorName: string | null;
  /** Empty when the entry was redacted by an account deletion. */
  changes: AuditChange[];
  /** True once the recorded values have been scrubbed. */
  redacted: boolean;
}

/**
 * The rows a history can be read for: the two drawers that show one.
 *
 * Narrow rather than `string` so a mistyped table name is a type error
 * instead of an empty list, which reads the same as "nothing has changed".
 */
export type AuditSubjectTable =
  | typeof TABLES.userInfo
  | typeof TABLES.events;

export interface FetchChangeHistoryOptions {
  /** Defaults to 50. The drawer shows a page at a time. */
  limit?: number;
}

/**
 * The shape the trigger writes, and the deletion scrub replaces.
 *
 * `changes` is `{"column": {"from": …, "to": …}}`, or `{"redacted": true}` once
 * the member it describes has deleted their account.
 */
type RawChanges = Record<string, { from?: unknown; to?: unknown } | boolean>;

interface AuditRow {
  id: string;
  created_at: string;
  action: string;
  changes: RawChanges | null;
  actor: {
    first_name: string;
    last_name: string;
    deleted_at: string | null;
  } | null;
}

function isRedacted(changes: RawChanges | null): boolean {
  return changes !== null && changes.redacted === true;
}

function toChanges(changes: RawChanges | null): AuditChange[] {
  if (changes === null || isRedacted(changes)) return [];

  return Object.entries(changes)
    .filter(
      (entry): entry is [string, { from?: unknown; to?: unknown }] =>
        typeof entry[1] === "object" && entry[1] !== null
    )
    .map(([column, value]) => ({
      column,
      from: value.from ?? null,
      to: value.to ?? null,
    }))
    // Stable order: the trigger builds the object key by key, and Postgres
    // jsonb does not promise to give it back the same way.
    .sort((a, b) => a.column.localeCompare(b.column));
}

/**
 * The actor's name, or "Deleted user".
 *
 * `delete_account` anonymizes the profile rather than removing it, so the row
 * is still there and reads "Deleted member". The History tab says
 * "Deleted user" regardless of what the anonymization happened to write, so
 * the wording does not drift if that function changes.
 */
function toActorName(actor: AuditRow["actor"]): string | null {
  if (!actor) return null;
  if (actor.deleted_at !== null) return DELETED_ACTOR_NAME;

  return formatUserName(actor) || DELETED_ACTOR_NAME;
}

/**
 * Reads the admin change history for one row, newest first.
 *
 * Only admins can read `audit_events`, so this returns nothing for anyone
 * else rather than failing — the RLS policy filters the rows, it does not
 * raise.
 *
 * `subjectTable` names the row an entry points at: `user_info` for the
 * edit-user drawer, `events` for edit-event. Only edits to those rows
 * themselves are recorded today; once an event's children are logged against
 * the event, this same query picks them up without becoming a union.
 */
export async function fetchChangeHistory(
  supabase: DbClient,
  subjectTable: AuditSubjectTable,
  subjectId: string,
  { limit = 50 }: FetchChangeHistoryOptions = {}
): Promise<AuditHistoryEntry[]> {
  const { data, error } = await supabase
    .from(TABLES.auditEvents)
    .select(
      "id, created_at, action, changes, actor:actor_id (first_name, last_name, deleted_at)"
    )
    .eq("source", "admin_change")
    .eq("subject_table", subjectTable)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as unknown as AuditRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    actorName: toActorName(row.actor),
    changes: toChanges(row.changes),
    redacted: isRedacted(row.changes),
  }));
}

/** The change history for one member, for the edit-user drawer. */
export function fetchUserChangeHistory(
  supabase: DbClient,
  userId: string,
  options?: FetchChangeHistoryOptions
) {
  return fetchChangeHistory(supabase, TABLES.userInfo, userId, options);
}

/** The change history for one event, for the edit-event drawer. */
export function fetchEventChangeHistory(
  supabase: DbClient,
  eventId: string,
  options?: FetchChangeHistoryOptions
) {
  return fetchChangeHistory(supabase, TABLES.events, eventId, options);
}
