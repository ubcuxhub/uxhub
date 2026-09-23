"use client";

import { useEffect, type RefObject } from "react";
import { useRouter } from "next/navigation";

const UNSAVED_CHANGES_MESSAGE =
  "Changes may not be saved. Are you sure you want to leave?";

export function useUnsavedChangesGuard(
  hasUnsavedChanges: boolean,
  bypassWarning: RefObject<boolean>
) {
  const router = useRouter();

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassWarning.current) return;
      event.preventDefault();
      event.returnValue = UNSAVED_CHANGES_MESSAGE;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [bypassWarning, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleDocumentClick = (event: MouseEvent) => {
      if (bypassWarning.current || event.defaultPrevented || event.button !== 0)
        return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      event.preventDefault();
      event.stopPropagation();
      if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) return;
      bypassWarning.current = true;
      if (anchor.origin === window.location.origin) {
        router.push(`${anchor.pathname}${anchor.search}${anchor.hash}`);
      } else {
        window.location.assign(anchor.href);
      }
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleDocumentClick, {
        capture: true,
      });
  }, [bypassWarning, hasUnsavedChanges, router]);
}
