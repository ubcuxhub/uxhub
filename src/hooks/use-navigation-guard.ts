"use client";

import { useCallback, useEffect, useRef } from "react";

interface NavigationGuardOptions {
  /** Guard only while this is true, e.g. while a form has unsaved changes. */
  when: boolean;
  /**
   * A plain click on a link to another page of this app was held back. Ask
   * the person, then navigate to `href` yourself (after `release()`).
   */
  onBlocked: (href: string) => void;
}

interface NavigationGuard {
  /**
   * Stop guarding until `when` next turns true, so a navigation the person has
   * already confirmed (including a full reload) is not asked about twice.
   */
  release: () => void;
}

/**
 * Whether a click on `anchor` is a same-tab navigation to another page of this
 * app: the kind the guard holds back. New-tab clicks, downloads, other origins
 * (the browser's own `beforeunload` prompt covers those) and links to this
 * same page (a hash, or the current URL) are left alone, as is a link marked
 * `data-navigation-guard="ignore"` because it asks for itself.
 */
function blockedHref(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const target = event.target instanceof Element ? event.target : null;
  const anchor = target?.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.hasAttribute("download")) return null;
  if (anchor.dataset.navigationGuard === "ignore") return null;
  const frame = anchor.getAttribute("target");
  if (frame && frame !== "_self") return null;

  const url = new URL(anchor.href, window.location.href);
  const here = window.location;
  if (url.origin !== here.origin) return null;
  if (url.pathname === here.pathname && url.search === here.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Holds back leaving the page while `when` is true: the browser's "Leave
 * site?" prompt on reload, close and typed URLs (`beforeunload`), and an
 * in-app prompt (`onBlocked`) for link clicks anywhere on the page, Next
 * `Link`s included. The click listener runs in the capture phase, before
 * `Link` sees the click, and prevents it, which `Link` respects.
 *
 * Browser Back can't be held back: it changes the URL before anything here
 * hears about it.
 */
export function useNavigationGuard({ when, onBlocked }: NavigationGuardOptions): NavigationGuard {
  const releasedRef = useRef(false);
  const onBlockedRef = useRef(onBlocked);

  useEffect(() => {
    onBlockedRef.current = onBlocked;
  }, [onBlocked]);

  useEffect(() => {
    if (!when) return;
    releasedRef.current = false;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (releasedRef.current) return;
      event.preventDefault();
      // Older browsers only prompt when returnValue is set.
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (releasedRef.current) return;
      const href = blockedHref(event);
      if (!href) return;
      event.preventDefault();
      onBlockedRef.current(href);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [when]);

  const release = useCallback(() => {
    releasedRef.current = true;
  }, []);

  return { release };
}
