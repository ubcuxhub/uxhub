"use client";

import { Avatar, type AvatarSize } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { AVATAR_PRESET_ART } from "../lib/avatar";
import type { AvatarPreset } from "../lib/options";

export interface MemberAvatarProps {
  name: string;
  /** An uploaded photo's URL. Wins over the preset, as `resolveAvatar` says. */
  photoUrl?: string | null;
  preset?: AvatarPreset | null;
  size?: AvatarSize | "preview";
  decorative?: boolean;
  className?: string;
}

/**
 * A member's avatar as setup and Settings show it: their photo, else their
 * brand-shape preset, else initials. "preview" is the 112px avatar of the
 * setup preview card (Figma 4292:2), larger than any list size.
 */
export function MemberAvatar({
  name,
  photoUrl,
  preset,
  size = 40,
  decorative,
  className,
}: MemberAvatarProps) {
  const src = photoUrl || (preset ? AVATAR_PRESET_ART[preset] : null);
  return (
    <Avatar
      // A new source remounts, so the old image never lingers while the new one loads.
      key={src ?? "initials"}
      name={name}
      src={src}
      size={size === "preview" ? 64 : size}
      decorative={decorative}
      className={cn(size === "preview" && "size-20 text-[28px] sm:size-28 sm:text-[40px]", className)}
    />
  );
}
