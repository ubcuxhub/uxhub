/** A deliberately small rich-text format. No HTML is stored or executed. */
export interface DescriptionSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}
export interface DescriptionBlock {
  type: "paragraph" | "list-item";
  spans: DescriptionSpan[];
}
export type EventDescription = DescriptionBlock[];
export const LONG_OVERVIEW_LIMIT = 3000;

export function safeDescriptionLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

/** Validate untrusted JSON at both the write and render boundaries. */
export function parseEventDescription(value: unknown): EventDescription | null {
  if (!Array.isArray(value) || value.length > LONG_OVERVIEW_LIMIT) return null;
  const result: EventDescription = [];
  for (const block of value) {
    if (!block || !["paragraph", "list-item"].includes(block.type) || !Array.isArray(block.spans)) return null;
    const spans: DescriptionSpan[] = [];
    for (const span of block.spans) {
      if (!span || typeof span.text !== "string") return null;
      if (span.href !== undefined && (typeof span.href !== "string" || !safeDescriptionLink(span.href))) return null;
      spans.push({ text: span.text, ...(span.bold === true ? { bold: true } : {}), ...(span.italic === true ? { italic: true } : {}), ...(span.href ? { href: safeDescriptionLink(span.href) } : {}) });
    }
    result.push({ type: block.type, spans });
  }
  return result;
}

export function descriptionText(value: EventDescription): string {
  return value.map(block => block.spans.map(span => span.text).join("")).join("\n");
}
export function plainDescription(text: string): EventDescription {
  return text.split("\n").map(line => ({ type: "paragraph", spans: [{ text: line }] }));
}
