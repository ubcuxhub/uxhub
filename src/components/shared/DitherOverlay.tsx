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
 *
 * `reflective` (off by default; only the membership card turns it on) adds a
 * glint: a white highlight, `color-dodge`, that shows only through the dither
 * cells. Its mask (`dither-mask.png`) is the same tile, every cell doubled so
 * it stays sharp at 2x: the darker half of the cells (grey 0 to 109) stay
 * dark, and the lighter half glint at 70%, 77%, 83% and 90% by grey level, the
 * range of the membership card back's dither mask. The parent places and
 * fades it with `--shine-x`, `--shine-y` and `--glint-intensity`.
 */
export function DitherOverlay({
  className,
  reflective = false,
}: {
  className?: string;
  reflective?: boolean;
}) {
  return (
    <>
      <div
        aria-hidden
        data-slot="dither-overlay"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] bg-[url(/textures/dither.png)] bg-size-[16px_16px] bg-repeat opacity-14 mix-blend-overlay [image-rendering:pixelated] forced-colors:hidden",
          className,
        )}
      />
      {reflective ? (
        <div
          aria-hidden
          data-slot="dither-glint"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-color-dodge [image-rendering:pixelated] forced-colors:hidden",
            "bg-[radial-gradient(circle_at_var(--shine-x,50%)_var(--shine-y,50%),white,transparent_35%)] opacity-(--glint-intensity,1)",
            "mask-[url(/textures/dither-mask.png)] mask-size-[16px_16px] mask-repeat",
            className,
          )}
        />
      ) : null}
    </>
  );
}
