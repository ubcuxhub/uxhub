/** A deliberately small rich-text format. No HTML is stored or executed. */
export interface DescriptionSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}
/**
 * Consecutive `list-item` blocks form one bulleted list, and consecutive
 * `ordered-item` blocks one numbered list. An `ordered-item` with `start`
 * begins a new numbered list at that number (so two adjacent lists stay
 * apart); without it, the item continues the list above, or begins one at 1.
 */
export type DescriptionBlock =
  | { type: "paragraph" | "list-item"; spans: DescriptionSpan[] }
  | { type: "ordered-item"; spans: DescriptionSpan[]; start?: number };
export type EventDescription = DescriptionBlock[];
export const LONG_OVERVIEW_LIMIT = 3000;
/** The largest number a numbered list may start from. */
export const ORDERED_LIST_MAX_START = 999_999;

export function safeDescriptionLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export function isOrderedListStart(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= ORDERED_LIST_MAX_START;
}

/** Validate untrusted JSON at both the write and render boundaries. */
export function parseEventDescription(value: unknown): EventDescription | null {
  if (!Array.isArray(value) || value.length > LONG_OVERVIEW_LIMIT) return null;
  const result: EventDescription = [];
  for (const block of value) {
    if (!block || !["paragraph", "list-item", "ordered-item"].includes(block.type) || !Array.isArray(block.spans)) return null;
    if (block.start !== undefined && (block.type !== "ordered-item" || !isOrderedListStart(block.start))) return null;
    const spans: DescriptionSpan[] = [];
    for (const span of block.spans) {
      if (!span || typeof span.text !== "string") return null;
      if (span.href !== undefined && (typeof span.href !== "string" || !safeDescriptionLink(span.href))) return null;
      spans.push({ text: span.text, ...(span.bold === true ? { bold: true } : {}), ...(span.italic === true ? { italic: true } : {}), ...(span.href ? { href: safeDescriptionLink(span.href) } : {}) });
    }
    result.push(block.type === "ordered-item" ? { type: "ordered-item", spans, ...(block.start !== undefined ? { start: block.start } : {}) } : { type: block.type, spans });
  }
  return result;
}

/** Each block's number in its numbered list, or null for any other block. */
export function orderedListNumbers(value: EventDescription): (number | null)[] {
  const numbers: (number | null)[] = [];
  value.forEach((block, index) => {
    if (block.type !== "ordered-item") { numbers.push(null); return; }
    const previous = index > 0 ? numbers[index - 1] : null;
    numbers.push(block.start ?? (previous === null ? 1 : previous + 1));
  });
  return numbers;
}

/**
 * The plain-text twin saved in `events.description`. Numbered items read
 * "1. Item", since the number carries meaning; bulleted items stay bare, as
 * they always have, so the text of descriptions saved before numbered lists
 * existed still matches their rich form.
 */
export function descriptionText(value: EventDescription): string {
  const numbers = orderedListNumbers(value);
  return value.map((block, index) => (numbers[index] === null ? "" : `${numbers[index]}. `) + block.spans.map(span => span.text).join("")).join("\n");
}
export function plainDescription(text: string): EventDescription {
  return text.split("\n").map(line => ({ type: "paragraph", spans: [{ text: line }] }));
}
