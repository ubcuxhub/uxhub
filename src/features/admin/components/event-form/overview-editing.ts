/**
 * DOM helpers for the long-overview editor. Every edit goes through
 * `document.execCommand`, so the browser records it in its undo history. Where
 * the command is missing or refused (jsdom, or an engine that declines it), a
 * small DOM fallback makes the same change and fires the `input` event the
 * browser would have.
 */

export type ListKind = "bullet" | "numbered";
export const LIST_COMMAND = { bullet: "insertUnorderedList", numbered: "insertOrderedList" } as const;
type Command = "delete" | "insertText" | (typeof LIST_COMMAND)[ListKind] | "bold" | "italic" | "createLink";

const BLOCK_TAGS = new Set(["P", "DIV", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE"]);
const INPUT_TYPE: Partial<Record<Command, string>> = { delete: "deleteContentBackward", insertText: "insertText", insertOrderedList: "insertOrderedList", insertUnorderedList: "insertUnorderedList" };

/**
 * The Notion-style shortcut a line's text makes, read just after a space was
 * typed: "- " or "* " starts a bulleted list, "3. " a numbered list from 3.
 */
export function listShortcut(line: string): { kind: ListKind; start: number } | null {
  if (/^[-*] $/.test(line)) return { kind: "bullet", start: 1 };
  const numbered = /^(\d{1,6})\. $/.exec(line);
  return numbered ? { kind: "numbered", start: Number(numbered[1]) } : null;
}

/** `EventDescription`'s own wrapper, which the editor's first render sits in. */
export function isEditorWrapper(root: HTMLElement, node: Node): boolean {
  return node instanceof HTMLElement && node.parentNode === root && node.tagName === "DIV" && node.classList.contains("space-y-2");
}

/** The nearest block holding `node`, or the editor itself for a bare line. */
export function blockOf(root: HTMLElement, node: Node): HTMLElement {
  for (let current: Node | null = node; current && current !== root; current = current.parentNode) {
    if (current instanceof HTMLElement && BLOCK_TAGS.has(current.tagName) && !isEditorWrapper(root, current)) return current;
  }
  return root;
}

export function listItemOf(root: HTMLElement, node: Node): HTMLLIElement | null {
  for (let current: Node | null = node; current && current !== root; current = current.parentNode) {
    if (current instanceof HTMLLIElement) return current;
  }
  return null;
}

/** The collapsed caret, when it sits inside the editor. */
export function caretIn(root: HTMLElement): Range | null {
  const selection = root.ownerDocument.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  return root.contains(range.startContainer) ? range : null;
}

export function placeCaret(node: Node, offset: number) {
  const selection = node.ownerDocument?.getSelection();
  if (!selection) return;
  const range = node.ownerDocument!.createRange();
  range.setStart(node, offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

function select(range: Range) {
  const selection = range.startContainer.ownerDocument?.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function rangeToCaret(root: HTMLElement, caret: Range): Range {
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(blockOf(root, caret.startContainer));
  range.setEnd(caret.startContainer, caret.startOffset);
  return range;
}

/** The caret's line up to the caret; a `<br>` or a block starts a new line. Non-breaking spaces read as spaces. */
export function lineBeforeCaret(root: HTMLElement, caret: Range): string {
  let line = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { line += node.textContent ?? ""; return; }
    const block = node instanceof Element && BLOCK_TAGS.has(node.tagName);
    if (block || (node instanceof Element && node.tagName === "BR")) line = "";
    node.childNodes.forEach(walk);
    if (block) line = "";
  };
  rangeToCaret(root, caret).cloneContents().childNodes.forEach(walk);
  return line.replace(/ /g, " ");
}

/** The `length` characters just before the caret, which may span text nodes. */
function rangeBeforeCaret(root: HTMLElement, caret: Range, length: number): Range | null {
  const before = rangeToCaret(root, caret);
  const walker = root.ownerDocument.createTreeWalker(blockOf(root, caret.startContainer), NodeFilter.SHOW_TEXT);
  const texts: { node: Text; end: number }[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (before.intersectsNode(node)) texts.push({ node: node as Text, end: node === caret.startContainer ? caret.startOffset : (node as Text).length });
  }
  let remaining = length;
  for (let i = texts.length - 1; i >= 0; i--) {
    if (texts[i].end >= remaining) {
      const range = root.ownerDocument.createRange();
      range.setStart(texts[i].node, texts[i].end - remaining);
      range.setEnd(caret.startContainer, caret.startOffset);
      return range;
    }
    remaining -= texts[i].end;
  }
  return null;
}

/** Selects the `length` characters before the caret, so a delete removes them. */
export function selectBeforeCaret(root: HTMLElement, caret: Range, length: number): boolean {
  const range = rangeBeforeCaret(root, caret, length);
  if (range) select(range);
  return !!range;
}

/** Whether a list item holds nothing (a placeholder `<br>` aside). */
export function isEmptyItem(item: HTMLLIElement): boolean {
  return (item.textContent ?? "").replace(/​/g, "") === "";
}

function fallback(root: HTMLElement, command: Command, value?: string): boolean {
  const doc = root.ownerDocument;
  const selection = doc.getSelection();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;
  if (command === "delete" || command === "insertText") {
    range.deleteContents();
    if (command === "insertText" && value) {
      const text = doc.createTextNode(value);
      range.insertNode(text);
      placeCaret(text, text.length);
    } else placeCaret(range.startContainer, range.startOffset);
    return true;
  }
  if (command !== "insertOrderedList" && command !== "insertUnorderedList") return false;
  const tag = command === "insertOrderedList" ? "OL" : "UL";
  // Keep the caret where it was as its nodes move.
  const mark = { node: range.startContainer, offset: range.startOffset };
  let home: HTMLElement;
  const item = listItemOf(root, mark.node);
  const list = item?.parentElement;
  if (item && list && (list.tagName === "UL" || list.tagName === "OL")) {
    if (list.tagName === tag) {
      // Take the item out of its list, splitting the list around it.
      home = doc.createElement("p");
      home.append(...item.childNodes);
      const tail = Array.from(list.children).slice(Array.from(list.children).indexOf(item) + 1);
      list.after(home);
      if (tail.length) {
        const rest = doc.createElement(tag);
        rest.append(...tail);
        home.after(rest);
      }
      item.remove();
      if (!list.children.length) list.remove();
    } else {
      const other = doc.createElement(tag);
      other.append(...list.childNodes);
      list.replaceWith(other);
      home = item;
    }
  } else {
    const block = blockOf(root, mark.node);
    if (block === root || block.tagName === "UL" || block.tagName === "OL") return false;
    home = doc.createElement("li");
    home.append(...block.childNodes);
    const previous = block.previousElementSibling;
    if (previous?.tagName === tag) {
      previous.append(home);
      block.remove();
    } else {
      const created = doc.createElement(tag);
      created.append(home);
      block.replaceWith(created);
    }
  }
  if (home.contains(mark.node) && mark.node !== home) placeCaret(mark.node, mark.offset);
  else placeCaret(home, 0);
  return true;
}

/**
 * Runs an editing command through the browser, so undo can step back over
 * it, or through the fallback when the browser can't. Returns which ran.
 */
export function edit(root: HTMLElement, command: Command, value?: string): "native" | "fallback" | null {
  const doc = root.ownerDocument;
  try {
    if (typeof doc.execCommand === "function" && doc.execCommand(command, false, value)) return "native";
  } catch { /* fall back below */ }
  if (!fallback(root, command, value)) return null;
  root.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: INPUT_TYPE[command], data: command === "insertText" ? value ?? null : null }));
  return "fallback";
}
