import { useSyncExternalStore } from "react";

/** Asked for reduced motion in the OS. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** A mouse or trackpad: something that hovers and points precisely. */
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

/**
 * Whether `query` matches, kept live. False during the server render, where it
 * can't be known, so anything gated on it starts off.
 */
export function useMediaQuery(query: string): boolean {
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
