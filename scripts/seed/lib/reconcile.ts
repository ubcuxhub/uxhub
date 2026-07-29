/**
 * Idempotency primitives for the seed script.
 *
 * Two strategies, chosen by what the schema actually enforces:
 *
 * - `upsertBySlug` for tables with a real unique constraint on `slug`
 *   (`events_slug_key`, `membership_types_slug_key`). One round trip.
 * - `reconcileChildren` for tables with no unique constraint beyond the PK
 *   (`check_in_sessions`, `event_application_questions`). Read, diff by natural
 *   key, then insert/update the difference.
 *
 * Deletes are opt-in. `event_registrations`, `check_ins`, and
 * `event_application_responses` all cascade off these tables, so an unguarded
 * delete would take hand-made test data with it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Counts {
  created: number;
  updated: number;
  pruned: number;
}

export function emptyCounts(): Counts {
  return { created: 0, updated: 0, pruned: 0 };
}

export function addCounts(target: Counts, source: Counts): void {
  target.created += source.created;
  target.updated += source.updated;
  target.pruned += source.pruned;
}

export interface ReconcileOptions {
  dryRun: boolean;
  prune: boolean;
}

/** A row keyed by slug, as stored after a successful upsert. */
export interface SlugRow {
  id: string;
  slug: string | null;
}

/**
 * Inserts or updates rows keyed on their `slug` unique constraint.
 *
 * Returns a slug -> id map so callers can attach child rows, plus the
 * create/update split for the run summary. Determining that split costs one
 * extra read, which is worth it: "0 created, 12 updated" on a second run is the
 * signal that the script is actually idempotent.
 */
export async function upsertBySlug<Row extends { slug: string }>(
  supabase: SupabaseClient,
  table: string,
  rows: Row[],
  options: ReconcileOptions
): Promise<{ idsBySlug: Map<string, string>; counts: Counts }> {
  const counts = emptyCounts();
  const idsBySlug = new Map<string, string>();

  if (rows.length === 0) return { idsBySlug, counts };

  const slugs = rows.map((row) => row.slug);

  const { data: existing, error: readError } = await supabase
    .from(table)
    .select("id, slug")
    .in("slug", slugs);

  if (readError) {
    throw new Error(`Reading ${table} failed: ${readError.message}`);
  }

  const existingBySlug = new Map<string, string>();
  for (const row of (existing ?? []) as SlugRow[]) {
    if (row.slug) existingBySlug.set(row.slug, row.id);
  }

  counts.updated = existingBySlug.size;
  counts.created = rows.length - existingBySlug.size;

  if (options.dryRun) {
    for (const [slug, id] of existingBySlug) idsBySlug.set(slug, id);
    return { idsBySlug, counts };
  }

  const { data, error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: "slug" })
    .select("id, slug");

  if (error) {
    throw new Error(`Upserting ${table} failed: ${error.message}`);
  }

  for (const row of (data ?? []) as SlugRow[]) {
    if (row.slug) idsBySlug.set(row.slug, row.id);
  }

  return { idsBySlug, counts };
}

/**
 * Reconciles child rows belonging to one parent, matched on a natural key.
 *
 * New rows are inserted one at a time rather than as a batch so that their
 * `created_at` ordering matches the order of the seed data. That matters for
 * application questions: `fetchApplicationQuestions` in
 * `src/lib/supabase-helpers/event-applications.ts` orders by `created_at`, so a
 * batch insert could shuffle the form between runs.
 */
export async function reconcileChildren<Row extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  parentColumn: string,
  parentId: string,
  keyColumn: string,
  rows: Row[],
  options: ReconcileOptions
): Promise<Counts> {
  const counts = emptyCounts();

  const { data: existing, error: readError } = await supabase
    .from(table)
    .select(`id, ${keyColumn}`)
    .eq(parentColumn, parentId);

  if (readError) {
    throw new Error(`Reading ${table} failed: ${readError.message}`);
  }

  // The select list is built at runtime, so PostgREST's type-level parser cannot
  // infer the row shape and falls back to a ParserError. Cast through unknown.
  const existingRows = (existing ?? []) as unknown as Record<string, string>[];

  const existingByKey = new Map<string, string>();
  for (const row of existingRows) {
    existingByKey.set(row[keyColumn], row.id);
  }

  const desiredKeys = new Set<string>();

  for (const row of rows) {
    const key = String(row[keyColumn]);
    desiredKeys.add(key);

    const existingId = existingByKey.get(key);

    if (existingId) {
      counts.updated += 1;
      if (options.dryRun) continue;

      const { error } = await supabase
        .from(table)
        .update(row)
        .eq("id", existingId);

      if (error) {
        throw new Error(`Updating ${table} "${key}" failed: ${error.message}`);
      }
    } else {
      counts.created += 1;
      if (options.dryRun) continue;

      const { error } = await supabase
        .from(table)
        .insert({ ...row, [parentColumn]: parentId });

      if (error) {
        throw new Error(`Inserting ${table} "${key}" failed: ${error.message}`);
      }
    }
  }

  const orphans = [...existingByKey.entries()].filter(
    ([key]) => !desiredKeys.has(key)
  );

  for (const [key, id] of orphans) {
    if (!options.prune) {
      console.warn(
        `  ! ${table} "${key}" exists but is not in the seed data (re-run with --prune to delete)`
      );
      continue;
    }

    counts.pruned += 1;
    if (options.dryRun) continue;

    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      throw new Error(`Deleting ${table} "${key}" failed: ${error.message}`);
    }
  }

  return counts;
}
