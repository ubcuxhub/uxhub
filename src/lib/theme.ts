import { FLAGS } from "@/lib/flags";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "uxhub-theme";

/** Set `data-theme="dark"` on <html> for dark, or remove it for light. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
}

/** Read a persisted theme choice, or null if none/invalid. */
export function getStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

/** Persist the choice, apply it immediately, and notify subscribers. */
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage failures (e.g. private mode)
  }
  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

/** Subscribe to theme changes (in-tab toggles and cross-tab storage events). */
export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current theme from the live DOM (source of truth, set by the init script). */
export function getThemeSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/** Server render always assumes light; the client reconciles after hydration. */
export function getThemeServerSnapshot(): Theme {
  return "light";
}

const enabledInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var d=(s==="dark"||s==="light")?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;if(d)r.setAttribute("data-theme","dark");else r.removeAttribute("data-theme");}catch(e){}})();`;

// With dark mode off we must actively force light rather than simply skip the
// script: anyone who already toggled dark has it in localStorage, and everyone
// else is subject to `prefers-color-scheme`. Clearing the key also means they
// don't silently snap back to dark whenever the flag is turned on again.
const disabledInitScript = `(function(){try{document.documentElement.removeAttribute("data-theme");localStorage.removeItem("${THEME_STORAGE_KEY}");}catch(e){}})();`;

/**
 * Inline script that applies the stored (or system-preferred) theme before
 * first paint, avoiding a flash of the wrong theme. Injected in the root layout.
 */
export const themeInitScript = FLAGS.darkMode
  ? enabledInitScript
  : disabledInitScript;

/** `data-*` attribute that remembers the theme to restore after a forced-light route. */
export const FORCED_LIGHT_PREVIOUS_ATTR = "data-previous-theme";

/**
 * Inline script for routes that always render light (auth, marketing). It
 * remembers the live theme, then clears it before first paint so there is no
 * flash of dark. `ForceLightTheme` restores the remembered theme on leaving.
 */
export const forceLightThemeScript = `(function(){try{var r=document.documentElement;r.setAttribute("${FORCED_LIGHT_PREVIOUS_ATTR}",r.getAttribute("data-theme")==="dark"?"dark":"light");r.removeAttribute("data-theme");}catch(e){}})();`;
