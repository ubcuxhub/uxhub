"use client";

import { useRef } from "react";
import { Bold, Italic, Link as LinkIcon, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldDescription, FieldError, useFieldControl, joinIds } from "@/components/ui/field";
import { EventDescription } from "@/components/shared/EventDescription";
import { descriptionText, plainDescription, safeDescriptionLink, type DescriptionSpan, type EventDescription as RichDescription } from "@/lib/event-description";
import { useState } from "react";

/** Convert editor DOM to the allowlisted format; paste never inserts HTML. */
function readEditor(root: HTMLElement): RichDescription {
  const blocks: RichDescription = [];
  function spans(node: Node, marks: Omit<DescriptionSpan, "text"> = {}): DescriptionSpan[] {
    if (node.nodeType === Node.TEXT_NODE) return [{ text: node.textContent ?? "", ...marks }];
    if (!(node instanceof HTMLElement)) return [];
    if (["SCRIPT", "STYLE", "IMG", "IFRAME"].includes(node.tagName)) return [];
    const next = { ...marks, ...(["B", "STRONG"].includes(node.tagName) ? { bold: true } : {}), ...(["I", "EM"].includes(node.tagName) ? { italic: true } : {}), ...(node.tagName === "A" && safeDescriptionLink(node.getAttribute("href") ?? "") ? { href: safeDescriptionLink(node.getAttribute("href")!) } : {}) };
    if (node.tagName === "BR") return [{ text: "\n", ...next }];
    return Array.from(node.childNodes).flatMap(child => spans(child, next));
  }
  let inline: DescriptionSpan[] = [];
  const flush = () => { if (inline.length) { blocks.push({ type: "paragraph", spans: inline }); inline = []; } };
  const children = Array.from(root.childNodes).flatMap(child => child instanceof HTMLElement && child.tagName === "DIV" && child.classList.contains("space-y-2") ? Array.from(child.childNodes) : [child]);
  for (const child of children) {
    if (child instanceof HTMLElement && ["P", "DIV", "UL", "OL", "LI"].includes(child.tagName)) {
      flush();
      if (["UL", "OL"].includes(child.tagName)) for (const li of child.children) blocks.push({ type: "list-item", spans: spans(li) });
      else blocks.push({ type: child.tagName === "LI" ? "list-item" : "paragraph", spans: spans(child) });
    } else inline.push(...spans(child));
  }
  flush();
  return blocks;
}

function OverviewControl(props: React.ComponentProps<"div">) {
  const field = useFieldControl();
  return <div {...props} aria-invalid={props["aria-invalid"] || field.invalid} aria-describedby={joinIds(props["aria-describedby"], field.describedBy)} />;
}

export function EventDescriptionEditor({ short, value, rich, disabled, onChange, validationManaged = false }: {
  short: string; value: string; rich: RichDescription | null; disabled: boolean; validationManaged?: boolean;
  onChange: (short: string, text: string, rich: RichDescription) => void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => rich ?? plainDescription(value));
  const selection = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sync = () => {
    if (!editor.current) return;
    const content = readEditor(editor.current);
    const text = descriptionText(content);
    setError(text.length > 3000 ? "Long overview must be 3,000 characters or fewer." : null);
    onChange(short, text, content);
  };
  const command = (name: string, argument?: string) => {
    editor.current?.focus();
    if (selection.current) { const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(selection.current); }
    document.execCommand(name, false, argument);
    sync();
  };
  return <div data-slot="card" className="space-y-4 rounded-xl border border-border bg-card p-5">
    <Field validationKey="short-overview">
      <div className="flex justify-between gap-3"><FieldLabel className="text-small font-medium" htmlFor="short-overview">Short overview</FieldLabel><span id="short-count" className="text-caption text-muted-foreground">{short.length} / 50</span></div>
      <Textarea id="short-overview" placeholder="One short line. E.g. Portfolio feedback from industry designers" disabled={disabled} value={short} maxLength={50} aria-describedby="short-count" onChange={e => onChange(e.target.value, value, rich ?? plainDescription(value))} />
    </Field>
    <Field validationKey="long-overview">
      <div className="flex justify-between gap-3"><FieldLabel className="text-small font-medium" id="long-label">Long overview</FieldLabel><span id="long-count" className="text-caption text-muted-foreground">{value.length} / 3,000</span></div>
      <div className="overflow-hidden rounded-2xl border border-input has-[[aria-invalid=true]]:border-destructive">
        <div role="toolbar" aria-label="Formatting" className="flex gap-1 border-b border-border bg-section p-1">
          {[["Bold", Bold, "bold"], ["Italic", Italic, "italic"], ["Bulleted list", List, "insertUnorderedList"]].map(([label, Icon, cmd]) => {
            const ToolbarIcon = Icon as typeof Bold;
            return <Button key={String(label)} type="button" variant="ghost" size="icon" className="size-11 sm:size-9" disabled={disabled} aria-label={String(label)} onMouseDown={e => e.preventDefault()} onClick={() => command(String(cmd))}><ToolbarIcon className="size-4" /></Button>;
          })}
          <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-9" aria-label="Insert link" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => { const range = window.getSelection(); selection.current = range?.rangeCount ? range.getRangeAt(0).cloneRange() : null; setLinkOpen(true); }}><LinkIcon className="size-4" /></Button>
        </div>
        <div className="relative">
          {!value.trim() && <p aria-hidden className="pointer-events-none absolute inset-x-5 top-3 text-muted-foreground">Who it’s for, what happens and what to bring. A few short paragraphs work best.</p>}
        <OverviewControl id="long-overview" ref={editor} contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-placeholder="Who it’s for, what happens and what to bring. A few short paragraphs work best." aria-labelledby="long-label" aria-describedby={`long-count long-hint${error && !validationManaged ? " long-error" : ""}`} aria-invalid={!!error} className="min-h-36 px-5 py-3 outline-none focus-visible:focus-ring [&_ul]:list-disc [&_ul]:pl-6 [&_a]:text-primary [&_a]:underline" onInput={sync} onDrop={e => { e.preventDefault(); document.execCommand("insertText", false, e.dataTransfer.getData("text/plain")); sync(); }} onPaste={e => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); sync(); }}><EventDescription rich={initial} text={value} /></OverviewControl>
        </div>
      </div>
      {linkOpen && <div className="flex flex-wrap items-end gap-2"><Field><FieldLabel className="text-small font-medium" htmlFor="overview-link">Link URL</FieldLabel><Input id="overview-link" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" /></Field><Button type="button" disabled={!safeDescriptionLink(url)} onClick={() => { command("createLink", safeDescriptionLink(url)); selection.current = null; setLinkOpen(false); setUrl(""); }}>Insert link</Button><Button type="button" variant="outline" onClick={() => { selection.current = null; setLinkOpen(false); }}>Cancel</Button></div>}
      <FieldDescription id="long-hint">Shown on the portal event page and the hosted marketing page.</FieldDescription>
      {error && !validationManaged && <FieldError id="long-error">{error}</FieldError>}
    </Field>
  </div>;
}
