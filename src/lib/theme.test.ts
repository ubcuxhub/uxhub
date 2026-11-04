// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let prefersDark = false;

const root = () => document.documentElement;

async function loadTheme(darkMode: "true" | "false") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_FEATURE_DARK_MODE", darkMode);
  return import("./theme");
}

function runInitScript(script: string) {
  new Function(script)();
}

beforeEach(() => {
  root().removeAttribute("data-theme");
  root().className = "";
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") && prefersDark,
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  prefersDark = false;
});

describe("applyTheme and getThemeSnapshot", () => {
  it("sets data-theme for dark and removes it for light", async () => {
    const { applyTheme, getThemeSnapshot } = await loadTheme("true");

    applyTheme("dark");
    expect(root().getAttribute("data-theme")).toBe("dark");
    expect(getThemeSnapshot()).toBe("dark");

    applyTheme("light");
    expect(root().hasAttribute("data-theme")).toBe(false);
    expect(getThemeSnapshot()).toBe("light");
  });

  it("does not use the dark class", async () => {
    const { applyTheme } = await loadTheme("true");

    applyTheme("dark");
    expect(root().classList.contains("dark")).toBe(false);
  });
});

describe("themeInitScript", () => {
  it("applies the stored theme when dark mode is enabled", async () => {
    const { themeInitScript, THEME_STORAGE_KEY } = await loadTheme("true");

    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    runInitScript(themeInitScript);
    expect(root().getAttribute("data-theme")).toBe("dark");

    localStorage.setItem(THEME_STORAGE_KEY, "light");
    runInitScript(themeInitScript);
    expect(root().hasAttribute("data-theme")).toBe(false);
  });

  it("falls back to the system preference without a stored choice", async () => {
    const { themeInitScript } = await loadTheme("true");

    prefersDark = true;
    runInitScript(themeInitScript);
    expect(root().getAttribute("data-theme")).toBe("dark");
  });

  it("forces light and clears the stored choice when dark mode is disabled", async () => {
    const { themeInitScript, THEME_STORAGE_KEY } = await loadTheme("false");

    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    root().setAttribute("data-theme", "dark");
    runInitScript(themeInitScript);

    expect(root().hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
