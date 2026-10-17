import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ProfilePhotoConflictError, replaceProfilePhoto } from "@/lib/supabase-helpers/admin-user-profile";
import { parseProfilePhoto, PROFILE_PHOTO_MAX_BYTES } from "@/features/admin/lib/user-profile";
import { errorFields, log } from "@/lib/log";

export async function POST(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  await requireManager();
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
    revalidatePath("/admin/users");
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
