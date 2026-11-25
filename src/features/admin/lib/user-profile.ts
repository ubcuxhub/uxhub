import { getImageDimensions, resolveEventImageType } from "@/lib/event-image";

// Shared with member setup and Settings › Profile.
export { validateBirthDate } from "@/lib/birth-date";

export const PROFILE_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export function normalizeInterests(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    throw new Error("Interests must be text tags.");
  }
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of value as string[]) {
    const tag = raw.trim();
    if (!tag || [...tag].length > 50) throw new Error("Each interest must contain 1–50 characters.");
    if (!seen.has(tag.toLowerCase())) tags.push(tag);
    seen.add(tag.toLowerCase());
  }
  if (tags.length > 20) throw new Error("Use at most 20 interests.");
  return tags;
}

export function parseProfilePhoto(buffer: Buffer, fileType: string) {
  if (!buffer.length || buffer.length > PROFILE_PHOTO_MAX_BYTES) throw new Error("Choose an image up to 4 MiB.");
  const parsed = resolveEventImageType(fileType);
  const dimensions = getImageDimensions(buffer, parsed.contentType);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) throw new Error("Choose a valid JPEG or PNG image.");
  return parsed;
}
