import { cn } from "@/lib/utils";

/**
 * The dither texture on the ticket, the membership card and the featured event
 * card (design system Ticket, "Dither" layer): a 16 × 16 Bayer tile with 8
 * grey levels, repeated at its own size (one cell per pixel, as Figma renders
 * it), blended `overlay` at 14% over whatever fill sits below.
 *
 * Fills its positioned parent, between the fill and the content. Static and
 * decorative: hidden from assistive tech and pointer events, unaffected by
 * reduced motion, and hidden in forced-colours mode. Pure CSS, so a parent's
 * tilt, spin or flip never redraws it.
 */
export function DitherOverlay({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      data-slot="dither-overlay"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] bg-[url(/textures/dither.png)] bg-size-[16px_16px] bg-repeat opacity-14 mix-blend-overlay [image-rendering:pixelated] forced-colors:hidden",
        className,
      )}
    />
  );
}
