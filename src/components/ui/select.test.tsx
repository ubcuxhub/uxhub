// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);
it.each([false, true])("keeps keyboard selection and accessible naming with multiline=%s", async multiline => {
  render(<Select defaultValue="first">
    <SelectTrigger multiline={multiline} aria-label="Session"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="first" textValue="Opening" description={multiline ? "Nov 15 · 11:00 PM – Nov 16 · 1:00 AM PT" : undefined}>Opening with a very long descriptive name</SelectItem>
      <SelectItem value="second" textValue="Closing" description={multiline ? "Nov 16 · 2:00 PM PT" : undefined}>Closing</SelectItem>
    </SelectContent>
  </Select>);
  const trigger = screen.getByRole("combobox", { name: "Session" });
  expect(trigger.textContent).toContain("Opening with a very long descriptive name");
  if (multiline) expect(trigger.textContent).toContain("Nov 16 · 1:00 AM PT");
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const option = await screen.findByRole("option", { name: /Closing/ });
  option.focus();
  fireEvent.keyDown(option, { key: "Enter" });
  expect(trigger.textContent).toContain("Closing");
  expect(trigger.textContent).not.toContain("Opening");
});
