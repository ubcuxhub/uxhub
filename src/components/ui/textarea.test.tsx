// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Textarea } from "./textarea";

afterEach(cleanup);

describe("Textarea without a counter", () => {
  it("renders the bare <textarea>, with or without showCount alone", () => {
    const { container, rerender } = render(<Textarea aria-label="Bio" />);
    const bare = container.innerHTML;
    expect(container.firstElementChild?.tagName).toBe("TEXTAREA");

    // showCount needs maxLength; without one it changes nothing.
    rerender(<Textarea aria-label="Bio" showCount />);
    expect(container.innerHTML).toBe(bare);

    // maxLength alone adds the attribute and nothing else.
    rerender(<Textarea aria-label="Bio" maxLength={280} />);
    expect(container.querySelector("[data-slot=textarea-wrapper]")).toBeNull();
    expect(container.querySelector("textarea")?.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("Textarea counter", () => {
  it("reads n/max for a defaultValue and updates while typing", () => {
    render(<Textarea aria-label="Bio" maxLength={280} showCount defaultValue="Hello" />);
    const counter = document.querySelector("[data-slot=textarea-count]");
    expect(counter?.textContent).toBe("5/280");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello there" } });
    expect(counter?.textContent).toBe("11/280");
  });

  it("counts a controlled value", () => {
    function Controlled() {
      const [value, setValue] = useState("abc");
      return (
        <Textarea
          aria-label="Bio"
          maxLength={10}
          showCount
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    }
    render(<Controlled />);
    const counter = document.querySelector("[data-slot=textarea-count]");
    expect(counter?.textContent).toBe("3/10");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abcdef" } });
    expect(counter?.textContent).toBe("6/10");
  });

  it("counts an emoji as one character, not two UTF-16 units", () => {
    render(<Textarea aria-label="Bio" maxLength={10} showCount defaultValue="a😀b" />);
    expect(document.querySelector("[data-slot=textarea-count]")?.textContent).toBe("3/10");
  });

  it("links the counter with aria-describedby, keeping the caller's ids", () => {
    render(
      <Textarea aria-label="Bio" maxLength={280} showCount aria-describedby="hint" />,
    );
    const counter = document.querySelector("[data-slot=textarea-count]");
    const ids = screen.getByRole("textbox").getAttribute("aria-describedby")?.split(" ");
    expect(ids).toEqual(["hint", counter?.id]);
  });

  it("speaks only at 20 left or fewer, and at the limit", () => {
    render(<Textarea aria-label="Bio" maxLength={30} showCount defaultValue="x" />);
    const live = () => document.querySelector("[aria-live=polite]")?.textContent;
    const box = screen.getByRole("textbox");

    expect(live()).toBe("");
    fireEvent.change(box, { target: { value: "x".repeat(10) } });
    expect(live()).toBe("20 characters left");
    fireEvent.change(box, { target: { value: "x".repeat(29) } });
    expect(live()).toBe("1 character left");
    fireEvent.change(box, { target: { value: "x".repeat(30) } });
    expect(live()).toBe("Character limit reached");
  });

  it("turns red when invalid or at the limit", () => {
    const { rerender } = render(
      <Textarea aria-label="Bio" maxLength={10} showCount defaultValue="abc" />,
    );
    const counter = () => document.querySelector("[data-slot=textarea-count]");
    expect(counter()?.className).toContain("text-muted-foreground");

    rerender(<Textarea aria-label="Bio" maxLength={10} showCount defaultValue="abc" aria-invalid />);
    expect(counter()?.className).toContain("text-destructive");

    rerender(<Textarea aria-label="Bio" maxLength={3} showCount defaultValue="abc" />);
    expect(counter()?.className).toContain("text-destructive");
  });

  it("resyncs the counter after a form reset", async () => {
    render(
      <form>
        <Textarea aria-label="Bio" maxLength={10} showCount defaultValue="abc" />
        <button type="reset">Reset</button>
      </form>,
    );
    const count = () => document.querySelector("[data-slot=textarea-count]")?.textContent;
    const box = screen.getByLabelText("Bio");
    fireEvent.change(box, { target: { value: "abcdefghij" } });
    expect(count()).toBe("10/10");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(count()).toBe("3/10"));
  });

  it("resyncs after form.reset() called from script, and still forwards its ref", async () => {
    const ref = createRef<HTMLTextAreaElement>();
    const { container } = render(
      <form>
        <Textarea ref={ref} aria-label="Bio" maxLength={10} showCount />
      </form>,
    );
    const count = () => document.querySelector("[data-slot=textarea-count]")?.textContent;
    expect(ref.current).toBe(screen.getByLabelText("Bio"));
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "hello" } });
    expect(count()).toBe("5/10");

    act(() => container.querySelector("form")!.reset());
    await waitFor(() => expect(count()).toBe("0/10"));
  });
});
