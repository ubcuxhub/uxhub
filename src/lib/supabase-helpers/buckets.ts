/**
 * Single source of truth for Supabase Storage bucket names.
 *
 * A sibling to `tables.ts` rather than part of it, since that map is scoped to
 * table names. Same rationale though: bucket ids are plain strings the client
 * cannot type-check, so a rename should be a one-line edit here.
 *
 * Buckets are provisioned by `supabase/migrations` for remote environments and
 * by `pnpm seed` locally -- see `supabase/README.md`.
 */
export const BUCKETS = {
  eventImages: "event-images",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
