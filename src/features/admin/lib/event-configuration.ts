import { slugify } from "@/lib/slug";

const RESERVED_EVENT_SLUGS = new Set(["new", "create", "create-new", "admin", "api", "auth", "portal", "events", "drafts", "dev", "settings"]);

export function suggestedEventSlug(name: string) {
  if (!name.trim()) return "";
  const value = slugify(name).slice(0, 100).replace(/-+$/, "");
  return RESERVED_EVENT_SLUGS.has(value) ? `${value}-event` : value;
}

const MAX_EVENT_SLUG_LENGTH = 100;
// Room for the longest numbered suffix `uniqueEventSlug` will add ("-999999999").
const MAX_EVENT_SLUG_SUFFIX_LENGTH = 10;

function numberedEventSlug(base: string, counter: number) {
  if (counter === 0) return base;
  const suffix = `-${counter}`;
  return `${base.slice(0, MAX_EVENT_SLUG_LENGTH - suffix.length).replace(/-+$/, "")}${suffix}`;
}

/**
 * The prefix every `uniqueEventSlug(base, ...)` candidate starts with, for
 * fetching the URLs it could collide with.
 */
export function eventSlugStem(base: string) {
  return base.slice(0, MAX_EVENT_SLUG_LENGTH - MAX_EVENT_SLUG_SUFFIX_LENGTH).replace(/-+$/, "");
}

/**
 * The first of `base`, `base-1`, `base-2`, ... no other event claims, kept
 * within the 100-character limit. `current` is the URL the event already
 * holds: when it is one of those candidates and still free, it is kept, so
 * re-saving an event never moves its URL to a lower number freed up since.
 */
export function uniqueEventSlug(base: string, taken: Iterable<string>, current?: string | null) {
  const used = new Set(taken);
  if (current && !used.has(current)) {
    const counter = Number(/-(\d+)$/.exec(current)?.[1] ?? 0);
    if (numberedEventSlug(base, counter) === current || current === base) return current;
  }
  for (let counter = 0; ; counter++) {
    const candidate = numberedEventSlug(base, counter);
    if (!used.has(candidate)) return candidate;
  }
}

export function eventSlugError(value: string) {
  return !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) || value.length > 100 || RESERVED_EVENT_SLUGS.has(value)
    ? "Use lowercase letters, numbers and hyphens, up to 100 characters. This URL must not be reserved."
    : null;
}

export function websiteUrlError(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || value.length > 2048 || value.includes("\\") || /\s/.test(value)) throw new Error();
    return null;
  } catch {
    return "Enter a complete http:// or https:// website URL without credentials.";
  }
}

export function priceError(value: string) {
  return !/^(?:\d+|\d*\.\d{1,2})$/.test(value) || Number(value) >= 1000000
    ? "Enter a nonnegative CAD amount below 1,000,000 with at most two decimal places."
    : null;
}
