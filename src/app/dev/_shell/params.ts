/**
 * The query parameters every `/dev` page shares. They are display settings,
 * not addresses: the page itself is the path.
 */
export interface DisplayParams {
  /**
   * `light`/`dark` set the page theme; `split` ("Side by side", wide screens
   * only) shows light and dark columns. Unset follows the viewer's own theme.
   */
  theme?: "split" | "light" | "dark";
  /** Wraps the page in `data-density="compact"`. */
  density: "comfortable" | "compact";
  /** Passed to demos as `SectionProps.open`. */
  open?: string;
}

/** Anything with URLSearchParams' `get`, or a Next.js `searchParams` record. */
export type QueryLike =
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

/** The first value of `name` in `query`. */
export function readQuery(query: QueryLike, name: string): string | undefined {
  if (typeof query.get === "function") {
    return (query as { get(name: string): string | null }).get(name) ?? undefined;
  }
  const value = (query as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Reads and validates `theme`, `density` and `open`; anything else is dropped. */
export function parseDisplayParams(query: QueryLike): DisplayParams {
  const theme = readQuery(query, "theme");
  const density = readQuery(query, "density");
  return {
    theme:
      theme === "light" || theme === "dark" || theme === "split"
        ? theme
        : undefined,
    density: density === "compact" ? "compact" : "comfortable",
    open: readQuery(query, "open") || undefined,
  };
}

/** The query string for `params`, defaults dropped: "" or "?theme=dark&…". */
export function displaySearch(params: DisplayParams) {
  const query = new URLSearchParams();
  if (params.theme) query.set("theme", params.theme);
  if (params.density !== "comfortable") query.set("density", params.density);
  if (params.open) query.set("open", params.open);
  const search = query.toString();
  return search ? `?${search}` : "";
}

/**
 * A `/dev` URL: `path` (which may end in a `#hash`) with the current display
 * params plus a change. `open` belongs to one page, so callers moving to
 * another page pass `{ open: undefined }`.
 */
export function docsHref(
  path: string,
  current: DisplayParams,
  patch: Partial<DisplayParams> = {},
) {
  const [pathname, hash] = path.split("#");
  const search = displaySearch({ ...current, ...patch });
  return `${pathname}${search}${hash ? `#${hash}` : ""}`;
}
