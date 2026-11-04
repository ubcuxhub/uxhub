// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { RadioGroup, RadioGroupItem } from "./radio-group";

beforeAll(() => {
  // Radix sizes the hidden form input with a ResizeObserver, which jsdom lacks.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(cleanup);

function Group({
  onValueChange,
  name,
  defaultValue,
}: {
  onValueChange?: (value: string) => void;
  name?: string;
  defaultValue?: string;
}) {
  return (
    <RadioGroup
      aria-label="Who can register?"
      name={name}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <RadioGroupItem value="anyone" aria-label="Anyone" />
      <RadioGroupItem value="members" aria-label="Members only" />
      <RadioGroupItem value="invite" aria-label="Invite only" disabled />
    </RadioGroup>
  );
}

describe("RadioGroup", () => {
  it("is a named radiogroup of radios", () => {
    render(<Group defaultValue="anyone" />);
    expect(screen.getByRole("radiogroup", { name: "Who can register?" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Anyone" }).getAttribute("aria-checked")).toBe("true");
  });

  it("selects on click and reports the value", () => {
    const onValueChange = vi.fn();
    render(<Group onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Members only" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("members");
    expect(screen.getByRole("radio", { name: "Members only" }).getAttribute("aria-checked")).toBe("true");
  });

  it("arrow keys move and select, skipping a disabled radio", async () => {
    render(<Group defaultValue="anyone" />);
    const anyone = screen.getByRole("radio", { name: "Anyone" });
    anyone.focus();
    fireEvent.keyDown(anyone, { key: "ArrowDown" });
    const members = screen.getByRole("radio", { name: "Members only" });
    await waitFor(() => expect(document.activeElement).toBe(members));
    expect(members.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(members, { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(anyone));
    expect(anyone.getAttribute("aria-checked")).toBe("true");
  });

  it("puts its value in FormData inside a form", () => {
    const { container } = render(
      <form>
        <Group name="who" defaultValue="members" />
      </form>,
    );
    const form = container.querySelector("form")!;
    expect(new FormData(form).get("who")).toBe("members");
    fireEvent.click(screen.getByRole("radio", { name: "Anyone" }));
    expect(new FormData(form).get("who")).toBe("anyone");
  });
});
