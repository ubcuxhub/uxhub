import { cn } from "@/lib/utils";

/**
 * The sheen on a live ticket (Figma "Ticket motion · Reference", Sheen): a
 * white band, 45% of the ticket wide and tilted 18°, sweeps left to right
 * (0 → 35% → 0 white) in the first two seconds of a five-second loop, then
 * rests off the ticket. A fixed gloss sits in the top-left corner.
 *
 * Under reduced motion the band stays still at 40% across, at 60% opacity.
 * It sits above the dither and below the code and text, so the code stays
 * scannable. Fills its positioned, clipped parent.
 */
export function TicketSheen({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      data-slot="ticket-sheen"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <span className="absolute -inset-y-1/4 left-0 w-[45%] animate-ticket-sheen bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.35),transparent)] motion-reduce:animate-none motion-reduce:opacity-60 motion-reduce:transform-[translateX(88.89%)_rotate(18deg)]" />
      <span className="absolute inset-0 bg-[linear-gradient(135deg,rgb(255_255_255/0.22),transparent_45%)]" />
    </div>
  );
}
