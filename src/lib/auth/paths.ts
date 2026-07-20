export function getSafeInternalPath(
  value: string | null | undefined,
  fallback = "/portal",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function withReturnTo(path: string, returnTo?: string | null) {
  if (!returnTo) return path;

  const url = new URL(path, "https://uxhub.local");
  url.searchParams.set("returnTo", getSafeInternalPath(returnTo));
  return `${url.pathname}${url.search}`;
}
