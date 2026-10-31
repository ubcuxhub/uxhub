"use client";

import { useEffect } from "react";

import { applyTheme, getThemeSnapshot, type Theme } from "@/lib/theme";

export function AuthLightMode() {
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = (root.dataset.authPreviousTheme ||
      getThemeSnapshot()) as Theme;

    applyTheme("light");

    return () => {
      applyTheme(previousTheme);
      delete root.dataset.authPreviousTheme;
    };
  }, []);

  return null;
}
