"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { DitherOverlay } from "@/components/shared/DitherOverlay";
import { FINE_POINTER_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/** The furthest the card leans at a corner (motion handoff, Home). */
const MAX_TILT_DEG = 4;

/**
 * The membership card's fill (its diagonal gradient under the shared dither
 * texture) and its hover tilt (Portal Motion handoff, Home, "Membership
 * card"): with a mouse, it tilts up to 4° toward the pointer and settles back
 * when the pointer leaves (`expressive`, `ease-expressive`). The approved
 * exception to "cards never lift". No tilt on touch or under reduced motion.
 *
 * The outer element measures the pointer and holds the perspective; only the
 * inner card turns, so its own tilt never skews the measurement.
 */
export function MembershipCardSurface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const finePointer = useMediaQuery(FINE_POINTER_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const canTilt = finePointer && !reducedMotion;

  useEffect(() => {
    const frame = frameRef.current;
    const card = cardRef.current;
    if (!frame || !card || !canTilt) return;
    let raf = 0;
    let x = 0;
    let y = 0;

    const apply = () => {
      raf = 0;
      // Lean so the point under the pointer dips away from the viewer.
      card.style.setProperty("--tilt-x", `${(-y * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${(x * 2 * MAX_TILT_DEG).toFixed(2)}deg`);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = frame.getBoundingClientRect();
      x = Math.min(0.5, Math.max(-0.5, (event.clientX - rect.left) / rect.width - 0.5));
      y = Math.min(0.5, Math.max(-0.5, (event.clientY - rect.top) / rect.height - 0.5));
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const reset = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      card.style.removeProperty("--tilt-x");
      card.style.removeProperty("--tilt-y");
    };

    frame.addEventListener("pointermove", onMove);
    frame.addEventListener("pointerleave", reset);
    return () => {
      frame.removeEventListener("pointermove", onMove);
      frame.removeEventListener("pointerleave", reset);
      reset();
    };
  }, [canTilt]);

  return (
    <div ref={frameRef} className={cn("perspective-distant", className)}>
      <section
        ref={cardRef}
        className={cn(
          // `isolate` keeps the dither's overlay blend to the card's own fill.
          "relative isolate overflow-hidden rounded-xl bg-membership-card text-white shadow-sm",
          // Figma's 492 × 309, growing taller when the content needs it. The
          // card clips its overflow (for the tilt and dither), which drops the
          // usual aspect-ratio minimum, so `min-h-fit` puts it back.
          "flex aspect-[492/309] min-h-fit flex-col",
          "transform-[rotateX(var(--tilt-x,0deg))_rotateY(var(--tilt-y,0deg))] transition-transform duration-expressive ease-expressive",
        )}
      >
        <DitherOverlay />
        <div className="relative flex flex-1 flex-col">{children}</div>
      </section>
    </div>
  );
}
