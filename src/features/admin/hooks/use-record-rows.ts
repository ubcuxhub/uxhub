"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** The path part of an href, without a trailing slash. */
function pathOf(href: string) {
  return href.split(/[?#]/, 1)[0].replace(/(.)\/$/, "$1");
}

/**
 * Wires an admin list's `TableRowLink`s to the record drawer (`RecordFrame`
 * in the list's layout), where each row links to a record that is a child
 * route of the list:
 *
 * - The open record's row is marked (`aria-current="page"` on its link,
 *   `data-active` on its row).
 * - While a record is open, a row click replaces it, so Back returns to the
 *   list rather than walking through every record looked at.
 * - When the record closes, focus goes back to its row, unless the person has
 *   already moved it somewhere else on the page.
 *
 * ```tsx
 * const records = useRecordRows("/admin/users");
 * <TableRow {...records.rowProps(href)}>
 *   <TableCell><TableRowLink {...records.linkProps(href)}>Dora</TableRowLink></TableCell>
 * ```
 */
export function useRecordRows(listHref: string) {
  const pathname = usePathname();
  const list = pathOf(listHref);
  const recordOpen = pathname.startsWith(`${list}/`);
  const activePath = recordOpen ? pathOf(pathname) : null;

  const links = useRef(new Map<string, HTMLAnchorElement>());
  const lastActive = useRef<string | null>(null);

  // Runs after the drawer's own focus return (a timeout after unmount), which
  // may have picked the row that first opened the drawer rather than this one.
  useEffect(() => {
    if (activePath) {
      lastActive.current = activePath;
      return;
    }
    const path = lastActive.current;
    lastActive.current = null;
    if (!path) return;
    let timeout = 0;
    const frame = requestAnimationFrame(() => {
      timeout = window.setTimeout(() => {
        const link = links.current.get(path);
        // Not on this page of the list (paged away while it was open).
        if (!link?.isConnected) return;
        const active = document.activeElement;
        const table = link.closest("table");
        const lost =
          !active ||
          active === document.body ||
          Boolean(table?.contains(active)) ||
          Boolean(active.closest('[data-slot="side-peek-drawer-content"]'));
        if (lost) link.focus({ preventScroll: true });
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [activePath]);

  const isActive = (href: string) => pathOf(href) === activePath;

  return {
    /** The open record's path, or null on the list. */
    activePath,
    /** Spread on the row's `TableRow`. */
    rowProps: (href: string) => ({
      "data-record-row": "",
      "data-active": isActive(href) || undefined,
    }),
    /** Spread on the row's `TableRowLink`. */
    linkProps: (href: string) => {
      const path = pathOf(href);
      return {
        href,
        replace: recordOpen,
        "aria-current": isActive(href) ? ("page" as const) : undefined,
        ref: (node: HTMLAnchorElement | null) => {
          if (node) links.current.set(path, node);
          else links.current.delete(path);
        },
      };
    },
  };
}
