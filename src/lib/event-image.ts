/**
 * Pure helpers for event cover images, shared by the upload route
 * (`src/app/api/upload-event-image/route.ts`) and the client picker
 * (`src/components/shared/ImageUpload.tsx`).
 *
 * Keep this module free of `server-only`, `fs`, and `next` imports so both
 * sides can use it, and free of I/O so the colocated tests stay pure.
 */

import { slugify } from "@/lib/slug";

export const EVENT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Vercel rejects serverless request bodies above 4.5MB before the handler runs,
 * so the app limit sits below that deliberately. Raising it past ~4.5MB would
 * make large uploads fail at the platform edge with a non-JSON response.
 */
export const EVENT_IMAGE_MAX_MB = EVENT_IMAGE_MAX_BYTES / (1024 * 1024);

export const ALLOWED_EVENT_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

export function isAllowedEventImageType(fileType: string): boolean {
  return ALLOWED_EVENT_IMAGE_TYPES.some((allowed) => allowed === fileType);
}

export const EVENT_IMAGE_ERRORS = {
  type: "Only JPG and PNG images are allowed.",
  size: `Image size must be less than ${EVENT_IMAGE_MAX_MB}MB.`,
  dimensions: "Unable to read image dimensions.",
  square: "Event thumbnails must be square (same width and height).",
} as const;

const STORAGE_PUBLIC_PREFIX = "/storage/v1/object/public/";

/** Longest slug segment kept in an object key, before the unique suffix. */
const MAX_KEY_SLUG_LENGTH = 50;

export type ImageDimensions = {
  width: number;
  height: number;
};

export type EventImageContentType = "image/jpeg" | "image/png";
export type EventImageExtension = "jpg" | "png";

const jpegStartOfFrameMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
  0xcf,
]);

export function getPngDimensions(buffer: Buffer): ImageDimensions | null {
  const pngSignature = "89504e470d0a1a0a";

  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export function getJpegDimensions(buffer: Buffer): ImageDimensions | null {
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

export function getImageDimensions(
  buffer: Buffer,
  fileType: string
): ImageDimensions | null {
  if (fileType === "image/png") {
    return getPngDimensions(buffer);
  }

  if (fileType === "image/jpeg" || fileType === "image/jpg") {
    return getJpegDimensions(buffer);
  }

  return null;
}

/**
 * Maps an accepted upload type to the canonical content type and file
 * extension. Browsers occasionally report the nonstandard `image/jpg`, which
 * the storage bucket's `allowed_mime_types` would reject, so it is normalized
 * to `image/jpeg` here.
 */
export function resolveEventImageType(fileType: string): {
  contentType: EventImageContentType;
  extension: EventImageExtension;
} {
  if (fileType === "image/png") {
    return { contentType: "image/png", extension: "png" };
  }

  if (fileType === "image/jpeg" || fileType === "image/jpg") {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  throw new Error(EVENT_IMAGE_ERRORS.type);
}

export interface EventImageUploadInput {
  fileType: string;
  size: number;
  buffer: Buffer;
}

export interface ParsedEventImageUpload {
  contentType: EventImageContentType;
  extension: EventImageExtension;
  dimensions: ImageDimensions;
}

/**
 * Validates a buffered upload, throwing a user-facing message on the first
 * problem. `size` and `buffer.byteLength` are both checked because the reported
 * size arrives from the client.
 */
export function parseEventImageUpload({
  fileType,
  size,
  buffer,
}: EventImageUploadInput): ParsedEventImageUpload {
  const { contentType, extension } = resolveEventImageType(fileType);

  if (size > EVENT_IMAGE_MAX_BYTES || buffer.byteLength > EVENT_IMAGE_MAX_BYTES) {
    throw new Error(EVENT_IMAGE_ERRORS.size);
  }

  const dimensions = getImageDimensions(buffer, fileType);

  if (!dimensions) {
    throw new Error(EVENT_IMAGE_ERRORS.dimensions);
  }

  if (dimensions.width !== dimensions.height) {
    throw new Error(EVENT_IMAGE_ERRORS.square);
  }

  return { contentType, extension, dimensions };
}

/**
 * Builds the storage object key for a cover image. The unique id is a parameter
 * rather than generated here so tests stay deterministic; callers pass
 * `crypto.randomUUID()`.
 *
 * Keys are unique per upload rather than derived from the event name alone:
 * public storage URLs are CDN-cached long-lived, so reusing a key would serve a
 * stale image after a replacement.
 */
export function buildEventImageObjectKey(
  eventName: string,
  extension: EventImageExtension,
  uniqueId: string
): string {
  const slug = slugify(eventName)
    .slice(0, MAX_KEY_SLUG_LENGTH)
    .replace(/-+$/, "");

  return `covers/${slug || "item"}-${uniqueId}.${extension}`;
}

/**
 * Extracts the object key from a public storage URL, or returns null when the
 * value is not one. Deletions run through this so cleanup can never target
 * anything outside the given bucket -- legacy `/event_images/...` paths and
 * foreign URLs are ignored rather than acted on.
 *
 * Host-agnostic on purpose: local storage URLs use `127.0.0.1:54321` while
 * hosted ones use `<ref>.supabase.co`, and the resulting key is only ever used
 * against our own project's client.
 */
export function parseEventImageObjectKey(
  url: string,
  bucket: string
): string | null {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const prefix = `${STORAGE_PUBLIC_PREFIX}${bucket}/`;

  if (!parsed.pathname.startsWith(prefix)) {
    return null;
  }

  const key = decodeURIComponent(parsed.pathname.slice(prefix.length));

  return key.length > 0 ? key : null;
}

/**
 * Resolves a stored `image_url` to something an `<img>`/`next/image` src can
 * use. Absolute URLs (storage objects, seed fixtures) and in-memory previews
 * pass through untouched; legacy relative paths keep their leading slash.
 */
export function resolveImagePreviewSrc(value: string): string {
  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  return value.startsWith("/") ? value : `/${value}`;
}
