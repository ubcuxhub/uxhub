/** Keep the 640px builder shell scoped to editor routes. */
export function isEventBuilderPath(pathname: string) {
  return /^\/admin\/events\/(?:create-new|drafts\/[^/]+|[^/]+)$/.test(pathname);
}
