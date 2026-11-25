"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { DitherOverlay } from "@/components/shared/DitherOverlay";
import { FINE_POINTER_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { attachCardMotion, CARD } from "./membership-card-motion";
import "./membership-card.css";

/** The light's tuning, handed to membership-card.css. */
const SHINE_STYLE = {
  "--shine-travel": CARD.SHINE_TRAVEL,
  "--sheen-opacity": CARD.SHEEN_OPACITY,
  "--front-sheen-opacity": CARD.FRONT_SHEEN_OPACITY,
  "--glint-opacity": CARD.GLINT_OPACITY,
} as CSSProperties;

/**
 * The membership card's surface: its diagonal gradient under the shared dither
 * texture, and a card you can play with (Portal Motion handoff, Home,
 * "Membership card"; the 3D membership card PRD). With a mouse or trackpad it
 * tilts up to 4° toward the pointer, dips 3° further where it's pressed, and
 * spins about its vertical axis when dragged sideways, with slight inertia and
 * a snap to the nearest face. Left on its back, it turns home after two
 * seconds. A sheen and a glint on the dither cells follow the turn.
 *
 * Fully static on touch (for now) and under reduced motion: no tilt, spin or
 * shine, and the back is never drawn.
 *
 * The outer element measures the pointer and holds the perspective; only the
 * card inside it turns, so its own tilt never skews the measurement. The
 * front's content stays real, selectable text; the back is decorative.
 */
export function MembershipCardSurface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const finePointer = useMediaQuery(FINE_POINTER_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const interactive = finePointer && !reducedMotion;

  useEffect(() => {
    const frame = frameRef.current;
    const card = cardRef.current;
    if (!frame || !card || !interactive) return;
    return attachCardMotion(frame, card);
  }, [interactive]);

  return (
    <div
      ref={frameRef}
      className={cn("@container perspective-distant", className)}
      style={interactive ? SHINE_STYLE : undefined}
    >
      <div
        ref={cardRef}
        data-slot="membership-card"
        className="membership-card relative data-dragging:cursor-grabbing data-dragging:select-none"
      >
        <section
          className={cn(
            // `isolate` keeps the dither's overlay blend to the card's own fill.
            "membership-card-face membership-card-front relative isolate overflow-hidden rounded-xl bg-membership-card text-white shadow-sm",
            // At least Figma's 492 × 309 shape (a minimum height from the frame's
            // width), and taller whenever the content needs it, so nothing is
            // clipped on narrow screens. Not `aspect-ratio`: with the overflow
            // clipped (for the dither and shine) it holds the shape and crops.
            "flex min-h-[calc(100cqw*309/492)] flex-col",
          )}
        >
          <DitherOverlay reflective={interactive} />
          {interactive ? <span aria-hidden className="membership-card-sheen" /> : null}
          <div className="relative flex flex-1 flex-col">{children}</div>
        </section>

        {interactive ? (
          // The back (D3): the reversed gradient, the soft-block dither and the mark.
          <div
            aria-hidden
            data-slot="membership-card-back"
            className="membership-card-face membership-card-back absolute inset-0 isolate flex items-center justify-center overflow-hidden rounded-xl shadow-sm"
          >
            <span className="membership-card-back-dither" />
            <span className="membership-card-back-glint" />
            <span className="membership-card-sheen" />
            {/* The front's mark; its 1000-unit box pads the mark, so 60px draws it 44px wide. */}
            <Image
              src="/icons/icon-light.svg"
              alt=""
              width={60}
              height={60}
              draggable={false}
              className="relative size-15"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
