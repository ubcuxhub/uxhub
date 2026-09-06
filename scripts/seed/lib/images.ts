/**
 * Event cover images for the seed.
 *
 * The fixtures used to point `image_url` at Unsplash, which meant local
 * development depended on the network and never exercised the storage path the
 * app actually uses. Instead the PNGs in `scripts/seed/data/images` are
 * uploaded into the `event-images` bucket and each event's `image_url` is the
 * resulting public URL — the same shape `adminUploadEventImage` produces, so
 * `parseEventImageObjectKey` recognizes them as real bucket objects.
 *
 * Objects live under `seed/covers/` rather than the `covers/` prefix the admin
 * upload route writes to. That separation is what lets the prune pass clear out
 * stale seed images without ever touching a cover somebody uploaded by hand.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { SupabaseClient } from "@supabase/supabase-js";

import { emptyCounts, type Counts } from "./reconcile.ts";
import { planPrune } from "./prune.ts";

/** Prefix owned by the seed. Never overlaps the admin route's `covers/`. */
export const SEED_IMAGE_PREFIX = "seed/covers";

const IMAGE_DIR = fileURLToPath(new URL("../data/images", import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** A file name in `scripts/seed/data/images`, e.g. `"3.png"`. */
export type SeedImageKey = string;

export function seedImageObjectKey(key: SeedImageKey): string {
  return `${SEED_IMAGE_PREFIX}/${key}`;
}

/** Lists the image files available to fixtures, sorted for stable output. */
export async function listSeedImageFiles(): Promise<SeedImageKey[]> {
  const entries = await readdir(IMAGE_DIR, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        path.extname(entry.name).toLowerCase() in CONTENT_TYPES
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
}

/**
 * The public URL for a seed image, derived from the target's own host.
 *
 * Pure string building on the client — no request — so events can be reconciled
 * with `--only=events` against images a previous run already uploaded.
 */
export function seedImageUrl(
  supabase: SupabaseClient,
  bucket: string,
  key: SeedImageKey
): string {
  return supabase.storage.from(bucket).getPublicUrl(seedImageObjectKey(key)).data
    .publicUrl;
}

/**
 * Uploads every referenced image, overwriting in place.
 *
 * Keys are stable (`seed/covers/3.png`) rather than unique-per-upload, which is
 * the opposite of the admin route's rule. The seed wants idempotency more than
 * it wants cache-busting, and a short `cacheControl` keeps a replaced fixture
 * image from sticking around in the browser.
 */
export async function uploadSeedImages(
  supabase: SupabaseClient,
  bucket: string,
  keys: readonly SeedImageKey[],
  options: { dryRun: boolean }
): Promise<Counts> {
  const counts = emptyCounts();
  const unique = [...new Set(keys)].sort((left, right) =>
    left.localeCompare(right, "en", { numeric: true })
  );

  if (unique.length === 0) return counts;

  const { data: existing, error: listError } = await supabase.storage
    .from(bucket)
    .list(SEED_IMAGE_PREFIX, { limit: 1000 });

  if (listError) {
    throw new Error(`Listing seed images failed: ${listError.message}`);
  }

  const existingNames = new Set((existing ?? []).map((object) => object.name));

  for (const key of unique) {
    if (existingNames.has(key)) counts.updated += 1;
    else counts.created += 1;

    if (options.dryRun) continue;

    const extension = path.extname(key).toLowerCase();
    const contentType = CONTENT_TYPES[extension];

    if (!contentType) {
      throw new Error(`Seed image "${key}" has an unsupported extension`);
    }

    const body = await readFile(path.join(IMAGE_DIR, key));
    const { error } = await supabase.storage
      .from(bucket)
      .upload(seedImageObjectKey(key), body, {
        contentType,
        cacheControl: "60",
        upsert: true,
      });

    if (error) {
      throw new Error(`Uploading seed image "${key}" failed: ${error.message}`);
    }
  }

  return counts;
}

/** Deletes objects under `seed/covers/` that no fixture references. */
export async function pruneSeedImages(
  supabase: SupabaseClient,
  bucket: string,
  keys: readonly SeedImageKey[],
  options: { dryRun: boolean }
): Promise<{ pruned: number; skipped: string[] }> {
  const { data: existing, error: listError } = await supabase.storage
    .from(bucket)
    .list(SEED_IMAGE_PREFIX, { limit: 1000 });

  if (listError) {
    throw new Error(`Listing seed images failed: ${listError.message}`);
  }

  const { remove } = planPrune(existing ?? [], (object) => object.name, keys);

  if (remove.length === 0) return { pruned: 0, skipped: [] };
  if (options.dryRun) {
    return { pruned: remove.length, skipped: remove.map((entry) => entry.key) };
  }

  const { error } = await supabase.storage
    .from(bucket)
    .remove(remove.map((entry) => seedImageObjectKey(entry.key)));

  if (error) {
    throw new Error(`Deleting stale seed images failed: ${error.message}`);
  }

  return { pruned: remove.length, skipped: remove.map((entry) => entry.key) };
}
