"use client";

import { useLayoutEffect } from "react";

import {
  applyTheme,
  FORCED_LIGHT_PREVIOUS_ATTR,
  getThemeSnapshot,
  type Theme,
} from "@/lib/theme";

/**
 * Keeps a route in light mode and restores the user's theme when it unmounts.
 * Render `forceLightThemeScript` (from `@/lib/theme`) in the server layout too,
 * so the first paint is already light; this component covers soft navigation,
 * where inline scripts don't re-run.
 */
export function ForceLightTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = (root.getAttribute(FORCED_LIGHT_PREVIOUS_ATTR) ||
      getThemeSnapshot()) as Theme;

    applyTheme("light");

    return () => {
      applyTheme(previousTheme);
      root.removeAttribute(FORCED_LIGHT_PREVIOUS_ATTR);
    };
  }, []);

  return null;
}
