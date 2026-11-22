// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { descriptionText, plainDescription, type EventDescription as RichDescription } from "@/lib/event-description";
import { EventDescriptionEditor } from "./EventDescriptionEditor";

afterEach(cleanup);
it("exposes overview guidance while empty and removes the visual placeholder when populated", () => {
  const props = { short: "", value: "", rich: null, disabled: false, onChange: vi.fn() };
  const { rerender } = render(<EventDescriptionEditor {...props} />);
  const short = screen.getByLabelText("Short overview");
  expect(short.getAttribute("placeholder")).toBe("One short line. E.g. Portfolio feedback from industry designers");
  expect(screen.getByRole("textbox", { name: "Long overview" }).getAttribute("aria-placeholder")).toContain("what to bring");
  expect(screen.getByText(/Who it’s for/).getAttribute("aria-hidden")).toBe("true");
  fireEvent.change(short, { target: { value: "A short introduction" } });
  expect(props.onChange).toHaveBeenCalledWith("A short introduction", "", plainDescription(""));
  rerender(<EventDescriptionEditor {...props} value="An overview" />);
  expect(screen.queryByText(/Who it’s for/)).toBeNull();
});

it("counts an emoji as one character and stops the short overview at 120", () => {
  const onChange = vi.fn();
  const props = { value: "", rich: null, disabled: false, onChange };
  const { rerender } = render(<EventDescriptionEditor {...props} short={"Kickoff \u{1F389}"} />);
  expect(screen.getByText("9 / 120")).toBeTruthy();
  const short = screen.getByLabelText("Short overview");
  // No native maxLength: it counts UTF-16 units, so an emoji would cost two.
  expect(short.hasAttribute("maxlength")).toBe(false);

  fireEvent.change(short, { target: { value: "\u{1F44B}".repeat(125) } });
  expect(onChange).toHaveBeenLastCalledWith("\u{1F44B}".repeat(120), "", plainDescription(""));
  rerender(<EventDescriptionEditor {...props} short={"\u{1F44B}".repeat(120)} />);
  expect(screen.getByText("120 / 120")).toBeTruthy();
});

