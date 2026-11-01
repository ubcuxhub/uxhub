"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TableToolbarProps {
  /** `<SearchField … />`; fills the width the actions leave. */
  search: React.ReactNode;
  /** Default mode, right side: "Sort and filter". */
  actions?: React.ReactNode;
  /** Above 0, swaps `actions` for the count, `bulkActions` and Clear selection. */
  selectedCount?: number;
  /** E.g. `<Button variant="secondary" size="sm"><Download />Export to CSV</Button>`. */
  bulkActions?: React.ReactNode;
  onClearSelection?: () => void;
  className?: string;
}

const FOCUSABLE = "button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";

/**
 * The bar above an admin table (§3.16). Search always fills the row; the right
 * side is "Sort and filter" until rows are selected, then "2 selected", the
 * bulk actions and Clear selection.
 *
 * The count is announced from a live region that stays mounted, so the first
 * tick is read as well as the later ones. When the selection empties and
 * focus was left on nothing (the Clear button unmounted), focus moves to the
 * first of `actions`, or else the search field.
 */
function TableToolbar({
  search,
  actions,
  selectedCount = 0,
  bulkActions,
  onClearSelection,
  className,
}: TableToolbarProps) {
  const selecting = selectedCount > 0;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const wasSelecting = React.useRef(selecting);

  React.useEffect(() => {
    const was = wasSelecting.current;
    wasSelecting.current = selecting;
    if (!was || selecting) return;

    const active = document.activeElement;
    if (active && active !== document.body) return;

    const root = rootRef.current;
    const target =
      root?.querySelector<HTMLElement>(`[data-slot=table-toolbar-actions] :is(${FOCUSABLE})`) ??
      root?.querySelector<HTMLElement>("input");
    target?.focus();
  }, [selecting]);

  return (
    <div
      ref={rootRef}
      data-slot="table-toolbar"
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}
    >
      <div className="min-w-0 flex-1">{search}</div>
      <p role="status" className="sr-only">
        {selecting ? `${selectedCount} selected` : ""}
      </p>
      {selecting ? (
        <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:flex-nowrap">
          <p
            aria-hidden
            className="text-body text-foreground tabular-nums sm:whitespace-nowrap"
          >
            {selectedCount} selected
          </p>
          {bulkActions}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClearSelection}
          >
            <X aria-hidden />
            Clear selection
          </Button>
        </div>
      ) : actions ? (
        <div
          data-slot="table-toolbar-actions"
          className="flex items-center gap-3 sm:shrink-0"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export { TableToolbar };
