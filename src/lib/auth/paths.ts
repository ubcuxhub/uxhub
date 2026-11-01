const INTERNAL_ORIGIN = "https://uxhub.local";

// Percent-encoded backslashes and control characters (%5C, %09, %0A, ...) in
// the path. They stay literal after one decode, but a layer that decodes again
// before resolving would turn them into a protocol-relative URL.
const ENCODED_UNSAFE_PATH = /%(?:5c|[01][0-9a-f]|7f)/i;

export function getSafeInternalPath(
  value: string | null | undefined,
  fallback = "/portal",
) {
  if (
    !value ||
    !value.startsWith("/") ||
    /[\u0000-\u001f\u007f\\]/.test(value) ||
    ENCODED_UNSAFE_PATH.test(value.split(/[?#]/, 1)[0])
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
