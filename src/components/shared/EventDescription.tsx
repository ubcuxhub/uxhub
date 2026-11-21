import { Fragment, type ReactNode } from "react";
import { parseEventDescription } from "@/lib/event-description";

export function EventDescription({ rich, text }: { rich?: unknown; text: string | null }) {
  const blocks = parseEventDescription(rich);
  if (!blocks) return <p className="whitespace-pre-wrap">{text}</p>;
  const output: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const content = block.spans.map((span, index) => {
      let child: ReactNode = span.text;
      if (span.bold) child = <strong>{child}</strong>;
      if (span.italic) child = <em>{child}</em>;
      if (span.href) child = <a className="text-primary underline" href={span.href} rel="noopener noreferrer">{child}</a>;
      return <Fragment key={index}>{child}</Fragment>;
    });
    if (block.type === "list-item") output.push(<ul key={i} className="list-disc pl-6"><li>{content}</li></ul>);
    else output.push(<p key={i} className="min-h-6 whitespace-pre-wrap">{content}</p>);
  }
  return <div className="space-y-2 break-words">{output}</div>;
}
