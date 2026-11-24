import { useMediaQuery } from "@/hooks/use-media-query";

/** Whether the viewport is narrower than `breakpoint` px, kept live. */
export function useIsMobile(breakpoint = 768) {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}
