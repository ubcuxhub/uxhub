import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { UserInfoUpdate } from "@/lib/supabase/models";
import { errorFields, log } from "@/lib/log";
import { BUCKETS } from "./buckets";
import { TABLES } from "./tables";

export async function fetchActiveProfile(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db.from(TABLES.userInfo).select("*").eq("id", userId).is("deleted_at", null).single();
  if (error || !data) throw new Error("Active user not found.");
  return data;
}

export async function saveAdminProfile(db: SupabaseClient<Database>, userId: string, patch: UserInfoUpdate) {
  const { data, error } = await db.from(TABLES.userInfo).update(patch).eq("id", userId).is("deleted_at", null).select("*").single();
  if (error || !data) throw new Error("Unable to save user information.");
  return data;
}

export async function cleanupProfilePhoto(db: SupabaseClient<Database>, path: string | null) {
  if (!path || !/^profiles\/[0-9a-f-]+\/[0-9a-f-]+\.(jpg|png)$/.test(path)) return;
  try {
    const { error } = await db.storage.from(BUCKETS.profilePhotos).remove([path]);
    if (error) throw error;
  } catch (error) {
    log.error("admin.profile_photo_cleanup_failed", errorFields(error));
  }
}

/** After anonymization no new photo can be attached; include stale uploads too. */
export async function cleanupAccountProfilePhotos(db: SupabaseClient<Database>, userId: string) {
  try {
    const storage = db.storage.from(BUCKETS.profilePhotos);
    const prefix = `profiles/${userId}`;
    for (;;) {
      const { data, error } = await storage.list(prefix, { limit: 1000 });
      if (error) throw error;
      if (!data?.length) return;
      const removed = await storage.remove(data.map((file) => `${prefix}/${file.name}`));
      if (removed.error) throw removed.error;
    }
  } catch (error) {
    log.error("account.profile_photo_cleanup_failed", { userId, ...errorFields(error) });
  }
}

/** Compare-and-swap prevents a concurrent replacement from losing its image. */
export async function replaceProfilePhoto(
  db: SupabaseClient<Database>, userId: string, expectedPath: string | null,
  photo: { body: Buffer; contentType: string; extension: string } | null,
) {
  await fetchActiveProfile(db, userId);
  const nextPath = photo ? `profiles/${userId}/${crypto.randomUUID()}.${photo.extension}` : null;
  if (photo && nextPath) {
    const { error } = await db.storage.from(BUCKETS.profilePhotos).upload(nextPath, photo.body, {
      contentType: photo.contentType, cacheControl: "31536000", upsert: false,
    });
    if (error) throw new Error("Unable to upload profile photo.");
  }
  let query = db.from(TABLES.userInfo).update({ profile_photo_path: nextPath }).eq("id", userId).is("deleted_at", null);
  query = expectedPath === null ? query.is("profile_photo_path", null) : query.eq("profile_photo_path", expectedPath);
  const { data, error } = await query.select("*").maybeSingle();
  if (error || !data) {
    await cleanupProfilePhoto(db, nextPath);
    throw new Error("The profile photo changed or the user is unavailable. Reload and try again.");
  }
  await cleanupProfilePhoto(db, expectedPath);
  return data;
}
