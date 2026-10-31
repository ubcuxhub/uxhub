/**
 * Event colours (design system §2.1): organizers pick a header colour and an
 * event colour from presets or any hex. The colours are user data, so the
 * helpers here work from a hex passed in rather than from tokens.
 */

export const EVENT_COLOUR_PRESETS = [
  { name: "Blue", hex: "#325DC4" },
  { name: "Orchid", hex: "#C983C7" },
  { name: "Slate", hex: "#4A5E8A" },
] as const;

/** Blue, selected for a new event and when a selected custom colour is removed. */
export const DEFAULT_EVENT_COLOUR = "#325DC4";

/** `text-primary` in light mode, the dark label on an event colour. */
const DARK_TEXT = "#111111";
const LIGHT_TEXT = "#FFFFFF";

/**
 * "2f8f6b", "#2F8F6B" and "#abc" become "#2F8F6B" and "#AABBCC". Anything else,
 * including 4- and 8-digit hex, is `null`.
 */
export function normalizeHex(input: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!match) return null;
  const digits = match[1].toUpperCase();
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;
  return `#${full}`;
}

function toRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new RangeError(`Not a hex colour: ${hex}`);
  const value = parseInt(normalized.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or `text-primary`, whichever contrasts more with the colour. */
export function readableTextOn(hex: string): "light" | "dark" {
  return contrastRatio(hex, LIGHT_TEXT) >= contrastRatio(hex, DARK_TEXT)
    ? "light"
    : "dark";
}

/** The colour mixed with white. `whiteMix` 0 is the colour, 1 is white. */
export function eventColourTint(hex: string, whiteMix = 0.45): string {
  const mix = Math.min(1, Math.max(0, whiteMix));
  const channels = toRgb(hex).map((channel) =>
    Math.round(channel + (255 - channel) * mix),
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** The ticket fill: a 45% white tint at the top, the event colour at the bottom. */
export function ticketGradient(hex: string): string {
  const colour = normalizeHex(hex) ?? DEFAULT_EVENT_COLOUR;
  return `linear-gradient(to bottom, ${eventColourTint(colour)}, ${colour})`;
}

/** The featured Home card fill: the event colour to its tint, at 135°. */
export function featuredCardGradient(hex: string): string {
  const colour = normalizeHex(hex) ?? DEFAULT_EVENT_COLOUR;
  return `linear-gradient(135deg, ${colour}, ${eventColourTint(colour)})`;
}
