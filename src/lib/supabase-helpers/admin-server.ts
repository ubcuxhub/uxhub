import "server-only";

import { parseEventImageObjectKey } from "@/lib/event-image";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKETS } from "./buckets";
import { TABLES } from "./tables";

/**
 * Service-role data-access helpers. These bypass Row Level Security and must
 * only be called from server-only code (route handlers, server actions).
 *
 * Payloads are intentionally permissive because the privileged client is
 * untyped (see `@/lib/supabase/admin`). Keep the raw column shapes at the call
 * sites so they remain easy to audit.
 */

type UserInfoWritePayload = Record<string, unknown>;

export interface AdminUserInfoLookup {
  id: string;
  auth_user_id: string | null;
  email: string;
}

export async function adminFindUserInfoByEmail(
  email: string
): Promise<AdminUserInfoLookup | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLES.userInfo)
    .select("id, auth_user_id, email")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return (data as AdminUserInfoLookup | null) ?? null;
}

export async function adminUpdateUserInfoById(
  id: string,
  payload: UserInfoWritePayload
) {
  const { data, error } = await supabaseAdmin
    .from(TABLES.userInfo)
    .update(payload)
    .eq("id", id)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Permanently deletes a member's login and anonymizes their profile row.
 *
 * The work happens in the `delete_account` database function so the profile
 * update and the `auth.users` delete share one transaction — the auth row
 * cannot be removed until the profile stops referencing it, and a half-applied
 * deletion would strand the member with a live login and a scrubbed profile.
 */
export async function adminDeleteAccount(authUserId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("delete_account", {
    p_auth_user_id: authUserId,
  });

  if (error) throw error;
}

export async function adminInsertUserInfo(payload: UserInfoWritePayload) {
  const { data, error } = await supabaseAdmin
    .from(TABLES.userInfo)
    .insert(payload)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Uploads an event cover image and returns its public URL.
 *
 * `upsert: false` keeps every upload on a fresh key, so the long `cacheControl`
 * below never serves a stale image after a cover is replaced.
 */
export async function adminUploadEventImage(
  objectKey: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const bucket = supabaseAdmin.storage.from(BUCKETS.eventImages);

  const { error } = await bucket.upload(objectKey, body, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) throw error;

  return bucket.getPublicUrl(objectKey).data.publicUrl;
}

/**
 * Deletes an event cover image given its public URL.
 *
 * No-ops when the value is not a public URL for our bucket, so legacy
 * `/event_images/...` paths and third-party URLs are left alone.
 */
export async function adminDeleteEventImageByUrl(url: string): Promise<void> {
  const objectKey = parseEventImageObjectKey(url, BUCKETS.eventImages);

  if (!objectKey) return;

  const { error } = await supabaseAdmin.storage
    .from(BUCKETS.eventImages)
    .remove([objectKey]);

  if (error) throw error;
}
