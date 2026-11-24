import { Fragment, type ReactNode } from "react";
import { orderedListNumbers, parseEventDescription, type DescriptionBlock, type DescriptionSpan } from "@/lib/event-description";

function Spans({ spans }: { spans: DescriptionSpan[] }) {
  return spans.map((span, index) => {
    let child: ReactNode = span.text;
    if (span.bold) child = <strong>{child}</strong>;
    if (span.italic) child = <em>{child}</em>;
    if (span.href) child = <a className="text-primary underline" href={span.href} rel="noopener noreferrer">{child}</a>;
    return <Fragment key={index}>{child}</Fragment>;
  });
}

/** An ordered item with its own `start` begins a list rather than continuing one. */
const beginsNewList = (block: DescriptionBlock) => block.type === "ordered-item" && block.start !== undefined;

export function EventDescription({ rich, text }: { rich?: unknown; text: string | null }) {
  const blocks = parseEventDescription(rich);
  if (!blocks) return <p className="whitespace-pre-wrap">{text}</p>;
  const numbers = orderedListNumbers(blocks);
  const output: ReactNode[] = [];
  for (let i = 0; i < blocks.length;) {
    const block = blocks[i];
    if (block.type === "paragraph") {
      output.push(<p key={i} className="min-h-6 whitespace-pre-wrap"><Spans spans={block.spans} /></p>);
      i++;
      continue;
    }
    // Gather the run of items that makes up one list.
    const first = i;
    const items: ReactNode[] = [];
    do {
      items.push(<li key={i}><Spans spans={blocks[i].spans} /></li>);
      i++;
    } while (i < blocks.length && blocks[i].type === block.type && !beginsNewList(blocks[i]));
    if (block.type === "list-item") output.push(<ul key={first} className="list-disc space-y-2 pl-6">{items}</ul>);
    else output.push(<ol key={first} className="list-decimal space-y-2 pl-6" start={numbers[first] === 1 ? undefined : numbers[first]!}>{items}</ol>);
  }
  return <div className="space-y-2 break-words">{output}</div>;
}
