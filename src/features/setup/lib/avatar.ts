import { AVATAR_PRESETS, type AvatarPreset } from "./options";

/**
 * The art for each avatar preset: the brand panel's shape tiles
 * (`public/auth/shapes`, see `brand-shapes.ts`), each a square that reads as
 * a circle once the avatar crops it. The tiles' file names predate the preset
 * ids, hence the mapping.
 */
export const AVATAR_PRESET_ART: Record<AvatarPreset, string> = {
  pointer: "/auth/shapes/play.png",
  splash: "/auth/shapes/splat.png",
  flower: "/auth/shapes/flower.png",
  triangle: "/auth/shapes/triangle.png",
  sparkle: "/auth/shapes/sparkle.png",
  starburst: "/auth/shapes/burst.png",
};

export function avatarPresetLabel(preset: AvatarPreset): string {
  return AVATAR_PRESETS.find((option) => option.id === preset)?.label ?? preset;
}

/**
 * Files the photo picker accepts before cropping. The crop re-encodes to a
 * small JPEG, so the original may be larger than the 4 MiB the upload route
 * stores; the cap only keeps the browser from decoding something huge.
 */
export const PHOTO_SOURCE_TYPES = ["image/jpeg", "image/png"] as const;
export const PHOTO_SOURCE_MAX_BYTES = 20 * 1024 * 1024;

/** Why `file` can't be cropped, as copy for the member, or null when it can. */
export function photoFileError(file: Pick<File, "type" | "size">): string | null {
  if (!(PHOTO_SOURCE_TYPES as readonly string[]).includes(file.type)) {
    return "Uploads must be JPG or PNG. Choose another photo.";
  }
  if (file.size > PHOTO_SOURCE_MAX_BYTES) {
    return "That photo is over 20 MB. Choose a smaller one.";
  }
  if (file.size === 0) return "That file is empty. Choose another photo.";
  return null;
}
