import { notFound } from "next/navigation";

/**
 * The root @flow catch-all also matches handler-only URLs. Give the implicit
 * children slot an explicit fallback without making unknown URLs valid pages.
 * Route handlers still serve their own responses; missing page content is 404.
 */
export default function DefaultPage() {
  notFound();
}
