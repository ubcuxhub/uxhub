import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const eventName = formData.get("eventName") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!eventName) {
      return NextResponse.json(
        { error: "Event name is required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPG and PNG images are allowed" },
        { status: 400 }
      );
    }

    // Sanitize event name for filename
    const sanitizedName = eventName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 50); // Limit length

    // Get file extension
    const extension = file.type === "image/jpeg" ? "jpg" : "png";
    const filename = `${sanitizedName}-cover.${extension}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create event_images directory if it doesn't exist
    const publicDir = join(process.cwd(), "public");
    const eventImagesDir = join(publicDir, "event_images");

    if (!existsSync(eventImagesDir)) {
      await mkdir(eventImagesDir, { recursive: true });
    }

    // Write file
    const filePath = join(eventImagesDir, filename);
    await writeFile(filePath, buffer);

    // Return relative path
    const relativePath = `/event_images/${filename}`;

    return NextResponse.json({
      success: true,
      path: relativePath,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
