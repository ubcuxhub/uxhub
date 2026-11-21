// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { plainDescription } from "@/lib/event-description";
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
