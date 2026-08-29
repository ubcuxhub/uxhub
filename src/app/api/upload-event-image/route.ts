import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/guards";
import {
  buildEventImageObjectKey,
  EVENT_IMAGE_ERRORS,
  EVENT_IMAGE_MAX_BYTES,
  parseEventImageUpload,
} from "@/lib/event-image";
import { adminUploadEventImage } from "@/lib/supabase-helpers/admin-server";

export async function POST(req: NextRequest) {
  // Outside the try below: requireAdmin redirects via a thrown NEXT_REDIRECT,
  // which a catch-all would swallow into a 500.
  await requireAdmin();

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const eventName = formData.get("eventName");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (typeof eventName !== "string" || eventName.trim().length === 0) {
      return NextResponse.json(
        { error: "Event name is required." },
        { status: 400 }
      );
    }

    // Checked before buffering so an oversized upload is rejected cheaply.
    if (file.size > EVENT_IMAGE_MAX_BYTES) {
      return NextResponse.json(
        { error: EVENT_IMAGE_ERRORS.size },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let parsed;
    try {
      parsed = parseEventImageUpload({
        fileType: file.type,
        size: file.size,
        buffer,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Invalid image upload.",
        },
        { status: 400 }
      );
    }

    const objectKey = buildEventImageObjectKey(
      eventName,
      parsed.extension,
      crypto.randomUUID()
    );

    const url = await adminUploadEventImage(
      objectKey,
      buffer,
      parsed.contentType
    );

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image." },
      { status: 500 }
    );
  }
}
