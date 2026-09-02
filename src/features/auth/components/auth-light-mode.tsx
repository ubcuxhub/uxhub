"use client";

import { useEffect } from "react";

import { applyTheme, type Theme } from "@/lib/theme";

export function AuthLightMode() {
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = (root.dataset.authPreviousTheme ||
      (root.classList.contains("dark") ? "dark" : "light")) as Theme;

    applyTheme("light");

    return () => {
      applyTheme(previousTheme);
      delete root.dataset.authPreviousTheme;
    };
  }, []);

  return null;
}