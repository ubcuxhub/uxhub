/**
 * Leaves for `href` with a full document load instead of a client-side route
 * change: for a URL a soft navigation would send somewhere else (an
 * intercepted route that should open as its own page). Its own module so
 * tests can mock it; jsdom can't navigate.
 */
export function loadDocument(href: string) {
  window.location.assign(href);
}
