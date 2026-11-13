"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";

import { BRAND_SHAPES } from "./brand-shapes";
import "./auth-shell.css";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** A mouse or trackpad: something that hovers and points precisely. */
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function useDocumentHidden() {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    },
    () => document.hidden,
    () => false,
  );
}

/**
 * Decorative motion for the auth brand panel (§2.8, "Ambient brand motion"):
 * the shape tiles fall once and settle on the ease-out curve, then sway
 * slowly; a soft glow trails a mouse pointer over the panel.
 *
 * - Reduced motion shows the settled pile and no glow.
 * - The glow needs a fine, hovering pointer; touch screens get none.
 * - Everything pauses while the tab is hidden.
 *
 * Fills its positioned parent and listens for the pointer on that parent, so
 * the panel's own content (the logo link) stays clickable above it.
 */
export function BrandMotion() {
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  const finePointer = useMediaQuery(FINE_POINTER_QUERY);
  const hidden = useDocumentHidden();

  return (
    <div
      aria-hidden
      data-slot="brand-motion"
      data-motion={reduced ? "reduce" : "full"}
      data-paused={hidden ? "" : undefined}
      className="auth-brand-motion pointer-events-none absolute inset-0 overflow-hidden"
    >
      {finePointer && !reduced ? <CursorGlow paused={hidden} /> : null}

      <div className="auth-shapes absolute inset-0">
        {BRAND_SHAPES.map((shape, index) => (
          <div
            key={shape.name}
            data-shape={shape.name}
            className="auth-shape"
            style={
              {
                "--shape-left": shape.left,
                "--shape-bottom": shape.bottom,
                "--shape-tilt": `${shape.tilt}deg`,
                "--shape-delay": `${shape.delay}ms`,
                "--shape-drift": `${shape.drift}ms`,
                "--shape-sway": `${index % 2 ? 1 : -1}deg`,
              } as CSSProperties
            }
          >
            {/* Plain img: six tiny static tiles that must paint with the
                server HTML so the fall starts on first paint. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shape.src} alt="" width={128} height={128} draggable={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

const GLOW_COPIES = [
  { scale: 1, opacity: 1 },
  { scale: 0.9, opacity: 0.65 },
  { scale: 0.8, opacity: 0.55 },
  { scale: 0.7, opacity: 0.45 },
  { scale: 0.6, opacity: 0.35 },
  { scale: 0.5, opacity: 0.25 },
] as const;
const GLOW_RADIUS = 80;
/** Share of the gap the lead glow closes per 60fps frame: it eases, not snaps. */
const LEAD_EASE = 0.16;
/** Share each trailing copy closes toward the one ahead of it. */
const TRAIL_EASE = 0.38;

/** A white radial glow with five fading copies trailing the pointer. */
function CursorGlow({ paused }: { paused: boolean }) {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const panel = layer?.parentElement?.parentElement;
    if (!layer || !panel || paused) return;

    const dots = Array.from(layer.children) as HTMLElement[];
    const points = dots.map(() => ({ x: 0, y: 0 }));
    const target = { x: 0, y: 0 };
    let frame = 0;
    let last = 0;

    const paint = () => {
      dots.forEach((dot, i) => {
        const { x, y } = points[i];
        dot.style.transform = `translate3d(${x - GLOW_RADIUS}px, ${y - GLOW_RADIUS}px, 0) scale(${GLOW_COPIES[i].scale})`;
      });
    };

    const step = (now: number) => {
      // Frame-rate independent: a 120Hz screen takes two half-steps.
      const frames = last ? Math.min((now - last) / (1000 / 60), 4) : 1;
      last = now;
      const lead = 1 - (1 - LEAD_EASE) ** frames;
      const trail = 1 - (1 - TRAIL_EASE) ** frames;
      let moving = false;
      points.forEach((point, i) => {
        const goal = i === 0 ? target : points[i - 1];
        const ease = i === 0 ? lead : trail;
        point.x += (goal.x - point.x) * ease;
        point.y += (goal.y - point.y) * ease;
        if (Math.abs(goal.x - point.x) + Math.abs(goal.y - point.y) > 0.2) moving = true;
      });
      paint();
      frame = moving ? requestAnimationFrame(step) : 0;
      if (!moving) last = 0;
    };

    const locate = (event: PointerEvent) => {
      const rect = panel.getBoundingClientRect();
      target.x = event.clientX - rect.left;
      target.y = event.clientY - rect.top;
    };

    const onEnter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      locate(event);
      // Start the trail where the pointer came in, not from the corner.
      points.forEach((point) => Object.assign(point, target));
      paint();
      layer.style.opacity = "1";
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      locate(event);
      if (layer.style.opacity !== "1") onEnter(event);
      if (!frame) frame = requestAnimationFrame(step);
    };

    const onLeave = () => {
      layer.style.opacity = "0";
    };

    panel.addEventListener("pointerenter", onEnter);
    panel.addEventListener("pointermove", onMove);
    panel.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      panel.removeEventListener("pointerenter", onEnter);
      panel.removeEventListener("pointermove", onMove);
      panel.removeEventListener("pointerleave", onLeave);
      layer.style.opacity = "0";
    };
  }, [paused]);

  return (
    <div
      ref={layerRef}
      data-slot="cursor-glow"
      className="auth-glow absolute inset-0"
      style={{ opacity: 0 }}
    >
      {GLOW_COPIES.map((copy, i) => (
        <div key={i} style={{ opacity: copy.opacity }} />
      ))}
    </div>
  );
}
