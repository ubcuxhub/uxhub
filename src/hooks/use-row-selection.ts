"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Row selection for a list that can change under it (search, filter, page).
 *
 * `currentIds` is the list as it is now: every result for a client list, or
 * only the visible page for a server-paged one. The hook never prunes the
 * selection to it, so ticked rows survive a page change, a search that hides
 * them and a refetch that briefly renders `[]`. "N selected" counts them all;
 * the caller drops them with `clear()` or `setSelected()`. The header checkbox
 * (`allState`, `toggleAll`) and `exportIds` follow the current results (§3.16).
 *
 * Every action is a functional update against the latest state, so several
 * calls in one handler (`ids.forEach(selection.toggle)`) all land.
 */
export function useRowSelection<Id extends string>(currentIds: readonly Id[]) {
  const [selected, setIds] = useState<ReadonlySet<Id>>(() => new Set());

  // `toggleAll` runs inside a state updater, which must not close over this
  // render's ids: keep the latest in a ref.
  const currentRef = useRef(currentIds);
  useLayoutEffect(() => {
    currentRef.current = currentIds;
  });

  const current = new Set(currentIds);
  let visibleSelected = 0;
  for (const id of current) if (selected.has(id)) visibleSelected += 1;

  const allState: boolean | "indeterminate" =
    visibleSelected === 0
      ? false
      : visibleSelected === current.size
        ? true
        : "indeterminate";

  return {
    /** Every selected id, including any not in `currentIds` right now. */
    selected,
    isSelected: (id: Id) => selected.has(id),
    toggle: (id: Id) =>
      setIds((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    /** Selects every current result, or deselects them when all are selected. */
    toggleAll: () =>
      setIds((prev) => {
        const ids = currentRef.current;
        const all = ids.length > 0 && ids.every((id) => prev.has(id));
        const next = new Set(prev);
        for (const id of ids) {
          if (all) next.delete(id);
          else next.add(id);
        }
        return next;
      }),
    /** Replaces the selection, e.g. a shift-click range or "select these 3". */
    setSelected: (ids: Iterable<Id>) => setIds(new Set(ids)),
    clear: () => setIds(new Set()),
    /** The header checkbox: about the current results only. */
    allState,
    /** The selected rows, or every current result when none are (§3.16). */
    exportIds: (selected.size > 0
      ? [
          ...currentIds.filter((id) => selected.has(id)),
          ...[...selected].filter((id) => !current.has(id)),
        ]
      : currentIds) as readonly Id[],
  };
}