describe("list shortcuts", () => {
  // jsdom has no execCommand, so these run the editor's DOM fallback; the
  // browser path is the same sequence of commands through execCommand.
  function setup(rich: RichDescription | null = null) {
    const onChange = vi.fn();
    render(<EventDescriptionEditor short="" value={rich ? descriptionText(rich) : ""} rich={rich} disabled={false} onChange={onChange} />);
    const root = screen.getByRole("textbox", { name: "Long overview" });
    const last = () => onChange.mock.lastCall as [string, string, RichDescription] | undefined;
    return { root, onChange, text: () => last()?.[1], rich: () => last()?.[2] };
  }
  function caretAt(node: Node, offset = 0) {
    const range = document.createRange();
    range.setStart(node, offset);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  }
  /** Types like a browser: the character lands at the caret, then `input` fires. */
  function type(root: HTMLElement, text: string, init: Partial<InputEventInit> = {}) {
    for (const char of text) {
      const range = getSelection()!.getRangeAt(0);
      let node = range.startContainer;
      let offset = range.startOffset;
      if (!(node instanceof Text)) {
        node = document.createTextNode("");
        range.insertNode(node);
        offset = 0;
      }
      (node as Text).insertData(offset, char);
      caretAt(node, offset + 1);
      fireEvent.input(root, { inputType: "insertText", data: char, ...init });
    }
  }
  const firstLine = (root: HTMLElement) => root.querySelector("p, li")!;

  it.each([["- ", "UL"], ["* ", "UL"], ["1. ", "OL"]])("turns %j at the start of a line into a list", (marker, tag) => {
    const { root, rich, text } = setup();
    caretAt(firstLine(root));
    type(root, marker);
    expect(root.querySelector("li")?.parentElement?.tagName).toBe(tag);
    expect(root.querySelector("p")).toBeNull();
    type(root, "item");
    expect(root.querySelector("li")?.textContent).toBe("item");
    expect(rich()).toEqual([{ type: tag === "OL" ? "ordered-item" : "list-item", spans: [{ text: "item" }] }]);
    expect(text()).toBe(tag === "OL" ? "1. item" : "item");
    expect(screen.getByText(tag === "OL" ? "Numbered list" : "Bulleted list").getAttribute("aria-live")).toBe("polite");
  });

  it("runs when an input method inserts the marker in one go", () => {
    const { root, rich } = setup();
    const line = firstLine(root);
    line.append("- ");
    caretAt(line.firstChild!, 2);
    fireEvent.input(root, { inputType: "insertText", data: "- " });
    expect(rich()).toEqual([{ type: "list-item", spans: [] }]);
  });

  it("reads a list Chrome nested inside the paragraph it converted", () => {
    const { root, rich } = setup();
    firstLine(root).innerHTML = "<ul><li>item</li><li>next</li></ul><ol><li>first<br></li></ol>";
    fireEvent.input(root, { inputType: "insertText", data: "t" });
    expect(rich()).toEqual([{ type: "list-item", spans: [{ text: "item" }] }, { type: "list-item", spans: [{ text: "next" }] }, { type: "ordered-item", spans: [{ text: "first" }] }]);
  });

  it("starts a numbered list typed as 3. at 3", () => {
    const { root, rich, text } = setup();
    caretAt(firstLine(root));
    type(root, "3. first");
    expect(root.querySelector("ol")?.getAttribute("start")).toBe("3");
    expect(rich()).toEqual([{ type: "ordered-item", start: 3, spans: [{ text: "first" }] }]);
    expect(text()).toBe("3. first");
  });

  it("keeps the text after the caret", () => {
    const { root, rich } = setup([{ type: "paragraph", spans: [{ text: "Bring a laptop" }] }]);
    caretAt(firstLine(root).firstChild!, 0);
    type(root, "- ");
    expect(rich()).toEqual([{ type: "list-item", spans: [{ text: "Bring a laptop" }] }]);
  });

  it("leaves a marker typed mid-line, or inside a list item, as text", () => {
    const { root, rich } = setup([{ type: "paragraph", spans: [{ text: "Step" }] }, { type: "list-item", spans: [{ text: "item" }] }]);
    caretAt(firstLine(root).firstChild!, 4);
    type(root, " 1. ");
    caretAt(root.querySelector("li")!.firstChild!, 0);
    type(root, "- ");
    expect(rich()).toEqual([{ type: "paragraph", spans: [{ text: "Step 1. " }] }, { type: "list-item", spans: [{ text: "- item" }] }]);
    expect(root.querySelectorAll("li")).toHaveLength(1);
  });

  it("doesn't run during IME composition", () => {
    const { root, rich } = setup();
    caretAt(firstLine(root));
    type(root, "-");
    type(root, " ", { isComposing: true });
    expect(root.querySelector("li")).toBeNull();
    expect(rich()).toEqual([{ type: "paragraph", spans: [{ text: "- " }] }]);
  });

  it.each([["Backspace", {}], ["z", { ctrlKey: true }], ["z", { metaKey: true }]])("reverts to the typed marker on %s right after the shortcut", (key, modifiers) => {
    const { root, rich, text } = setup();
    caretAt(firstLine(root));
    type(root, "1. ");
    expect(fireEvent.keyDown(root, { key, ...modifiers })).toBe(false);
    expect(root.querySelector("li")).toBeNull();
    expect(rich()).toEqual([{ type: "paragraph", spans: [{ text: "1. " }] }]);
    expect(text()).toBe("1. ");
    // The caret sits after the marker, so typing carries on the line.
    type(root, "x");
    expect(text()).toBe("1. x");
  });

  it("doesn't revert once something else happened", () => {
    const { root, rich } = setup();
    caretAt(firstLine(root));
    type(root, "- a");
    caretAt(root.querySelector("li")!.firstChild!, 0);
    expect(fireEvent.keyDown(root, { key: "Backspace" })).toBe(true);
    expect(rich()).toEqual([{ type: "list-item", spans: [{ text: "a" }] }]);
  });

  it("leaves the list on Enter in an empty item, splitting it mid-list", () => {
    const { root, rich } = setup([{ type: "ordered-item", spans: [{ text: "one" }] }, { type: "ordered-item", spans: [] }, { type: "ordered-item", spans: [{ text: "two" }] }]);
    const items = root.querySelectorAll("li");
    expect(fireEvent.keyDown(root, { key: "Enter" })).toBe(true);
    caretAt(items[0].firstChild!, 3);
    expect(fireEvent.keyDown(root, { key: "Enter" })).toBe(true);
    caretAt(items[1], 0);
    expect(fireEvent.keyDown(root, { key: "Enter" })).toBe(false);
    expect(Array.from(root.querySelector(".space-y-2")!.children).map(child => child.tagName)).toEqual(["OL", "P", "OL"]);
    expect(rich()).toEqual([{ type: "ordered-item", spans: [{ text: "one" }] }, { type: "paragraph", spans: [] }, { type: "ordered-item", spans: [{ text: "two" }] }]);
  });

  it("leaves the list on Enter in an empty last bullet", () => {
    const { root, rich } = setup([{ type: "list-item", spans: [{ text: "one" }] }, { type: "list-item", spans: [] }]);
    caretAt(root.querySelectorAll("li")[1], 0);
    expect(fireEvent.keyDown(root, { key: "Enter" })).toBe(false);
    expect(rich()).toEqual([{ type: "list-item", spans: [{ text: "one" }] }, { type: "paragraph", spans: [] }]);
  });

  it("pastes plain text without running a shortcut", () => {
    const { root, rich } = setup();
    caretAt(firstLine(root));
    type(root, "-");
    fireEvent.paste(root, { clipboardData: { getData: () => " " } });
    expect(root.querySelector("li")).toBeNull();
    fireEvent.paste(root, { clipboardData: { getData: () => "<b>1. </b>" } });
    expect(root.querySelector("li, b")).toBeNull();
    expect(rich()).toEqual([{ type: "paragraph", spans: [{ text: "- <b>1. </b>" }] }]);
  });

  it("formats the line as a numbered list from the toolbar", () => {
    const { root, rich } = setup([{ type: "paragraph", spans: [{ text: "Doors" }] }]);
    // The toolbar keeps focus in the editor (its buttons cancel mousedown).
    root.focus();
    caretAt(firstLine(root).firstChild!, 2);
    fireEvent.click(screen.getByRole("button", { name: "Numbered list" }));
    expect(rich()).toEqual([{ type: "ordered-item", spans: [{ text: "Doors" }] }]);
  });

  it("reads lists back as saved, ignoring the <br> that holds an empty line open", () => {
    const saved: RichDescription = [
      { type: "ordered-item", start: 3, spans: [{ text: "three" }] },
      { type: "ordered-item", spans: [{ text: "four", italic: true }] },
      { type: "ordered-item", start: 1, spans: [{ text: "again" }] },
      { type: "list-item", spans: [{ text: "dot" }] },
      { type: "paragraph", spans: [{ text: "end" }] },
    ];
    const { root, rich, text } = setup(saved);
    fireEvent.input(root, { inputType: "insertText", data: "x" });
    expect(rich()).toEqual(saved);
    expect(text()).toBe("3. three\n4. four\n1. again\ndot\nend");
    root.querySelector("p")!.append(document.createElement("br"));
    root.querySelector("ul li")!.replaceChildren(document.createElement("br"));
    fireEvent.input(root, { inputType: "insertParagraph" });
    expect(rich()!.slice(3)).toEqual([{ type: "list-item", spans: [] }, { type: "paragraph", spans: [{ text: "end" }] }]);
  });
});
