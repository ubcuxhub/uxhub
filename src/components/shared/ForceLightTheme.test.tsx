// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  FORCED_LIGHT_PREVIOUS_ATTR,
  forceLightThemeScript,
} from "@/lib/theme";

import { ForceLightTheme } from "./ForceLightTheme";

const root = () => document.documentElement;

beforeEach(() => {
  root().removeAttribute("data-theme");
  root().removeAttribute(FORCED_LIGHT_PREVIOUS_ATTR);
});

afterEach(cleanup);

describe("forceLightThemeScript", () => {
  it("clears a dark theme before paint and remembers it", () => {
    root().setAttribute("data-theme", "dark");
    new Function(forceLightThemeScript)();
    expect(root().hasAttribute("data-theme")).toBe(false);
    expect(root().getAttribute(FORCED_LIGHT_PREVIOUS_ATTR)).toBe("dark");
  });

  it("remembers light when the page was already light", () => {
    new Function(forceLightThemeScript)();
    expect(root().getAttribute(FORCED_LIGHT_PREVIOUS_ATTR)).toBe("light");
  });
});

describe("ForceLightTheme", () => {
  it("restores the theme the script remembered when it unmounts", () => {
    root().setAttribute("data-theme", "dark");
    new Function(forceLightThemeScript)();

    const { unmount } = render(<ForceLightTheme />);
    expect(root().hasAttribute("data-theme")).toBe(false);

    unmount();
    expect(root().getAttribute("data-theme")).toBe("dark");
    expect(root().hasAttribute(FORCED_LIGHT_PREVIOUS_ATTR)).toBe(false);
  });

  it("falls back to the live theme on soft navigation, when no script ran", () => {
    root().setAttribute("data-theme", "dark");

    const { unmount } = render(<ForceLightTheme />);
    expect(root().hasAttribute("data-theme")).toBe(false);

    unmount();
    expect(root().getAttribute("data-theme")).toBe("dark");
  });

  it("leaves a light theme light on unmount", () => {
    const { unmount } = render(<ForceLightTheme />);
    unmount();
    expect(root().hasAttribute("data-theme")).toBe(false);
  });
});
