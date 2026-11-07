import { slugify } from "@/lib/slug";

const RESERVED_EVENT_SLUGS = new Set(["new", "create", "create-new", "admin", "api", "auth", "portal", "events", "drafts", "dev", "settings"]);

export function suggestedEventSlug(name: string) {
  if (!name.trim()) return "";
  const value = slugify(name).slice(0, 100).replace(/-+$/, "");
  return RESERVED_EVENT_SLUGS.has(value) ? `${value}-event` : value;
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
