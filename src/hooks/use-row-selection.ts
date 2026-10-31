"use client";

import { useState } from "react";

/**
 * Row selection for a list that can change under it (search, filter, page).
 *
 * Selection is pruned to `currentIds` as they change, so "2 selected" always
 * matches what is on screen and a row that was filtered out doesn't come back
 * selected when the filter is cleared. `toggleAll` acts on the current results
 * only (§3.16).
 */
export function useRowSelection<Id extends string>(currentIds: readonly Id[]) {
  const [ids, setIds] = useState<ReadonlySet<Id>>(() => new Set());

  const current = new Set(currentIds);
  const selected = new Set([...ids].filter((id) => current.has(id)));

  // Prune during render, the supported way to derive state from props: React
  // re-renders straight away without committing the stale set.
  if (selected.size !== ids.size) setIds(selected);

  const selectedCount = selected.size;
  const allState: boolean | "indeterminate" =
    selectedCount === 0
      ? false
      : selectedCount === current.size
        ? true
        : "indeterminate";

  return {
    selected: selected as ReadonlySet<Id>,
    isSelected: (id: Id) => selected.has(id),
    toggle: (id: Id) => {
      const next = new Set(selected);
      if (!next.delete(id)) next.add(id);
      setIds(next);
    },
    toggleAll: () => setIds(allState === true ? new Set() : new Set(current)),
    clear: () => setIds(new Set()),
    allState,
    /** The selected rows, or every current result when none are (§3.16). */
    exportIds: (selectedCount > 0
      ? currentIds.filter((id) => selected.has(id))
      : currentIds) as readonly Id[],
  };
}
