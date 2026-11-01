import { Gallery } from "./_gallery/Gallery";
import type { GalleryParams } from "./_gallery/types";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Visual-check gallery for the shared UI. Reads no data and needs no sign-in,
 * so a reviewer (or a session that must not sign in) can look at every
 * component state. See `_gallery/types.ts` for the section contract and the
 * query parameters.
 */
export default async function ComponentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const theme = first(params.theme);
  const density = first(params.density);

  const parsed: GalleryParams = {
    theme:
      theme === "light" || theme === "dark" || theme === "split"
        ? theme
        : undefined,
    density: density === "compact" ? "compact" : "comfortable",
    section: first(params.section) || undefined,
    open: first(params.open) || undefined,
  };

  return <Gallery {...parsed} />;
}
