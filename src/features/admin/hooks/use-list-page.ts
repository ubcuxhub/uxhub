"use client";

import { useState } from "react";

/** Rows per page on the admin lists. */
export const ADMIN_LIST_PAGE_SIZE = 25;

/**
 * Client-side paging for an admin list. `view` names what the rows are (the
 * search, filters and sort, e.g. as JSON): when it changes the list goes back
 * to page 1. Anything else (a record opening or closing, fresh rows after a
 * save) keeps the page; `Pagination` clamps it if the list got shorter.
 *
 * `startIndex` is where the list should open, e.g. the open record's row on a
 * refresh of its URL, so the row and its drawer show together.
 */
export function useListPage<T>(
  rows: readonly T[],
  view: string,
  { pageSize = ADMIN_LIST_PAGE_SIZE, startIndex = -1 }: { pageSize?: number; startIndex?: number } = {},
) {
  const [state, setState] = useState(() => ({
    view,
    page: startIndex >= 0 ? Math.floor(startIndex / pageSize) + 1 : 1,
  }));
  let page = state.page;
  if (state.view !== view) {
    page = 1;
    setState({ view, page });
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const from = rows.length === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, rows.length);

  return {
    page: current,
    pageSize,
    setPage: (next: number) => setState({ view, page: next }),
    /** The rows on this page. */
    pageRows: rows.slice(from === 0 ? 0 : from - 1, to),
    /** 1-based and inclusive, for `TableRowCount`'s `range`. */
    range: { from, to },
  };
}
