"use client";

import * as React from "react";
import { UserRound } from "lucide-react";
import { Avatar as AvatarPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Stands for a person (§3.9): a photo when there is one, otherwise up to two
 * initials. Always round. The name is the accessible label, so pass the
 * person's real name even when the avatar only shows initials.
 *
 * Photos are cropped to fill, weighted towards the top where faces sit in
 * portrait shots. Sizes come from Figma (24, 28 for groups, 32, 40, 56) plus 64 for list rows
 * (§4.1). Initials are SemiBold at about 36% of the avatar, which Figma rounds
 * to whole pixels, on `bg-muted` (`background-surface-subtle`).
 *
 * `decorative` hides the avatar from assistive tech; use it when the name is
 * printed beside it. `anonymous` shows a person icon instead of initials, for
 * "Deleted user".
 */
const AVATAR_SIZES = {
  24: { box: "size-6", text: "text-[9px]", icon: "size-3" },
  28: { box: "size-7", text: "text-[10px]", icon: "size-3.5" },
  32: { box: "size-8", text: "text-xs", icon: "size-4" },
  40: { box: "size-10", text: "text-sm", icon: "size-5" },
  56: { box: "size-14", text: "text-xl", icon: "size-7" },
  64: { box: "size-16", text: "text-[23px]", icon: "size-8" },
} as const;

type AvatarSize = keyof typeof AVATAR_SIZES;

interface AvatarProps
  extends Omit<React.ComponentProps<typeof AvatarPrimitive.Root>, "children"> {
  /** Accessible label. Also the source of the initials. */
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** Person icon instead of initials. */
  anonymous?: boolean;
  /** `aria-hidden`, for when the name is printed beside the avatar. */
  decorative?: boolean;
}

const graphemes =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function firstGrapheme(word: string): string {
  if (graphemes) {
    for (const { segment } of graphemes.segment(word)) return segment;
  }
  return Array.from(word)[0] ?? "";
}

/** Up to two initials: the first letter of the first and last word. */
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = firstGrapheme(words[0]);
  const last = words.length > 1 ? firstGrapheme(words[words.length - 1]) : "";
  return (first + last).toLocaleUpperCase();
}

function Avatar({
  name,
  src,
  size = 40,
  anonymous = false,
  decorative = false,
  className,
  ...props
}: AvatarProps) {
  const dimensions = AVATAR_SIZES[size];
  const initials = anonymous ? "" : getInitials(name);

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": name })}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground select-none",
        dimensions.box,
        className,
      )}
      {...props}
    >
      {src ? (
        <AvatarPrimitive.Image
          data-slot="avatar-image"
          src={src}
          alt=""
          className="absolute inset-0 size-full object-cover object-[50%_20%]"
        />
      ) : null}
      <AvatarPrimitive.Fallback
        data-slot="avatar-fallback"
        aria-hidden
        delayMs={src ? 300 : undefined}
        className={cn(
          "flex size-full items-center justify-center font-semibold leading-none tracking-[-0.02em]",
          dimensions.text,
        )}
      >
        {initials ? (
          initials
        ) : (
          <UserRound className={dimensions.icon} aria-hidden />
        )}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

type GroupSize = 24 | 28 | 32 | 40;

interface AvatarGroupProps extends React.ComponentProps<"div"> {
  people: readonly { name: string; src?: string | null }[];
  /** Faces shown before the "+N" count. */
  max?: number;
  size?: GroupSize;
}

function describeGroup(names: readonly string[], hidden: number): string {
  const parts = [...names];
  if (hidden > 0) parts.push(`${hidden} ${hidden === 1 ? "other" : "others"}`);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Overlapping faces, then a "+N" count (§3.9). The group is one image labelled
 * with everyone's name ("Alex Chen, Sam Lee and 2 others"). Pair it with words
 * ("Team Pixel · 6 members") so the number is never only in the overflow.
 *
 * Each face carries a 2px `card` ring, drawn inside the avatar as Figma does,
 * so it blends into a card. It is the one place the group assumes a surface.
 */
function AvatarGroup({
  people,
  max = 4,
  size = 32,
  className,
  ...props
}: AvatarGroupProps) {
  const shown = people.slice(0, Math.max(0, max));
  const hidden = people.length - shown.length;
  if (people.length === 0) return null;

  return (
    <div
      data-slot="avatar-group"
      role="img"
      aria-label={describeGroup(
        shown.map((person) => person.name),
        hidden,
      )}
      className={cn("inline-flex shrink-0 items-center", className)}
      {...props}
    >
      <div
        className={cn("flex items-center", size === 24 ? "-space-x-1.5" : "-space-x-2")}
      >
        {shown.map((person, index) => (
          <Avatar
            key={`${person.name}-${index}`}
            name={person.name}
            src={person.src}
            size={size}
            decorative
            className="border-2 border-card"
          />
        ))}
      </div>
      {hidden > 0 ? (
        <span
          data-slot="avatar-group-count"
          aria-hidden
          className="ml-2 text-[13px] leading-[18px] text-muted-foreground"
        >
          +{hidden}
        </span>
      ) : null}
    </div>
  );
}

export { Avatar, AvatarGroup, getInitials };
export type { AvatarGroupProps, AvatarProps, AvatarSize };
