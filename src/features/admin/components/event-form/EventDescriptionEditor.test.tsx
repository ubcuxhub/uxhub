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
