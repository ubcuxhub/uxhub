import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ProfilePhotoConflictError, replaceProfilePhoto } from "@/lib/supabase-helpers/admin-user-profile";
import { parseProfilePhoto, PROFILE_PHOTO_MAX_BYTES } from "@/features/admin/lib/user-profile";
import { toSetupState } from "@/features/setup/lib/state";
import { errorFields, log } from "@/lib/log";

/**
 * The signed-in member's own profile photo (setup step 2, later Settings).
 *
 * POST multipart/form-data:
 * - `file`: the JPEG or PNG to store, at most 4 MiB. Crop it to a square in
 *   the browser first; re-encoding through a canvas also strips EXIF and GPS.
 * - `expectedPath`: the member's current `profile_photo_path`, or "" for none.
 *   A stale value is a 409, so two tabs can't orphan each other's uploads.
 *
 * Responds `{ setup: SetupState }` with the new `profilePhotoPath` (and
 * `avatarPreset` cleared), or `{ error }` with 400, 409, 413 or 500. The photo
 * is attached immediately; `saveSetupPhotoAction({ avatarPreset: null })` then
 * confirms it and moves setup on. Same storage rules as the managers' route,
 * `/api/admin/users/[userId]/photo`.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth();
  const form = await req.formData();
  const file = form.get("file");
  const previous = form.get("expectedPath");
  if (!(file instanceof File) || typeof previous !== "string") {
    return NextResponse.json({ error: "Choose a photo and try again." }, { status: 400 });
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) return NextResponse.json({ error: "Choose an image up to 4 MiB." }, { status: 413 });
  const body = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseProfilePhoto(body, file.type);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid image." }, { status: 400 });
  }
  try {
    const saved = await replaceProfilePhoto(supabaseAdmin, user.id, previous || null, { body, ...parsed });
    revalidatePath("/", "layout");
    return NextResponse.json({ setup: toSetupState(saved) });
  } catch (error) {
    if (error instanceof ProfilePhotoConflictError) {
      log.warn("setup.profile_photo_save_conflict", { userId: user.id });
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    log.warn("setup.profile_photo_save_failed", { userId: user.id, ...errorFields(error) });
    return NextResponse.json({ error: "Unable to save photo. Try again." }, { status: 500 });
  }
}
