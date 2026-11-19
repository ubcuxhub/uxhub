"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TicketFlipProps {
  front: ReactNode;
  back: ReactNode;
  className?: string;
}

/**
 * Flips a ticket between its front (the code) and back (the logo) on click,
 * Enter or Space: a 600ms turn about the Y axis (`expressive`, `ease-out`, per
 * the ticket motion spec), or an instant swap under reduced motion.
 *
 * The control is a transparent button laid over the faces rather than wrapped
 * around them, since a button can't hold a ticket's headings and image. The
 * hidden face is `inert`, so only the visible one is read out or reachable.
 */
export function TicketFlip({ front, back, className }: TicketFlipProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className={cn("relative perspective-[1200px]", className)}>
      <div
        className={cn(
          "relative size-full transform-3d motion-safe:transition-transform motion-safe:duration-expressive motion-safe:ease-out",
          flipped && "motion-safe:rotate-y-180"
        )}
      >
        <div
          inert={flipped}
          className={cn(
            "absolute inset-0 backface-hidden",
            flipped && "motion-reduce:opacity-0"
          )}
        >
          {front}
        </div>
        <div
          inert={!flipped}
          className={cn(
            "absolute inset-0 backface-hidden motion-safe:rotate-y-180",
            !flipped && "motion-reduce:opacity-0"
          )}
        >
          {back}
        </div>
      </div>
      <button
        type="button"
        aria-label={flipped ? "Flip ticket to show QR code" : "Flip ticket to show UX Hub logo"}
        onClick={() => setFlipped((value) => !value)}
        className="absolute inset-0 cursor-pointer rounded-2xl focus-visible:focus-ring"
      />
    </div>
  );
}
