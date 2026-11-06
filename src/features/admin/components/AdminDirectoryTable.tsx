"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface AdminDirectoryColumn<T> {
  id: string;
  header: ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => ReactNode;
  /**
   * Holds the row's link when the table has `getRowHref`. The first column
   * does unless another one says so; pick the record's name.
   */
  rowLink?: boolean;
}

interface BaseProps<T> {
  columns: AdminDirectoryColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** The row's accessible name: "View details for Jane Smith". */
  getRowLabel: (row: T) => string;
  emptyMessage: string;
}

/**
 * Rows are links to each record's URL, a child route of the list that opens
 * in a drawer over it (`RecordFrame` in the list's layout); a new-tab click
 * opens the list with that record's drawer.
 */
interface AdminDirectoryTableProps<T> extends BaseProps<T> {
  getRowHref: (row: T) => string;
  /**
   * The list's own URL, e.g. `/admin/users`. While a record below it is open,
   * a row click replaces it, so Back returns to the list rather than walking
   * through every record looked at.
   */
  listHref: string;
}

const ROW =
  "border-b border-border-subtle transition-colors last:border-b-0 hover:bg-muted/30";

export function AdminDirectoryTable<T>(props: AdminDirectoryTableProps<T>) {
  const { columns, rows, emptyMessage } = props;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max text-small">
        <thead>
          <tr className="border-b border-border-subtle bg-muted/50">
            {columns.map((column) => (
              <th
                key={column.id}
                className={cn(
                  "px-4 py-3 text-left font-medium",
                  column.headerClassName
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <LinkRows {...props} />
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** The path part of an href, for comparing against `usePathname()`. */
function pathOf(href: string) {
  return href.split(/[?#]/, 1)[0].replace(/(.)\/$/, "$1");
}

function LinkRows<T>({
  columns,
  rows,
  getRowKey,
  getRowLabel,
  getRowHref,
  listHref,
}: AdminDirectoryTableProps<T>) {
  const pathname = usePathname();
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const lastActiveRef = useRef<string | null>(null);

  const list = pathOf(listHref);
  const recordOpen = pathname.startsWith(`${list}/`);
  const activeRow = rows.find((row) => pathOf(getRowHref(row)) === pathname);
  const activeKey = activeRow ? getRowKey(activeRow) : null;
  const linkColumn = columns.find((column) => column.rowLink) ?? columns[0];

  // When the open record closes, put focus back on its row, unless the
  // person has already moved it somewhere else on the page. Runs after the
  // drawer's own focus return (a timeout after unmount), which may have
  // picked the row that first opened the drawer rather than this one.
  useEffect(() => {
    if (activeKey) {
      lastActiveRef.current = activeKey;
      return;
    }
    const key = lastActiveRef.current;
    lastActiveRef.current = null;
    if (!key) return;
    let timeout = 0;
    const frame = requestAnimationFrame(() => {
      timeout = window.setTimeout(() => {
        const link = linkRefs.current.get(key);
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
  }, [activeKey]);

  return rows.map((row) => {
    const key = getRowKey(row);
    const active = key === activeKey;
    return (
      <tr
        key={key}
        data-record-row=""
        data-active={active || undefined}
        // The link below stretches over the whole row.
        className={cn(ROW, "relative data-[active]:bg-muted")}
      >
        {columns.map((column) => (
          <td key={column.id} className={cn("px-4 py-3", column.cellClassName)}>
            {column === linkColumn ? (
              <Link
                ref={(node) => {
                  if (node) linkRefs.current.set(key, node);
                  else linkRefs.current.delete(key);
                }}
                href={getRowHref(row)}
                replace={recordOpen}
                aria-label={getRowLabel(row)}
                aria-current={active ? "page" : undefined}
                className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
              >
                {column.render(row)}
              </Link>
            ) : (
              column.render(row)
            )}
          </td>
        ))}
      </tr>
    );
  });
}
