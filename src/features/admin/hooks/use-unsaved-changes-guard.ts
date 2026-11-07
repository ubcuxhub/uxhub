"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";

/** Native unload protection remains for tab close and cross-document history. */
export function useUnsavedChangesGuard(dirty: boolean, bypassRef: RefObject<boolean>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const request = (navigate: () => void) => {
    if (bypassRef.current || !dirty) { navigate(); return; }
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pending.current = navigate;
    setOpen(true);
  };
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (bypassRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (bypassRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return;
      event.preventDefault(); event.stopPropagation();
      opener.current = anchor;
      pending.current = () => url.origin === location.origin ? router.push(`${url.pathname}${url.search}${url.hash}`) : location.assign(url.href);
      setOpen(true);
    };
    // Traversal is cancellable only in browsers/entries that support it.
    // Other same-document history entries have no safe App Router blocker;
    // do not rewrite history or claim that beforeunload covers those entries.
    const navigation = (window as Window & { navigation?: EventTarget & { traverseTo: (key: string) => unknown } }).navigation;
    const traverse = (raw: Event) => {
      const event = raw as Event & { navigationType: string; destination: { url: string; key: string } };
      if (bypassRef.current || !event.cancelable || event.navigationType !== "traverse") return;
      const url = new URL(event.destination.url);
      if (url.pathname === location.pathname && url.search === location.search) return;
      event.preventDefault();
      pending.current = () => navigation?.traverseTo(event.destination.key);
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };
    navigation?.addEventListener("navigate", traverse);
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { navigation?.removeEventListener("navigate", traverse); window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty, bypassRef, router]);
  return {
    open, opener, request,
    cancel: () => { pending.current = null; setOpen(false); },
    leave: () => { bypassRef.current = true; const navigate = pending.current; pending.current = null; setOpen(false); navigate?.(); },
  };
}
