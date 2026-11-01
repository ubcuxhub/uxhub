// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Checkbox } from "./checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  joinIds,
} from "./field";
import { Input } from "./input";
import { Slider } from "./slider";
import { Textarea } from "./textarea";

afterEach(cleanup);

const ids = (el: Element) =>
  (el.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);

describe("joinIds", () => {
  it("joins, drops blanks and repeats, and returns undefined when empty", () => {
    expect(joinIds("a", undefined, "b a", "")).toBe("a b");
    expect(joinIds(undefined, null, false)).toBeUndefined();
  });
});

describe("Field wiring", () => {
  it("links an Input to its description and error, and marks it invalid", async () => {
    render(
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input id="email" />
        <FieldDescription>Use your school address.</FieldDescription>
        <FieldError>Enter a valid email.</FieldError>
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    await waitFor(() => expect(ids(input)).toHaveLength(2));
    const [descriptionId, errorId] = ids(input);
    expect(document.getElementById(descriptionId)?.textContent).toBe(
      "Use your school address.",
    );
    expect(document.getElementById(errorId)?.textContent).toBe(
      "Enter a valid email.",
    );
    expect(document.getElementById(errorId)?.getAttribute("role")).toBe("alert");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("references only what is mounted, and clears when the error goes", async () => {
    const view = (error?: string) => (
      <Field>
        <Input aria-label="Name" />
        <FieldDescription>Shown on your ticket.</FieldDescription>
        <FieldError>{error}</FieldError>
      </Field>
    );
    const { rerender } = render(view());
    const input = screen.getByLabelText("Name");
    await waitFor(() => expect(ids(input)).toHaveLength(1));
    expect(input.hasAttribute("aria-invalid")).toBe(false);

    rerender(view("Required."));
    await waitFor(() => expect(ids(input)).toHaveLength(2));
    expect(input.getAttribute("aria-invalid")).toBe("true");

    rerender(view());
    await waitFor(() => expect(ids(input)).toHaveLength(1));
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("keeps a control's own aria-describedby and honours an explicit id", async () => {
    render(
      <Field>
        <Input aria-label="Code" aria-describedby="elsewhere" />
        <FieldError id="code-error">Wrong code.</FieldError>
      </Field>,
    );
    const input = screen.getByLabelText("Code");
    await waitFor(() => expect(ids(input)).toEqual(["elsewhere", "code-error"]));
    expect(document.getElementById("code-error")?.textContent).toBe("Wrong code.");
  });

  it("lets a control's own aria-invalid win, and data-invalid mark the field", () => {
    render(
      <>
        <Field data-invalid>
          <Input aria-label="Marked" />
        </Field>
        <Field data-invalid>
          <Input aria-label="Opted out" aria-invalid={false} />
        </Field>
      </>,
    );
    expect(screen.getByLabelText("Marked").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Opted out").getAttribute("aria-invalid")).toBe("false");
  });

  it("wires Textarea, Checkbox and Slider the same way", async () => {
    render(
      <>
        <Field>
          <Textarea aria-label="Bio" />
          <FieldError>Too short.</FieldError>
        </Field>
        <Field>
          <Checkbox aria-label="Agree" />
          <FieldError>Required.</FieldError>
        </Field>
        <Field>
          <Slider aria-label="Zoom" />
          <FieldDescription>Percent.</FieldDescription>
        </Field>
      </>,
    );
    for (const name of ["Bio", "Agree"]) {
      const el = screen.getByLabelText(name);
      await waitFor(() => expect(ids(el)).toHaveLength(1));
      expect(el.getAttribute("aria-invalid")).toBe("true");
    }
    const slider = screen.getByRole("slider");
    await waitFor(() => expect(ids(slider)).toHaveLength(1));
    expect(slider.hasAttribute("aria-invalid")).toBe(false);
  });

  it("leaves a control outside any Field untouched", () => {
    render(<Input aria-label="Alone" />);
    const input = screen.getByLabelText("Alone");
    expect(input.hasAttribute("aria-describedby")).toBe(false);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("scopes ids to the nearest Field", async () => {
    render(
      <>
        <Field>
          <Input aria-label="One" />
          <FieldError>First.</FieldError>
        </Field>
        <Field>
          <Input aria-label="Two" />
        </Field>
      </>,
    );
    await waitFor(() => expect(ids(screen.getByLabelText("One"))).toHaveLength(1));
    expect(screen.getByLabelText("Two").hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("FieldLabel", () => {
  it("outlines a checked control only for a card label that wraps a Field", () => {
    render(<FieldLabel data-testid="label">Plain</FieldLabel>);
    const checkedTokens = screen
      .getByTestId("label")
      .className.split(/\s+/)
      .filter((token) => token.includes("checked"));
    expect(checkedTokens.length).toBeGreaterThan(0);
    for (const token of checkedTokens) {
      expect(token.startsWith("has-[>[data-slot=field]]:")).toBe(true);
    }
  });
});
