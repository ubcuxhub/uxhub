import {
  docsHref,
  parseDisplayParams,
  readQuery,
  type QueryLike,
} from "@/app/dev/_shell/params";
import { STANDALONE, type StandaloneId } from "@/app/dev/_shell/standalone";

import { ENTRIES, entryPath } from "./index";

/**
 * Where an id from the single-page gallery (`?section=<id>`) lives now: an
 * entry with that slug, an entry that lists it in `aliases` (at its `#hash`),
 * or a standalone page. Undefined for an id nothing claims.
 */
export function resolveSection(id: string): string | undefined {
  const bySlug = ENTRIES.find((entry) => entry.slug === id);
  if (bySlug) return entryPath(bySlug.slug);

  for (const entry of ENTRIES) {
    const alias = entry.aliases?.find((a) => a.id === id);
    if (alias) {
      return `${entryPath(entry.slug)}${alias.hash ? `#${alias.hash}` : ""}`;
    }
  }

  const page = (Object.keys(STANDALONE) as StandaloneId[]).find((key) => key === id);
  return page ? STANDALONE[page].path : undefined;
}

/**
 * The redirect for an old `/dev/components?section=<id>` link, keeping
 * `theme`, `density` and `open`. Undefined when there is no `section` (the
 * index itself); null when the id is unknown.
 */
export function legacyRedirect(query: QueryLike): string | null | undefined {
  const id = readQuery(query, "section");
  if (!id) return undefined;

  const target = resolveSection(id);
  if (!target) return null;
  return docsHref(target, parseDisplayParams(query));
}
