"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldDescription, FieldError, useFieldControl, joinIds } from "@/components/ui/field";
import { EventDescription } from "@/components/shared/EventDescription";
import { descriptionText, isOrderedListStart, plainDescription, safeDescriptionLink, type DescriptionSpan, type EventDescription as RichDescription } from "@/lib/event-description";
import { caretIn, edit, isEmptyItem, LIST_COMMAND, lineBeforeCaret, listItemOf, listShortcut, selectBeforeCaret, type ListKind } from "./overview-editing";
import { characterCount, clampCharacters, SHORT_OVERVIEW_MAX_LENGTH } from "../../lib/event-overview";

/** Convert editor DOM to the allowlisted format; paste never inserts HTML. */
function readEditor(root: HTMLElement): RichDescription {
  const blocks: RichDescription = [];
  // A block's last `<br>` only holds its line open; it isn't a line of its own.
  let placeholder: Node | null = null;
  function spans(node: Node, marks: Omit<DescriptionSpan, "text"> = {}): DescriptionSpan[] {
    if (node.nodeType === Node.TEXT_NODE) return [{ text: node.textContent ?? "", ...marks }];
    if (!(node instanceof HTMLElement)) return [];
    if (["SCRIPT", "STYLE", "IMG", "IFRAME"].includes(node.tagName)) return [];
    const next = { ...marks, ...(["B", "STRONG"].includes(node.tagName) ? { bold: true } : {}), ...(["I", "EM"].includes(node.tagName) ? { italic: true } : {}), ...(node.tagName === "A" && safeDescriptionLink(node.getAttribute("href") ?? "") ? { href: safeDescriptionLink(node.getAttribute("href")!) } : {}) };
    if (node.tagName === "BR") return node === placeholder ? [] : [{ text: "\n", ...next }];
    return Array.from(node.childNodes).flatMap(child => spans(child, next));
  }
  function read(nodes: Node[]): DescriptionSpan[] {
    let last: Node | undefined = nodes.at(-1);
    while (last instanceof HTMLElement && last.tagName !== "BR" && last.lastChild) last = last.lastChild;
    placeholder = last instanceof HTMLElement && last.tagName === "BR" ? last : null;
    // Browsers split text nodes freely; join neighbours that share their marks.
    const result: DescriptionSpan[] = [];
    for (const span of nodes.flatMap(node => spans(node))) {
      const previous = result.at(-1);
      if (!span.text) continue;
      if (previous && previous.bold === span.bold && previous.italic === span.italic && previous.href === span.href) previous.text += span.text;
      else result.push(span);
    }
    return result;
  }
  let inline: Node[] = [];
  const flush = () => { if (inline.length) { blocks.push({ type: "paragraph", spans: read(inline) }); inline = []; } };
  const isBlock = (node: Node): node is HTMLElement => node instanceof HTMLElement && ["P", "DIV", "UL", "OL", "LI"].includes(node.tagName);
  function walk(nodes: Node[]) {
    for (const child of nodes) {
      if (!isBlock(child)) { inline.push(child); continue; }
      flush();
      if (child.tagName === "UL") for (const li of child.children) blocks.push({ type: "list-item", spans: read([li]) });
      else if (child.tagName === "OL") {
        const start = Number(child.getAttribute("start") ?? 1);
        const first = isOrderedListStart(start) ? start : 1;
        // A list right below another numbered list keeps its own numbering.
        const begins = first !== 1 || blocks.at(-1)?.type === "ordered-item";
        Array.from(child.children).forEach((li, index) => blocks.push({ type: "ordered-item", spans: read([li]), ...(index === 0 && begins ? { start: first } : {}) }));
      } else if (child.tagName !== "LI" && Array.from(child.childNodes).some(isBlock)) {
        // A container: `EventDescription`'s wrapper, or a paragraph Chrome
        // turned into a list by nesting the list inside it.
        walk(Array.from(child.childNodes));
        flush();
      } else blocks.push({ type: child.tagName === "LI" ? "list-item" : "paragraph", spans: read([child]) });
    }
  }
  walk(Array.from(root.childNodes));
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
  // List shortcuts. `quiet` hides the editor's own commands from `onInput`;
  // `pending` remembers the last shortcut until anything else happens, so
  // Backspace or Ctrl/Cmd+Z right after it can put the typed marker back.
  const quiet = useRef(false);
  const pending = useRef<{ kind: ListKind; marker: string; item: HTMLLIElement; native: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const quietly = <T,>(run: () => T): T => { quiet.current = true; try { return run(); } finally { quiet.current = false; } };
  const command = (name: Parameters<typeof edit>[1], argument?: string) => {
    if (!editor.current) return;
    pending.current = null;
    editor.current.focus();
    if (selection.current) { const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(selection.current); }
    quietly(() => edit(editor.current!, name, argument));
    sync();
  };
  /** After a typed space: "- ", "* " or "1. " at the start of a plain line becomes a list item. */
  const autoformat = (root: HTMLElement) => {
    const caret = caretIn(root);
    if (!caret || listItemOf(root, caret.startContainer)) return;
    const marker = lineBeforeCaret(root, caret);
    const shortcut = listShortcut(marker);
    if (!shortcut || !selectBeforeCaret(root, caret, marker.length)) return;
    quietly(() => {
      const removed = edit(root, "delete");
      if (!removed) return;
      const listed = edit(root, LIST_COMMAND[shortcut.kind]);
      const after = caretIn(root);
      const item = after && listItemOf(root, after.startContainer);
      if (!listed || !item) { if (!listed) edit(root, "insertText", marker); return; }
      // A list typed as "3. " starts at 3, unless it joined a list above.
      const list = item.parentElement;
      if (shortcut.kind === "numbered" && list?.tagName === "OL" && list.firstElementChild === item && shortcut.start !== 1) list.setAttribute("start", String(shortcut.start));
      pending.current = { kind: shortcut.kind, marker, item, native: removed === "native" && listed === "native" };
      setAnnouncement(shortcut.kind === "bullet" ? "Bulleted list" : "Numbered list");
    });
  };
  /** Turns the item the last shortcut made back into the typed marker, like Notion. */
  const revert = (root: HTMLElement, shortcut: NonNullable<typeof pending.current>) => {
    quietly(() => {
      if (shortcut.native) {
        // Step back over the delete and the list, which keeps redo. If the
        // history held something else, step forward again and rebuild by hand.
        document.execCommand("undo");
        document.execCommand("undo");
        window.getSelection()?.collapseToEnd();
        const caret = caretIn(root);
        if (caret && !listItemOf(root, caret.startContainer) && lineBeforeCaret(root, caret) === shortcut.marker) return;
        document.execCommand("redo");
        document.execCommand("redo");
      }
      if (edit(root, LIST_COMMAND[shortcut.kind])) edit(root, "insertText", shortcut.marker);
    });
    setAnnouncement(`List formatting undone: ${shortcut.marker.trim()}`);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const root = editor.current;
    if (!root || e.nativeEvent.isComposing || e.keyCode === 229 || ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
    const shortcut = pending.current;
    pending.current = null;
    const undo = (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z";
    const caret = caretIn(root);
    if (shortcut && (undo || e.key === "Backspace") && caret && shortcut.item.isConnected && listItemOf(root, caret.startContainer) === shortcut.item && lineBeforeCaret(root, caret) === "") {
      e.preventDefault();
      revert(root, shortcut);
      sync();
      return;
    }
    // Enter on an empty item leaves the list (splitting it, mid-list), the same in every browser.
    const item = caret && e.key === "Enter" && !e.shiftKey ? listItemOf(root, caret.startContainer) : null;
    const list = item?.parentElement?.tagName;
    if (item && isEmptyItem(item) && (list === "UL" || list === "OL")) {
      e.preventDefault();
      quietly(() => edit(root, LIST_COMMAND[list === "OL" ? "numbered" : "bullet"]));
      sync();
    }
  };
  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (quiet.current) return;
    pending.current = null;
    const input = e.nativeEvent as InputEvent;
    // Only typing that ends in a space runs a shortcut (some input methods
    // insert "- " in one go): never a paste, a drop or an IME composition.
    if (editor.current && input.inputType === "insertText" && input.data?.endsWith(" ") && !input.isComposing) autoformat(editor.current);
    sync();
  };
  /** Paste and drop insert plain text only, and never run a shortcut. */
  const insertPlainText = (text: string) => {
    if (!editor.current) return;
    pending.current = null;
    quietly(() => edit(editor.current!, "insertText", text));
    sync();
  };
  const hasList = (rich ?? []).some(block => block.type !== "paragraph");
  return <div data-slot="card" className="space-y-4 rounded-xl border border-border bg-card p-5">
    <Field validationKey="short-overview">
      <div className="flex justify-between gap-3"><FieldLabel className="text-small font-medium" htmlFor="short-overview">Short overview</FieldLabel><span id="short-count" className="text-caption text-muted-foreground">{characterCount(short)} / {SHORT_OVERVIEW_MAX_LENGTH}</span></div>
      <Textarea id="short-overview" placeholder="One short line. E.g. Portfolio feedback from industry designers" disabled={disabled} value={short} aria-describedby="short-count" onChange={e => onChange(clampCharacters(e.target.value, SHORT_OVERVIEW_MAX_LENGTH), value, rich ?? plainDescription(value))} />
    </Field>
    <Field validationKey="long-overview">
      <div className="flex justify-between gap-3"><FieldLabel className="text-small font-medium" id="long-label">Long overview</FieldLabel><span id="long-count" className="text-caption text-muted-foreground">{value.length} / 3,000</span></div>
      <div className="overflow-hidden rounded-2xl border border-input has-[[aria-invalid=true]]:border-destructive">
        <div role="toolbar" aria-label="Formatting" className="flex gap-1 border-b border-border bg-section p-1">
          {([["Bold", Bold, "bold"], ["Italic", Italic, "italic"], ["Bulleted list", List, "insertUnorderedList"], ["Numbered list", ListOrdered, "insertOrderedList"]] as const).map(([label, ToolbarIcon, cmd]) =>
            <Button key={label} type="button" variant="ghost" size="icon" className="size-11 sm:size-9" disabled={disabled} aria-label={label} onMouseDown={e => e.preventDefault()} onClick={() => command(cmd)}><ToolbarIcon className="size-4" /></Button>)}
          <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-9" aria-label="Insert link" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => { const range = window.getSelection(); selection.current = range?.rangeCount ? range.getRangeAt(0).cloneRange() : null; setLinkOpen(true); }}><LinkIcon className="size-4" /></Button>
        </div>
        <div className="relative">
          {!value.trim() && !hasList && <p aria-hidden className="pointer-events-none absolute inset-x-5 top-3 text-muted-foreground">Who it’s for, what happens and what to bring. A few short paragraphs work best.</p>}
        <OverviewControl id="long-overview" ref={editor} contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-placeholder="Who it’s for, what happens and what to bring. A few short paragraphs work best." aria-labelledby="long-label" aria-describedby={`long-count long-hint${error && !validationManaged ? " long-error" : ""}`} aria-invalid={!!error} className="min-h-36 px-5 py-3 outline-none focus-visible:focus-ring [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline" onInput={onInput} onKeyDown={onKeyDown} onMouseDown={() => { pending.current = null; }} onBlur={() => { pending.current = null; }} onDrop={e => { e.preventDefault(); insertPlainText(e.dataTransfer.getData("text/plain")); }} onPaste={e => { e.preventDefault(); insertPlainText(e.clipboardData.getData("text/plain")); }}><EventDescription rich={initial} text={value} /></OverviewControl>
          <span aria-live="polite" className="sr-only">{announcement}</span>
        </div>
      </div>
      {linkOpen && <div className="flex flex-wrap items-end gap-2"><Field><FieldLabel className="text-small font-medium" htmlFor="overview-link">Link URL</FieldLabel><Input id="overview-link" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" /></Field><Button type="button" disabled={!safeDescriptionLink(url)} onClick={() => { command("createLink", safeDescriptionLink(url)); selection.current = null; setLinkOpen(false); setUrl(""); }}>Insert link</Button><Button type="button" variant="outline" onClick={() => { selection.current = null; setLinkOpen(false); }}>Cancel</Button></div>}
      <FieldDescription id="long-hint">Shown on the portal event page and the hosted marketing page.</FieldDescription>
      {error && !validationManaged && <FieldError id="long-error">{error}</FieldError>}
    </Field>
  </div>;
}
