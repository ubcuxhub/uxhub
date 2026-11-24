// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventDescription } from "@/components/shared/EventDescription";
import { descriptionText, ORDERED_LIST_MAX_START, orderedListNumbers, parseEventDescription, safeDescriptionLink } from "./event-description";

afterEach(cleanup);
describe("event descriptions", () => {
  it("renders saved formatting as text, lists and safe links", () => {
    const rich = [{ type: "paragraph", spans: [{ text: "Bring a laptop", bold: true, italic: true, href: "https://example.org/guide" }] }, { type: "list-item", spans: [{ text: "<script>alert(1)</script>" }] }];
    const parsed = parseEventDescription(JSON.parse(JSON.stringify(rich)))!;
    expect(descriptionText(parsed)).toBe("Bring a laptop\n<script>alert(1)</script>");
    const { container } = render(<EventDescription rich={parsed} text="" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://example.org/guide");
    expect(container.querySelector("em strong")).not.toBeNull();
    expect(screen.getByRole("listitem").textContent).toBe("<script>alert(1)</script>");
    expect(container.querySelector("script")).toBeNull();
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "vbscript:x", "file:///tmp/x", "//untrusted.test"])("rejects unsafe links: %s", href => {
    expect(safeDescriptionLink(href)).toBeUndefined();
    expect(parseEventDescription([{ type: "paragraph", spans: [{ text: "Link", href }] }])).toBeNull();
  });
  it("retains legacy plain text without interpreting HTML", () => {
    const { container } = render(<EventDescription text={'Legacy <b>text</b>\nNext line'} rich={null} />);
    expect(container.textContent).toBe('Legacy <b>text</b>\nNext line');
    expect(container.querySelector("b")).toBeNull();
  });
});

describe("numbered lists", () => {
  const rich = [
    { type: "paragraph", spans: [{ text: "Agenda" }] },
    { type: "ordered-item", spans: [{ text: "Doors", bold: true }] },
    { type: "ordered-item", spans: [{ text: "Talks" }] },
    { type: "ordered-item", start: 1, spans: [{ text: "Fresh list" }] },
    { type: "list-item", spans: [{ text: "Bring water" }] },
    { type: "list-item", spans: [{ text: "Bring a laptop" }] },
    { type: "ordered-item", start: 3, spans: [{ text: "Third" }] },
    { type: "ordered-item", spans: [{ text: "Fourth" }] },
  ];

  it("parses ordered items and their starts", () => {
    expect(parseEventDescription(JSON.parse(JSON.stringify(rich)))).toEqual(rich);
  });

  it("numbers ordered items in the plain text and leaves bullets bare", () => {
    expect(orderedListNumbers(parseEventDescription(rich)!)).toEqual([null, 1, 2, 1, null, null, 3, 4]);
    expect(descriptionText(parseEventDescription(rich)!)).toBe("Agenda\n1. Doors\n2. Talks\n1. Fresh list\nBring water\nBring a laptop\n3. Third\n4. Fourth");
  });

  it("renders each run of items as one list, starting where the model says", () => {
    const { container } = render(<EventDescription rich={rich} text="" />);
    const lists = Array.from(container.querySelectorAll("ol, ul"));
    expect(lists.map(list => [list.tagName, list.getAttribute("start"), list.children.length])).toEqual([["OL", null, 2], ["OL", null, 1], ["UL", null, 2], ["OL", "3", 2]]);
    expect(lists[0].className).toContain("list-decimal");
    expect(lists[2].className).toContain("list-disc");
    expect(lists[0].querySelector("li strong")?.textContent).toBe("Doors");
  });

  it.each([
    ["an unknown block type", [{ type: "numbered-item", spans: [] }]],
    ["a start on a paragraph", [{ type: "paragraph", start: 2, spans: [] }]],
    ["a start on a bullet", [{ type: "list-item", start: 2, spans: [] }]],
    ["a fractional start", [{ type: "ordered-item", start: 1.5, spans: [] }]],
    ["a negative start", [{ type: "ordered-item", start: -1, spans: [] }]],
    ["a start past the limit", [{ type: "ordered-item", start: ORDERED_LIST_MAX_START + 1, spans: [] }]],
    ["a string start", [{ type: "ordered-item", start: "2", spans: [] }]],
    ["a null start", [{ type: "ordered-item", start: null, spans: [] }]],
    ["missing spans", [{ type: "ordered-item" }]],
  ])("rejects %s", (_, value) => {
    expect(parseEventDescription(value)).toBeNull();
  });

  it("falls back to the saved text when the rich form is rejected", () => {
    const { container } = render(<EventDescription rich={[{ type: "ordered-item", start: "x", spans: [] }]} text={"1. Plain"} />);
    expect(container.querySelector("ol")).toBeNull();
    expect(container.textContent).toBe("1. Plain");
  });
});
