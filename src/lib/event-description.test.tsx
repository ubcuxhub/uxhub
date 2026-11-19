// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventDescription } from "@/components/shared/EventDescription";
import { descriptionText, parseEventDescription, safeDescriptionLink } from "./event-description";

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
