import Image, { type StaticImageData } from "next/image";

import { cn } from "@/lib/utils";

import curious from "@/assets/hubbo/curious.png";
import excited from "@/assets/hubbo/excited.png";
import proud from "@/assets/hubbo/proud.png";
import resting from "@/assets/hubbo/resting.png";
import thinking from "@/assets/hubbo/thinking.png";
import welcoming from "@/assets/hubbo/welcoming.png";
import curiousHead from "@/assets/hubbo/head-only/curious.png";
import excitedHead from "@/assets/hubbo/head-only/excited.png";
import proudHead from "@/assets/hubbo/head-only/proud.png";
import restingHead from "@/assets/hubbo/head-only/resting.png";
import thinkingHead from "@/assets/hubbo/head-only/thinking.png";
import welcomingHead from "@/assets/hubbo/head-only/welcoming.png";

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
 * The artwork, one entry per emotion (§5.2). `full` is the full-colour body,
 * used at hero and card sizes; `head` is the head-only set for inline and head
 * sizes. A full body is never cropped to stand in for a head.
 */
export const HUBBO_ART: Partial<
  Record<HubboEmotion, { full?: StaticImageData; head?: StaticImageData }>
> = {
  welcoming: { full: welcoming, head: welcomingHead },
  curious: { full: curious, head: curiousHead },
  excited: { full: excited, head: excitedHead },
  proud: { full: proud, head: proudHead },
  thinking: { full: thinking, head: thinkingHead },
  resting: { full: resting, head: restingHead },
};

/**
 * Height in px for each slot (§5.2 "By surface"). Art is sized by height so
 * every pose keeps its own aspect ratio (Resting is wider than tall); the
 * placeholder is a square of the same height.
 */
const SIZES: Record<
  HubboSize,
  { px: number; art: string; box: string; head: boolean }
> = {
  hero: { px: 240, art: "h-60", box: "size-60", head: false },
  card: { px: 120, art: "h-30", box: "size-30", head: false },
  inline: { px: 32, art: "h-8", box: "size-8", head: true },
  head: { px: 40, art: "h-10", box: "size-10", head: true },
};

interface HubboProps {
  emotion: HubboEmotion;
  /**
   * hero 240px (sign-up complete), card 120px (an empty state), inline 32px
   * (a form tip, head art) and head 40px. Defaults to `card`.
   */
  size?: HubboSize;
  className?: string;
  /**
   * Decorative by default (`alt=""`, `aria-hidden`): Hubbo adds a line on top
   * of the copy and never replaces a heading, button or status. Pass `alt` only
   * when the illustration carries meaning the surrounding text doesn't.
   */
  alt?: string;
}

/**
 * The UX Hub mascot.
 *
 * Use at most one per screen, and never on payments, checkout, receipts,
 * refunds, private information (profiles, settings) or rejections. It fits
 * welcomes, inviting empty states, form tips, confirmations and errors.
 *
 * If a slot has no art, it renders nothing in production and a dashed
 * placeholder in development.
 */
export function Hubbo({ emotion, size = "card", className, alt }: HubboProps) {
  const slot = SIZES[size];
  const art = HUBBO_ART[emotion];
  const src = slot.head ? art?.head : art?.full;

  if (src) {
    return (
      <Image
        src={src}
        alt={alt ?? ""}
        aria-hidden={alt ? undefined : true}
        className={cn("w-auto max-w-full shrink-0 object-contain", slot.art, className)}
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
        slot.box,
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
