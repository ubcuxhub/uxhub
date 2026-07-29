export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "uxhub-theme";

/** Toggle the `dark` class on <html> to reflect the given theme. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
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
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Server render always assumes light; the client reconciles after hydration. */
export function getThemeServerSnapshot(): Theme {
  return "light";
}

/**
 * Inline script that applies the stored (or system-preferred) theme before
 * first paint, avoiding a flash of the wrong theme. Injected in the root layout.
 */
export const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var d=(s==="dark"||s==="light")?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
