/**
 * Every row a query matches, beyond PostgREST's `max_rows` cap (1000), which
 * otherwise truncates a response without an error. `page` runs the query for
 * one inclusive `range(from, to)`; it must order by a stable unique key (add
 * `id` as a tiebreaker) so no row is skipped or repeated across pages.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const size = 500;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const result = await page(from, from + size - 1);
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
    if (!result.data || result.data.length < size) return rows;
  }
}
