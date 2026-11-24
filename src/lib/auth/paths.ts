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

    // Check the resolved path, not just the input: dot segments collapse, so
    // `/.//evil.com` and `/%2e//evil.com` resolve to `//evil.com`, which a
    // router treats as protocol-relative. Also check it after one decode
    // (and resolve that too), so `/%2fevil.com` or `/.%2f/evil.com` can't
    // become one in a layer that decodes before it navigates. A malformed
    // escape (`/%`) throws and falls back.
    const decoded = decodeURIComponent(url.pathname);
    if (
      url.origin !== INTERNAL_ORIGIN ||
      isProtocolRelative(url.pathname) ||
      isProtocolRelative(decoded) ||
      isProtocolRelative(new URL(decoded, INTERNAL_ORIGIN).pathname)
    ) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** `//host` or `/\host`: a path a browser resolves to another origin. */
function isProtocolRelative(pathname: string) {
  return /^[/\\]{2}/.test(pathname);
}

export function withReturnTo(path: string, returnTo?: string | null) {
  if (!returnTo) return path;

  const url = new URL(path, "https://uxhub.local");
  url.searchParams.set("returnTo", getSafeInternalPath(returnTo));
  return `${url.pathname}${url.search}`;
}

/**
 * The add-your-name form for a signed-in user whose sign-in provider didn't
 * supply both names. It returns to `next` once the profile is saved.
 */
export function completeProfilePath(next: string | null | undefined) {
  return `/auth/complete-profile?next=${encodeURIComponent(getSafeInternalPath(next))}`;
}
