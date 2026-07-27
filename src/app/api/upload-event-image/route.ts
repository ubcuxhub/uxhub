import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { requireAdmin } from "@/lib/auth/guards";

type ImageDimensions = {
  width: number;
  height: number;
};

const jpegStartOfFrameMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
  0xcf,
]);

function getPngDimensions(buffer: Buffer): ImageDimensions | null {
  const pngSignature = "89504e470d0a1a0a";

  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function getJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let marker = buffer[offset + 1];
    offset += 2;

    while (marker === 0xff) {
      marker = buffer[offset];
      offset += 1;
    }

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (offset + 2 > buffer.length) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      break;
    }

    if (jpegStartOfFrameMarkers.has(marker) && segmentLength >= 7) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function getImageDimensions(buffer: Buffer, fileType: string): ImageDimensions | null {
  if (fileType === "image/png") {
    return getPngDimensions(buffer);
  }

  if (fileType === "image/jpeg" || fileType === "image/jpg") {
    return getJpegDimensions(buffer);
  }

  return null;
}

export async function POST(req: NextRequest) {
  await requireAdmin();

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

    const dimensions = getImageDimensions(buffer, file.type);
    if (!dimensions) {
      return NextResponse.json(
        { error: "Unable to read image dimensions" },
        { status: 400 }
      );
    }

    if (dimensions.width !== dimensions.height) {
      return NextResponse.json(
        { error: "Event thumbnails must be square (same width and height)" },
        { status: 400 }
      );
    }

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
