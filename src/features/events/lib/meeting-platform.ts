/** Hosts we can name, matched on the host and its parent domains. */
const PLATFORMS: [host: string, name: string][] = [
  ["zoom.us", "Zoom"],
  ["meet.google.com", "Google Meet"],
  ["teams.microsoft.com", "Microsoft Teams"],
  ["teams.live.com", "Microsoft Teams"],
  ["webex.com", "Webex"],
];

/**
 * The video platform a meeting link opens, for "Online · Zoom" in the event
 * header (Figma 1.21). Null for a host we don't know, or a link that isn't a
 * URL, so the header just says "Online".
 */
export function meetingPlatform(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const match = PLATFORMS.find(([known]) => host === known || host.endsWith(`.${known}`));
  return match ? match[1] : null;
}
