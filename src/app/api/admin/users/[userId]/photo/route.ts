import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { loadCurrentUser } from "@/lib/auth/current-user";
import { hasManagerAccess } from "@/lib/auth/roles";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ProfilePhotoConflictError, replaceProfilePhoto } from "@/lib/supabase-helpers/admin-user-profile";
import { parseProfilePhoto, PROFILE_PHOTO_MAX_BYTES } from "@/features/admin/lib/user-profile";
import { errorFields, log } from "@/lib/log";

export async function POST(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  // A route handler answers in JSON: the guards redirect, and the client would
  // follow that to an HTML page and fail to parse it.
  const current = await loadCurrentUser();
  if (current.status !== "authenticated" || !hasManagerAccess(current.user.role_access)) {
    return NextResponse.json({ error: "Only managers can change profile photos. Reload the page to check your access." }, { status: 403 });
  }
  const { userId } = await context.params;
  const form = await req.formData();
  const file = form.get("file");
  const previous = form.get("expectedPath");
  if (!(file instanceof File) || typeof previous !== "string") {
    return NextResponse.json({ error: "Choose a photo and reload the user details." }, { status: 400 });
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
    const user = await replaceProfilePhoto(supabaseAdmin, userId, previous || null, { body, ...parsed });
    revalidatePath("/admin/users", "layout");
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ProfilePhotoConflictError) {
      log.warn("admin.profile_photo_save_conflict", { userId });
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    log.error("admin.profile_photo_save_failed", { userId, ...errorFields(error) });
    return NextResponse.json({ error: "Unable to save photo. Try again." }, { status: 500 });
  }
}
