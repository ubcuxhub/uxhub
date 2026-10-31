import Image, { type StaticImageData } from "next/image";

import { cn } from "@/lib/utils";

export type HubboEmotion =
  | "welcoming"
  | "curious"
  | "excited"
  | "proud"
  | "thinking"
  | "resting";

export const HUBBO_EMOTIONS: readonly HubboEmotion[] = [
  "welcoming",
  "curious",
  "excited",
  "proud",
  "thinking",
  "resting",
];

export type HubboSize = "hero" | "card" | "inline" | "head";

/**
 * The master artwork, one entry per emotion once the illustrator delivers it
 * (§5.2). `full` is the full-colour body; `head` is the head-only set used
 * below 64px. Import the files and add them here; nothing else changes.
 */
export const HUBBO_ART: Partial<
  Record<HubboEmotion, { full?: StaticImageData; head?: StaticImageData }>
> = {};

/** Pixel size and Tailwind class for each slot (§5.2 "By surface"). */
const SIZES: Record<HubboSize, { px: number; className: string; head: boolean }> = {
  hero: { px: 240, className: "size-60", head: false },
  card: { px: 120, className: "size-30", head: false },
  inline: { px: 32, className: "size-8", head: true },
  head: { px: 40, className: "size-10", head: true },
};

interface HubboProps {
  emotion: HubboEmotion;
  /**
   * hero 240px (sign-up complete), card 120px (an empty state), inline 32px
   * (a form tip, head art) and head 40px. Defaults to `card`.
   */
  size?: HubboSize;
  className?: string;
}

/**
 * The UX Hub mascot, always decorative (`alt=""`, `aria-hidden`): Hubbo adds a
 * line on top of the copy and never replaces a heading, button or status.
 *
 * Use at most one per screen, and never on payments, checkout, receipts,
 * refunds, private information (profiles, settings) or rejections. It fits
 * welcomes, inviting empty states, form tips, confirmations and errors.
 *
 * Until the artwork exists it renders nothing in production, and in
 * development a dashed placeholder naming the emotion at the slot's size, so a
 * layout can be built now and the art dropped into `HUBBO_ART` later.
 */
export function Hubbo({ emotion, size = "card", className }: HubboProps) {
  const slot = SIZES[size];
  const art = HUBBO_ART[emotion];
  const src = slot.head ? (art?.head ?? art?.full) : (art?.full ?? art?.head);

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        aria-hidden
        width={slot.px}
        height={slot.px}
        className={cn("shrink-0 object-contain", slot.className, className)}
      />
    );
  }

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      aria-hidden
      data-slot="hubbo-placeholder"
      title={`Hubbo · ${emotion} · ${slot.px}px`}
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted text-center text-xs text-muted-foreground",
        slot.className,
        className,
      )}
    >
      {slot.px >= 120 ? (
        <>
          <span>Hubbo · {emotion}</span>
          <span>{slot.px}px</span>
        </>
      ) : (
        <span>H</span>
      )}
    </div>
  );
}
