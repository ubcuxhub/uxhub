// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Field, FieldError, FieldLabel } from "./field";
import { PasswordInput } from "./password-input";

afterEach(cleanup);

function setup(props: Partial<React.ComponentProps<typeof PasswordInput>> = {}) {
  render(
    <Field>
      <FieldLabel htmlFor="pw">Password</FieldLabel>
      <PasswordInput id="pw" autoComplete="current-password" {...props} />
    </Field>,
  );
  return {
    input: screen.getByLabelText("Password") as HTMLInputElement,
    toggle: screen.getByRole("button", { name: "Show password" }),
  };
}

describe("PasswordInput", () => {
  it("starts hidden, with a named, unpressed toggle", () => {
    const { input, toggle } = setup();
    expect(input.type).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("pw");
    expect(toggle.getAttribute("type")).toBe("button");
  });

  it("shows and hides the password, keeping the same name", () => {
    const onVisibleChange = vi.fn();
    const { input, toggle } = setup({ onVisibleChange });

    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Show password" })).toBe(toggle);

    fireEvent.click(toggle);
    expect(input.type).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(onVisibleChange.mock.calls).toEqual([[true], [false]]);
  });

  it("keeps autocomplete and turns off autocorrect and spellcheck", () => {
    const { input } = setup();
    expect(input.getAttribute("autocomplete")).toBe("current-password");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("none");
    expect(input.getAttribute("spellcheck")).toBe("false");
  });

  it("doesn't take focus from the field on a mouse press", () => {
    const { toggle } = setup();
    const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    toggle.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
  });

  it("restores the caret after the type changes", () => {
    const { input, toggle } = setup({ defaultValue: "hunter2hunter2" });
    input.focus();
    input.setSelectionRange(3, 3);

    fireEvent.click(toggle);

    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 3]);
  });

  it("hides the password again when the form submits", () => {
    render(
      <form onSubmit={(event) => event.preventDefault()}>
        <PasswordInput aria-label="Password" defaultVisible />
        <button type="submit">Sign in</button>
      </form>,
    );
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("text");

    fireEvent.submit(input.form!);

    expect(input.type).toBe("password");
    expect(
      screen.getByRole("button", { name: "Show password" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("disables the toggle with the field", () => {
    const { toggle } = setup({ disabled: true });
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
  });

  it("links the field's error and invalid state", () => {
    render(
      <Field data-invalid>
        <FieldLabel htmlFor="pw">Password</FieldLabel>
        <PasswordInput id="pw" aria-invalid />
        <FieldError>Use at least 8 characters.</FieldError>
      </Field>,
    );
    const input = screen.getByLabelText("Password");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).not.toBe("");
    expect(document.getElementById(describedBy)?.textContent).toBe(
      "Use at least 8 characters.",
    );
  });

  it("forwards the ref to the input and takes a custom label", () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordInput ref={ref} aria-label="New password" toggleLabel="Show new password" />);
    expect(ref.current?.tagName).toBe("INPUT");
    expect(screen.getByRole("button", { name: "Show new password" })).toBeTruthy();
  });
});
