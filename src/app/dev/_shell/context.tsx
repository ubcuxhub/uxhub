"use client";

import Link from "next/link";
import { createContext, use, type ComponentProps } from "react";

import { docsHref, type DisplayParams } from "./params";

interface DocsContextValue {
  params: DisplayParams;
  /** Side by side is on and the screen is wide enough for it. */
  split: boolean;
}

export const DocsContext = createContext<DocsContextValue>({
  params: { density: "comfortable" },
  split: false,
});

/** The current display params, and a URL builder that keeps them. */
export function useDocs() {
  const { params, split } = use(DocsContext);
  return {
    params,
    split,
    href: (path: string, patch?: Partial<DisplayParams>) =>
      docsHref(path, params, patch),
  };
}

/**
 * A link to another `/dev` page that keeps the theme and density. Server pages
 * use it to link without reading the query themselves.
 */
export function DocsLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const docs = useDocs();
  return <Link href={docs.href(href, { open: undefined })} {...props} />;
}
