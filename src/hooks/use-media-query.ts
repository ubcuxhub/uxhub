import { useSyncExternalStore } from "react";

/** Asked for reduced motion in the OS. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/**
 * Motion is fine. Not just `!REDUCED_MOTION_QUERY`: this one is false during
 * the server render too, so motion gated on it starts off until the browser
 * confirms it.
 */
export const MOTION_OK_QUERY = "(prefers-reduced-motion: no-preference)";
/** A mouse or trackpad: something that hovers and points precisely. */
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

const canMatch = () => typeof window.matchMedia === "function";

/**
 * Whether `query` matches, kept live. False during the server render, where it
 * can't be known, so anything gated on it starts off; false too where the
 * browser has no `matchMedia`.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!canMatch()) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => canMatch() && window.matchMedia(query).matches,
    () => false,
  );
}
