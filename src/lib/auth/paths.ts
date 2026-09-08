const INTERNAL_ORIGIN = "https://uxhub.local";

export function getSafeInternalPath(
  value: string | null | undefined,
  fallback = "/portal",
) {
  if (
    !value ||
    !value.startsWith("/") ||
    /[\u0000-\u001f\u007f\\]/.test(value)
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, INTERNAL_ORIGIN);

    if (url.origin !== INTERNAL_ORIGIN) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function withReturnTo(path: string, returnTo?: string | null) {
  if (!returnTo) return path;

  const url = new URL(path, "https://uxhub.local");
  url.searchParams.set("returnTo", getSafeInternalPath(returnTo));
  return `${url.pathname}${url.search}`;
}
