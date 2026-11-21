/** Staff check-in needs the complete population, beyond PostgREST's row cap.
 * Callers must order by a stable unique key and return at most this page size. */
export async function fetchCheckInPages<T>(
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
